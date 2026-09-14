import { pgTable, serial, varchar, real, boolean, integer, timestamp, text, uniqueIndex } from 'drizzle-orm/pg-core';

export * from './auth-schema.js';

export const bins = pgTable('bins', { id: serial('id').primaryKey(), binId: varchar('bin_id', { length: 64 }).notNull().unique(), claimCode: varchar('claim_code', { length: 128 }).notNull(), ownerUserId: varchar('owner_user_id', { length: 64 }), latitude: real('latitude'), longitude: real('longitude'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (table) => ({ ownerIdx: uniqueIndex('bins_owner_bin_idx').on(table.ownerUserId, table.binId) }));
export const readings = pgTable('readings', { id: serial('id').primaryKey(), binId: varchar('bin_id', { length: 64 }).notNull(), fillLevel: real('fill_level').notNull(), lidOpen: boolean('lid_open').default(false).notNull(), wifiRssi: integer('wifi_rssi').default(0).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() });
export const dispatchTasks = pgTable('dispatch_tasks', { id: serial('id').primaryKey(), binId: varchar('bin_id', { length: 64 }).notNull(), priority: varchar('priority', { length: 16 }).notNull(), status: varchar('status', { length: 16 }).default('open').notNull(), reason: text('reason').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() });
export const appSchema = { bins, readings, dispatchTasks };
