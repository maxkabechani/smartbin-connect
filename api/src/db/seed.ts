import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { seed } from 'drizzle-seed';
import { bins, readings, dispatchTasks } from './schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
await seed(db, { bins, readings, dispatchTasks }).refine((f) => ({
  bins: { count: 4, columns: { binId: f.valuesFromArray({ values: ['BIN-01','BIN-02','BIN-03','BIN-04'] }), claimCode: f.valuesFromArray({ values: ['smartbin-demo','claim-02','claim-03','claim-04'] }), ownerUserId: f.default({ defaultValue: null }) } },
  readings: { count: 20, columns: { binId: f.valuesFromArray({ values: ['BIN-01','BIN-02','BIN-03','BIN-04'] }), fillLevel: f.number({ minValue: 10, maxValue: 98, precision: 0 }), lidOpen: f.boolean(), wifiRssi: f.number({ minValue: -80, maxValue: -35, precision: 0 }) } },
  dispatchTasks: { count: 2, columns: { binId: f.valuesFromArray({ values: ['BIN-01','BIN-02'] }), priority: f.valuesFromArray({ values: ['high','urgent'] }), status: f.valuesFromArray({ values: ['open'] }), reason: f.valuesFromArray({ values: ['near full','critical fill level'] }) } }
}));
await pool.end(); console.log('Seeded SmartBin demo data');
