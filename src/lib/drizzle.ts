// src/lib/drizzle.ts

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle";

// Guard: env must exist
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export type AppDatabase = NodePgDatabase<typeof schema>;

// Prevent duplicate pools in dev
const globalForDb = globalThis as unknown as {
  __PG_POOL__?: Pool;
  __DRIZZLE_DB__?: AppDatabase;
};

const pool =
  globalForDb.__PG_POOL__ ??
  new Pool({
    connectionString: DATABASE_URL,

    ssl: false,

    max: 30,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15000, 
  });

const db: AppDatabase =
  globalForDb.__DRIZZLE_DB__ ??
  drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__PG_POOL__ = pool;
  globalForDb.__DRIZZLE_DB__ = db;
}

/**
 * CMS equivalent of the backend's withTenantSchema (src/db/db.ts) -- same
 * reasoning applies: SET LOCAL inside a transaction so search_path can't
 * leak between requests sharing pooled connections. Every CMS route that
 * queries a tenant table (dealerManagement, usersAndTeam, attendance,
 * etc.) should go through this instead of importing `db` directly.
 */
export async function withTenantSchema<T>(
  schemaName: string,
  callback: (tx: AppDatabase) => Promise<T>,
): Promise<T> {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }

  const client = await pool.connect();
  let settled = false;

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO "${schemaName}", public`);

    const tx = drizzle(client, { schema }) as AppDatabase;
    const result = await callback(tx);

    await client.query("COMMIT");
    settled = true;
    client.release();
    return result;
  } catch (error) {
    if (settled) {
      throw error;
    }

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Rollback failed (connection likely already dead):",
        rollbackError,
      );
    }

    // Release WITH the error so pg discards this connection instead of
    // returning it to the idle pool -- see src/db/db.ts in the backend
    // repo for the full explanation of why this matters.
    client.release(error as Error);
    throw error;
  }
}

export { db, pool, schema };