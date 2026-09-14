import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromNodeHeaders } from 'better-auth/node';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { auth } from './auth.js';
import { db, pool } from './db/index.js';
import { bins, readings, dispatchTasks, user } from './db/schema.js';
import { and, desc, eq } from 'drizzle-orm';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8000);
const apiKey = process.env.API_KEY ?? 'change-me';
const aiUrl = process.env.AI_SERVICE_URL ?? 'http://ai-service:9000';
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

type Telemetry = { api_key: string; bin_id: string; fill_level: number; lid_open?: boolean; wifi_rssi?: number };
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: path.join(root, '..', 'public'), prefix: '/' });

app.route({ method: ['GET', 'POST'], url: '/api/auth/*', async handler(request, reply) {
  const url = new URL(request.url, `${process.env.AUTH_URL ?? 'http://localhost:8000'}`);
  const req = new Request(url, { method: request.method, headers: fromNodeHeaders(request.headers), ...(request.body ? { body: JSON.stringify(request.body) } : {}) });
  const response = await auth.handler(req);
  reply.status(response.status); response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(response.body ? await response.text() : null);
}});

async function requireUser(request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<any> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return reply.code(401).send({ error: 'authentication required' });
  const role = configuredRole(session.user.email) ?? (await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1))[0]?.role ?? 'customer';
  if (role !== (session.user as { role?: string }).role) await db.update(user).set({ role }).where(eq(user.id, session.user.id));
  return { ...session, user: { ...session.user, role } };
}

type Role = 'customer' | 'collector' | 'superadmin';

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
  const row = await db.select().from(bins).where(eq(bins.binId, request.body.bin_id)).limit(1);
  if (!row[0] || row[0].claimCode !== request.body.claim_code) return reply.code(400).send({ error: 'invalid bin or claim code' });
  if (row[0].ownerUserId && row[0].ownerUserId !== session.user.id) return reply.code(409).send({ error: 'bin already linked' });
  await db.update(bins).set({ ownerUserId: session.user.id }).where(eq(bins.binId, request.body.bin_id)); return { ok: true, bin_id: request.body.bin_id };
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
    result.push({ bin_id: bin.binId, fill_level: latest[0]?.fillLevel ?? 0, lid_open: latest[0]?.lidOpen ?? false, wifi_rssi: latest[0]?.wifiRssi ?? 0, last_seen: latest[0]?.createdAt?.toISOString() ?? null, priority: fallback(latest[0]?.fillLevel ?? 0).priority, owner_name: owner[0]?.name ?? null, owner_email: owner[0]?.email ?? null });
  }
  return result.sort((a,b) => b.fill_level-a.fill_level);
});

app.get('/api/dispatch', async (request, reply) => {
  const session = await requireUser(request, reply); if (!session) return;
  const filter = session.user.role === 'customer' ? and(eq(dispatchTasks.status, 'open'), eq(bins.ownerUserId, session.user.id)) : eq(dispatchTasks.status, 'open');
  return db.select({ id: dispatchTasks.id, bin_id: bins.binId, priority: dispatchTasks.priority, reason: dispatchTasks.reason, status: dispatchTasks.status, owner_name: user.name, owner_email: user.email }).from(dispatchTasks).innerJoin(bins, eq(dispatchTasks.binId, bins.binId)).leftJoin(user, eq(bins.ownerUserId, user.id)).where(filter).orderBy(desc(dispatchTasks.createdAt));
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
  if (!roles.includes(request.body.role)) return reply.code(400).send({ error: 'invalid role' });
  if (request.params.id === session.user.id) return reply.code(400).send({ error: 'you cannot change your own role' });
  await db.update(user).set({ role: request.body.role }).where(eq(user.id, request.params.id));
  return { ok: true };
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

app.post<{ Body: { bin_id: string; claim_code: string } }>('/api/admin/bins', async (request, reply) => {
  if (!await requireRole(request, reply, ['superadmin'])) return;
  const binId = request.body.bin_id.trim();
  const claimCode = request.body.claim_code.trim();
  if (!binId || !claimCode) return reply.code(400).send({ error: 'bin id and claim code are required' });
  try {
    await db.insert(bins).values({ binId, claimCode });
  } catch {
    return reply.code(409).send({ error: 'bin already registered' });
  }
  return { ok: true, bin_id: binId };
});

app.listen({ port, host: '0.0.0.0' }).catch(error => { app.log.error(error); process.exit(1); });
