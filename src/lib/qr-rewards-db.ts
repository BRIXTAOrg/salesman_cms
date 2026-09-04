import "server-only";

import {
  sql,
} from "drizzle-orm";

import type {
  AppDatabase,
} from "@/lib/drizzle";

export const QR_REWARDS_SCHEMA_VERSION =
  1;

export async function qrRewardsSchemaStatus(
  db: AppDatabase,
) {
  const table =
    await db.execute(sql`
      SELECT
        to_regclass(
          'qr_rewards_meta'
        )::text AS table_name
    `);

  const tableName =
    (
      table.rows[0] as
        | {
            table_name?: unknown;
          }
        | undefined
    )?.table_name;

  if (!tableName) {
    return {
      ready: false,
      version: null,
    } as const;
  }

  const result =
    await db.execute(sql`
      SELECT value
      FROM qr_rewards_meta
      WHERE key = 'schema_version'
      LIMIT 1
    `);

  const raw =
    (
      result.rows[0] as
        | {
            value?: unknown;
          }
        | undefined
    )?.value;

  const version =
    Number(raw ?? NaN);

  return {
    ready:
      Number.isFinite(version) &&
      version >=
        QR_REWARDS_SCHEMA_VERSION,

    version:
      Number.isFinite(version)
        ? version
        : null,
  };
}
