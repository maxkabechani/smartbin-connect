import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromNodeHeaders } from 'better-auth/node';
import { createHash, randomBytes } from 'node:crypto';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { auth } from './auth.js';
import { db, pool } from './db/index.js';
import { bins, readings, dispatchTasks, user } from './db/schema.js';
import { and, desc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8000);
const apiKey = process.env.API_KEY ?? 'change-me';
const aiUrl = process.env.AI_SERVICE_URL ?? 'http://ai-service:9000';
const routeDepot = { latitude: Number(process.env.ROUTE_DEPOT_LATITUDE ?? '-15.401'), longitude: Number(process.env.ROUTE_DEPOT_LONGITUDE ?? '28.275') };
const claimCodes = new Map(
  (process.env.BIN_CLAIMS ?? '').split(',')
    .map((entry) => entry.split(':', 2) as [string, string])
    .filter(([binId, code]) => Boolean(binId && code)),
);

await migrate(db, { migrationsFolder: path.join(root, '..', 'drizzle') });

async function seedInitialData() {
  if (process.env.SEED_INITIAL_DATA !== 'true') return;
  const existing = await db.select({ id: bins.id }).from(bins).limit(1);
  if (existing.length) return;

  const now = Date.now();
  const initialBins = [
    { binId: 'BIN-01', claimCode: 'claim-01' },
    { binId: 'BIN-02', claimCode: 'claim-02' },
    { binId: 'BIN-03', claimCode: 'claim-03' },
    { binId: 'BIN-04', claimCode: 'claim-04' },
  ];
  await db.insert(bins).values(initialBins);
  await db.insert(readings).values([
    { binId: 'BIN-01', fillLevel: 82, lidOpen: false, wifiRssi: -54, createdAt: new Date(now - 2 * 60_000) },
    { binId: 'BIN-02', fillLevel: 46, lidOpen: false, wifiRssi: -61, createdAt: new Date(now - 5 * 60_000) },
    { binId: 'BIN-03', fillLevel: 18, lidOpen: false, wifiRssi: -67, createdAt: new Date(now - 8 * 60_000) },
    { binId: 'BIN-04', fillLevel: 68, lidOpen: false, wifiRssi: -58, createdAt: new Date(now - 12 * 60_000) },
  ]);
  await db.insert(dispatchTasks).values([
    { binId: 'BIN-01', priority: 'high', status: 'open', reason: 'near full', createdAt: new Date(now - 2 * 60_000) },
  ]);
  console.log('Seeded SmartBin initial data');
}

await seedInitialData();
// Old installations may still have claim codes for bins that were already linked.
// A claim code is only useful before ownership is assigned, so clear those secrets.
await db.update(bins).set({ claimCode: '' }).where(and(isNotNull(bins.ownerUserId), ne(bins.claimCode, '')));

type Telemetry = { api_key: string; bin_id: string; fill_level: number; lid_open?: boolean; wifi_rssi?: number };
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: path.join(root, '..', 'public'), prefix: '/' });

app.route({ method: ['GET', 'POST'], url: '/api/auth/*', async handler(request, reply) {
  const url = new URL(request.url, `${process.env.AUTH_URL ?? 'http://localhost:8000'}`);
  const req = new Request(url, { method: request.method, headers: fromNodeHeaders(request.headers), ...(request.body ? { body: JSON.stringify(request.body) } : {}) });
  const response = await auth.handler(req);
  const authBody = request.body as { email?: unknown } | undefined;
  const signupEmail = request.method === 'POST' && url.pathname === '/api/auth/sign-up/email' && typeof authBody?.email === 'string'
    ? authBody.email.trim().toLowerCase()
    : '';
  const signupRole = signupEmail ? configuredRole(signupEmail) : null;
  if (response.ok && signupEmail && signupRole) {
    await db.update(user).set({ role: signupRole }).where(eq(user.email, signupEmail));
  }
  reply.status(response.status); response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(response.body ? await response.text() : null);
}});

async function requireUser(request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<any> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return reply.code(401).send({ error: 'authentication required' });
  const role = (await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1))[0]?.role ?? 'customer';
  return { ...session, user: { ...session.user, role } };
}

type Role = 'customer' | 'collector' | 'superadmin';

function generateClaimCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const characters = Array.from(randomBytes(16), (byte) => alphabet[byte & 31]).join('');
  return characters.match(/.{4}/g)!.join('-');
}

function hashClaimCode(code: string) {
  const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}

function configuredRole(email: string): Role | null {
  const normalized = email.trim().toLowerCase();
  const superadmins = new Set((process.env.SUPERADMIN_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const collectors = new Set((process.env.COLLECTOR_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (superadmins.has(normalized)) return 'superadmin';
  if (collectors.has(normalized)) return 'collector';
  return null;
}

async function requireRole(request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }, roles: Role[]) {
  const session = await requireUser(request, reply);
  if (!session) return null;
  if (!roles.includes(session.user.role as Role)) return reply.code(403).send({ error: 'insufficient permissions' });
  return session;
}

function fallback(fill: number) {
  if (fill >= 90) return { priority: 'urgent', hours_until_full: 0, reason: 'critical fill level' };
  if (fill >= 80) return { priority: 'high', hours_until_full: 8, reason: 'near full' };
  if (fill >= 60) return { priority: 'medium', hours_until_full: 24, reason: 'monitor' };
  return { priority: 'low', hours_until_full: 72, reason: 'available capacity' };
}

const fallbackBinLocations: Record<string, { latitude: number; longitude: number }> = {
  'BIN-01': { latitude: -15.408, longitude: 28.283 },
  'BIN-02': { latitude: -15.412, longitude: 28.290 },
  'BIN-03': { latitude: -15.419, longitude: 28.278 },
  'BIN-04': { latitude: -15.424, longitude: 28.287 },
};

const fallbackBinNames: Record<string, string> = {
  'BIN-01': 'Main entrance', 'BIN-02': 'Cafeteria', 'BIN-03': 'Workshop', 'BIN-04': 'Reception',
};

async function predict(fill: number, binId: string) {
  try {
    const response = await fetch(`${aiUrl}/predict`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bin_id: binId, fill_level: fill }) });
    if (response.ok) return await response.json() as ReturnType<typeof fallback>;
  } catch (error) { app.log.warn({ error }, 'AI service unavailable; using fallback'); }
  return fallback(fill);
}

app.get('/health', async () => ({ ok: true, service: 'smartbin-api' }));
app.post<{ Body: Telemetry }>('/api/telemetry', async (request, reply) => {
  const t = request.body;
  if (t.api_key !== apiKey) return reply.code(401).send({ error: 'invalid api key' });
  if (!t.bin_id || !Number.isFinite(t.fill_level) || t.fill_level < 0 || t.fill_level > 100) return reply.code(400).send({ error: 'invalid telemetry' });
  const created = new Date().toISOString();
  const registered = await db.select({ binId: bins.binId }).from(bins).where(eq(bins.binId, t.bin_id)).limit(1);
  if (!registered[0]) return reply.code(404).send({ error: 'bin is not registered' });
  await db.insert(readings).values({ binId: t.bin_id, fillLevel: t.fill_level, lidOpen: Boolean(t.lid_open), wifiRssi: t.wifi_rssi ?? 0, createdAt: new Date(created) });
  const prediction = await predict(t.fill_level, t.bin_id);
  if (prediction.priority === 'urgent' || prediction.priority === 'high') {
    const openTask = await db.select({ id: dispatchTasks.id }).from(dispatchTasks).where(and(eq(dispatchTasks.binId, t.bin_id), eq(dispatchTasks.status, 'open'))).limit(1);
    if (!openTask[0]) await db.insert(dispatchTasks).values({ binId: t.bin_id, priority: prediction.priority, status: 'open', reason: prediction.reason, createdAt: new Date(created) });
  }
  return { ok: true, bin_id: t.bin_id, prediction };
});

app.get('/api/me', async (request, reply) => {
  const session = await requireUser(request, reply);
  if (!session) return;
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role } };
});

app.post<{ Body: { bin_id: string; claim_code: string } }>('/api/bins/claim', async (request, reply) => {
  const session = await requireRole(request, reply, ['customer']); if (!session) return;
  const binId = typeof request.body?.bin_id === 'string' ? request.body.bin_id.trim() : '';
  const claimCode = typeof request.body?.claim_code === 'string' ? request.body.claim_code.trim() : '';
  if (!binId || !claimCode) return reply.code(400).send({ error: 'bin ID and claim code are required' });

  // New codes are hashed at rest. The raw comparison supports pre-existing codes
  // until their first claim, and the conditional update makes redemption atomic.
  const claimed = await db.update(bins).set({ ownerUserId: session.user.id, claimCode: '' })
    .where(and(
      eq(bins.binId, binId),
      isNull(bins.ownerUserId),
      or(eq(bins.claimCode, hashClaimCode(claimCode)), eq(bins.claimCode, claimCode)),
    ))
    .returning({ binId: bins.binId });
  if (claimed.length) return { ok: true, bin_id: binId };

  const existing = await db.select({ ownerUserId: bins.ownerUserId }).from(bins).where(eq(bins.binId, binId)).limit(1);
  if (existing[0]?.ownerUserId) return reply.code(409).send({ error: 'bin already linked' });
  return reply.code(400).send({ error: 'invalid bin or claim code' });
});

app.get('/api/bins', async (request, reply) => {
  const session = await requireUser(request, reply); if (!session) return;
  const owned = session.user.role === 'customer'
    ? await db.select().from(bins).where(eq(bins.ownerUserId, session.user.id))
    : await db.select().from(bins).orderBy(bins.binId);
  const result = [];
  for (const bin of owned) {
    const latest = await db.select().from(readings).where(eq(readings.binId, bin.binId)).orderBy(desc(readings.createdAt)).limit(1);
    const owner = bin.ownerUserId ? await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, bin.ownerUserId)).limit(1) : [];
    const fallbackLocation = fallbackBinLocations[bin.binId];
    result.push({ bin_id: bin.binId, name: bin.name || fallbackBinNames[bin.binId] || bin.binId, address: bin.address, latitude: bin.latitude ?? fallbackLocation?.latitude ?? null, longitude: bin.longitude ?? fallbackLocation?.longitude ?? null, fill_level: latest[0]?.fillLevel ?? 0, lid_open: latest[0]?.lidOpen ?? false, wifi_rssi: latest[0]?.wifiRssi ?? 0, last_seen: latest[0]?.createdAt?.toISOString() ?? null, priority: fallback(latest[0]?.fillLevel ?? 0).priority, owner_name: owner[0]?.name ?? null, owner_email: owner[0]?.email ?? null });
  }
  return result.sort((a,b) => b.fill_level-a.fill_level);
});

app.get('/api/dispatch', async (request, reply) => {
  const session = await requireUser(request, reply); if (!session) return;
  const filter = session.user.role === 'customer' ? and(eq(dispatchTasks.status, 'open'), eq(bins.ownerUserId, session.user.id)) : eq(dispatchTasks.status, 'open');
  return db.select({ id: dispatchTasks.id, bin_id: bins.binId, bin_name: bins.name, address: bins.address, priority: dispatchTasks.priority, reason: dispatchTasks.reason, status: dispatchTasks.status, owner_name: user.name, owner_email: user.email }).from(dispatchTasks).innerJoin(bins, eq(dispatchTasks.binId, bins.binId)).leftJoin(user, eq(bins.ownerUserId, user.id)).where(filter).orderBy(desc(dispatchTasks.createdAt));
});

app.post<{ Params: { bin_id: string } }>('/api/bins/:bin_id/request-collection', async (request, reply) => {
  const session = await requireRole(request, reply, ['customer']); if (!session) return;
  const binId = request.params.bin_id;
  const owned = await db.select({ binId: bins.binId }).from(bins).where(and(eq(bins.binId, binId), eq(bins.ownerUserId, session.user.id))).limit(1);
  if (!owned[0]) return reply.code(404).send({ error: 'bin not found in your account' });
  const openTask = await db.select({ id: dispatchTasks.id }).from(dispatchTasks).where(and(eq(dispatchTasks.binId, binId), eq(dispatchTasks.status, 'open'))).limit(1);
  if (openTask[0]) return reply.code(409).send({ error: 'A collection request is already open for this bin.' });
  await db.insert(dispatchTasks).values({ binId, priority: 'high', status: 'open', reason: 'Customer requested collection', createdAt: new Date() });
  return { ok: true, bin_id: binId };
});

app.get('/api/routes/optimized', async (request, reply) => {
  if (!await requireRole(request, reply, ['collector', 'superadmin'])) return;
  const tasks = await db.select({ bin_id: bins.binId, bin_name: bins.name, address: bins.address, priority: dispatchTasks.priority, reason: dispatchTasks.reason, owner_name: user.name, latitude: bins.latitude, longitude: bins.longitude }).from(dispatchTasks).innerJoin(bins, eq(dispatchTasks.binId, bins.binId)).leftJoin(user, eq(bins.ownerUserId, user.id)).where(eq(dispatchTasks.status, 'open')).orderBy(desc(dispatchTasks.createdAt));
  const stops = [];
  for (const task of tasks) {
    const latest = await db.select({ fillLevel: readings.fillLevel }).from(readings).where(eq(readings.binId, task.bin_id)).orderBy(desc(readings.createdAt)).limit(1);
    const fallbackLocation = fallbackBinLocations[task.bin_id];
    stops.push({ bin_id: task.bin_id, bin_name: task.bin_name || fallbackBinNames[task.bin_id] || task.bin_id, address: task.address, fill_level: latest[0]?.fillLevel ?? 0, priority: task.priority, reason: task.reason, owner_name: task.owner_name, latitude: task.latitude ?? fallbackLocation?.latitude ?? null, longitude: task.longitude ?? fallbackLocation?.longitude ?? null });
  }
  const routeOrigin = { origin_latitude: routeDepot.latitude, origin_longitude: routeDepot.longitude };
  if (!stops.length) return { ...routeOrigin, stops: [], distance_to_first_km: 0, between_stops_distance_km: 0, outbound_distance_km: 0, return_distance_km: 0, total_distance_km: 0, estimated_minutes: 0, estimated_savings_percent: 0, algorithm: 'priority-weighted nearest neighbour', unlocated_stops: 0 };
  try {
    const response = await fetch(`${aiUrl}/optimize-route`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stops, start_latitude: routeDepot.latitude, start_longitude: routeDepot.longitude, return_to_start: true }) });
    if (response.ok) {
      const optimized = await response.json() as { stops: Array<Record<string, unknown>>; [key: string]: unknown };
      return { ...routeOrigin, ...optimized, stops: optimized.stops.map((stop) => { const binId = String(stop.bin_id); const task = tasks.find((item) => item.bin_id === binId); return { ...stop, bin_name: task?.bin_name || fallbackBinNames[binId] || binId, address: task?.address ?? '' }; }) };
    }
  } catch (error) { app.log.warn({ error }, 'AI route optimizer unavailable; using priority order'); }
  const orderedStops = stops.sort((a, b) => (b.fill_level - a.fill_level));
  return { ...routeOrigin, stops: orderedStops.map((stop, index) => ({ ...stop, sequence: index + 1, distance_from_previous_km: 0, location_available: stop.latitude !== null && stop.longitude !== null })), distance_to_first_km: 0, between_stops_distance_km: 0, outbound_distance_km: 0, return_distance_km: 0, total_distance_km: 0, estimated_minutes: orderedStops.length * 8, estimated_savings_percent: 0, algorithm: 'priority order fallback', unlocated_stops: orderedStops.filter((stop) => stop.latitude === null || stop.longitude === null).length };
});
app.post<{ Params: { id: string } }>('/api/dispatch/:id/close', async (request, reply) => {
  if (!await requireRole(request, reply, ['collector', 'superadmin'])) return;
  await db.update(dispatchTasks).set({ status: 'closed' }).where(eq(dispatchTasks.id, Number(request.params.id)));
  return { ok: true };
});

app.get('/api/admin/users', async (request, reply) => {
  if (!await requireRole(request, reply, ['superadmin'])) return;
  return db.select({ id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.createdAt }).from(user).orderBy(user.createdAt);
});

app.patch<{ Params: { id: string }; Body: { role: Role } }>('/api/admin/users/:id/role', async (request, reply) => {
  const session = await requireRole(request, reply, ['superadmin']); if (!session) return;
  const roles: Role[] = ['customer', 'collector', 'superadmin'];
  if (!request.body || !roles.includes(request.body.role)) return reply.code(400).send({ error: 'invalid role' });
  if (request.params.id === session.user.id) return reply.code(400).send({ error: 'you cannot change your own role' });
  const updated = await db.update(user).set({ role: request.body.role }).where(eq(user.id, request.params.id)).returning({ id: user.id });
  if (!updated.length) return reply.code(404).send({ error: 'user not found' });
  return { ok: true, user_id: updated[0].id, role: request.body.role };
});

app.post<{ Body: { name: string; email: string; password: string } }>('/api/admin/collectors', async (request, reply) => {
  if (!await requireRole(request, reply, ['superadmin'])) return;
  const name = request.body.name?.trim();
  const email = request.body.email?.trim().toLowerCase();
  const password = request.body.password ?? '';
  if (!name || name.length < 2) return reply.code(400).send({ error: 'collector name is required' });
  if (!email || !email.includes('@')) return reply.code(400).send({ error: 'enter a valid collector email' });
  if (password.length < 8) return reply.code(400).send({ error: 'collector password must be at least 8 characters' });

  try {
    const created = await auth.api.signUpEmail({
      headers: fromNodeHeaders(request.headers),
      body: { name, email, password },
    });
    await db.update(user).set({ role: 'collector' }).where(eq(user.email, email));
    const createdUser = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.createdAt }).from(user).where(eq(user.email, email)).limit(1);
    return { ok: true, user: createdUser[0] ?? { id: created.user.id, name, email, role: 'collector' as const } };
  } catch {
    return reply.code(409).send({ error: 'an account with this email already exists' });
  }
});

app.post<{ Body: { bin_id: string; name: string; address: string; latitude?: number | null; longitude?: number | null } }>('/api/admin/bins', async (request, reply) => {
  if (!await requireRole(request, reply, ['superadmin'])) return;
  const binId = typeof request.body?.bin_id === 'string' ? request.body.bin_id.trim() : '';
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const address = typeof request.body?.address === 'string' ? request.body.address.trim() : '';
  const latitude = request.body?.latitude ?? null;
  const longitude = request.body?.longitude ?? null;
  if (!binId || !name || !address) return reply.code(400).send({ error: 'bin ID, name, and address are required' });
  if ((latitude === null) !== (longitude === null)) return reply.code(400).send({ error: 'enter both coordinates or leave both blank' });
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return reply.code(400).send({ error: 'latitude must be between -90 and 90' });
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return reply.code(400).send({ error: 'longitude must be between -180 and 180' });
  const claimCode = generateClaimCode();
  try {
    await db.insert(bins).values({ binId, name, address, claimCode: hashClaimCode(claimCode), latitude, longitude });
  } catch {
    return reply.code(409).send({ error: 'bin already registered' });
  }
  return { ok: true, bin_id: binId, claim_code: claimCode };
});

app.listen({ port, host: '0.0.0.0' }).catch(error => { app.log.error(error); process.exit(1); });
