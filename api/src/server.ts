import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import { db, pool } from './db/index.js';
import { bins, readings, dispatchTasks } from './db/schema.js';
import { and, desc, eq, sql } from 'drizzle-orm';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8000);
const apiKey = process.env.API_KEY ?? 'change-me';
const aiUrl = process.env.AI_SERVICE_URL ?? 'http://ai-service:9000';

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
  await db.insert(bins).values({ binId: t.bin_id, claimCode: 'unregistered', createdAt: new Date(created) }).onConflictDoNothing();
  await db.insert(readings).values({ binId: t.bin_id, fillLevel: t.fill_level, lidOpen: Boolean(t.lid_open), wifiRssi: t.wifi_rssi ?? 0, createdAt: new Date(created) });
  const prediction = await predict(t.fill_level, t.bin_id);
  if (prediction.priority === 'urgent' || prediction.priority === 'high') await db.insert(dispatchTasks).values({ binId: t.bin_id, priority: prediction.priority, status: 'open', reason: prediction.reason, createdAt: new Date(created) });
  return { ok: true, bin_id: t.bin_id, prediction };
});

app.get('/api/me', async (request, reply) => { const session = await requireUser(request, reply); return session ?? null; });

app.post<{ Body: { bin_id: string; claim_code: string } }>('/api/bins/claim', async (request, reply) => {
  const session = await requireUser(request, reply); if (!session) return;
  const row = await db.select().from(bins).where(eq(bins.binId, request.body.bin_id)).limit(1);
  if (!row[0] || row[0].claimCode !== request.body.claim_code) return reply.code(400).send({ error: 'invalid bin or claim code' });
  if (row[0].ownerUserId && row[0].ownerUserId !== session.user.id) return reply.code(409).send({ error: 'bin already linked' });
  await db.update(bins).set({ ownerUserId: session.user.id }).where(eq(bins.binId, request.body.bin_id)); return { ok: true, bin_id: request.body.bin_id };
});

app.get('/api/bins', async (request, reply) => {
  const session = await requireUser(request, reply); if (!session) return;
  const owned = await db.select().from(bins).where(eq(bins.ownerUserId, session.user.id));
  const result = [];
  for (const bin of owned) { const latest = await db.select().from(readings).where(eq(readings.binId, bin.binId)).orderBy(desc(readings.createdAt)).limit(1); if (latest[0]) result.push({ ...latest[0], bin_id: bin.binId, fill_level: latest[0].fillLevel, priority: fallback(latest[0].fillLevel).priority }); }
  return result.sort((a,b) => b.fill_level-a.fill_level);
});

app.get('/api/dispatch', async (request, reply) => { const session = await requireUser(request, reply); if (!session) return; return db.select().from(dispatchTasks).innerJoin(bins, eq(dispatchTasks.binId, bins.binId)).where(and(eq(dispatchTasks.status, 'open'), eq(bins.ownerUserId, session.user.id))).orderBy(desc(dispatchTasks.createdAt)); });
app.post<{ Params: { id: string } }>('/api/dispatch/:id/close', async (request, reply) => { if (!await requireUser(request, reply)) return; await db.update(dispatchTasks).set({ status: 'closed' }).where(eq(dispatchTasks.id, Number(request.params.id))); return { ok: true }; });

app.listen({ port, host: '0.0.0.0' }).catch(error => { app.log.error(error); process.exit(1); });
