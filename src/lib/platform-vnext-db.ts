import "server-only";

import { sql } from "drizzle-orm";

import type { AppDatabase } from "@/lib/drizzle";

export const TENANT_PLATFORM_VERSION = 2;

/**
 * Runtime guard only. Provisioning/migrations create tables.
 * Normal requests do not execute CREATE TABLE IF NOT EXISTS repeatedly.
 */
export async function ensureTenantPlatformVNext(db: AppDatabase) {
  const result = await db.execute(sql`
    SELECT value
    FROM platform_meta
    WHERE key = 'tenant_platform_version'
    LIMIT 1
  `);

  const row = result.rows[0] as { value?: unknown } | undefined;
  const raw = row?.value;
  const version =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : Number(raw ?? NaN);

  if (!Number.isFinite(version) || version < TENANT_PLATFORM_VERSION) {
    throw new Error(
      `Tenant platform is not ready. Expected v${TENANT_PLATFORM_VERSION}. Run the tenant upgrader.`,
    );
  }
}
