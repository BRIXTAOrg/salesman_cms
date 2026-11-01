import "server-only";

import { pool } from "@/lib/drizzle";

async function assertControlPlane() {
  const result = await pool.query<{ fn: string | null }>(`
    SELECT to_regprocedure(
      'brixta_control.claim_account_for_email(text,text)'
    )::text AS fn
  `);

  if (!result.rows[0]?.fn) {
    throw new Error(
      "BRIXTA public control plane is not installed. Run drizzle/public-control-plane-bootstrap.sql once.",
    );
  }
}

export async function ensureAccountSubstrate() {
  await assertControlPlane();
}

export async function resolveOrCreateAccountForEmail(
  email: string,
  suggestedName: string,
) {
  await assertControlPlane();

  const result = await pool.query<{ account_id: number }>(
    `SELECT brixta_control.claim_account_for_email($1,$2) AS account_id`,
    [email.trim().toLowerCase(), suggestedName.trim() || "BRIXTA Account"],
  );

  return result.rows[0].account_id;
}

export async function claimCurrentOrganizationsForEmail(
  email: string,
  suggestedName = "BRIXTA Account",
) {
  return resolveOrCreateAccountForEmail(email, suggestedName);
}

export async function listOrganizationsForAccountEmail(email: string) {
  await claimCurrentOrganizationsForEmail(email);

  const result = await pool.query<{
    id: number;
    name: string;
    schema_name: string;
    is_provisioned: boolean;
    platform_version: number;
    registry_status: string;
  }>(
    `SELECT *
       FROM brixta_control.list_organizations_for_email($1)`,
    [email.trim().toLowerCase()],
  );

  // Resolve codes for companies visible to this account. This query works
  // both before and after the optional login_code column is migrated.
  const ids = result.rows.map(row => row.id);
  const aliases = ids.length ? await pool.query<{ id: number; company_code: string }>(
    `SELECT o.id, coalesce(to_jsonb(o)->>'login_code',o.schema_name) AS company_code
       FROM public.organizations o WHERE o.id = ANY($1::integer[])`, [ids],
  ) : { rows: [] as Array<{id:number;company_code:string}> };
  const byId = new Map(aliases.rows.map(row => [row.id, row.company_code]));
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    schemaName: row.schema_name,
    companyCode: byId.get(row.id) ?? row.schema_name,
    isProvisioned: row.is_provisioned,
    platformVersion: row.platform_version,
    registryStatus: row.registry_status,
  }));
}

export async function findOrganizationForAccountEmail(
  email: string,
  organizationId: number,
) {
  await claimCurrentOrganizationsForEmail(email);

  const result = await pool.query<{
    id: number;
    name: string;
    schema_name: string;
  }>(
    `SELECT *
       FROM brixta_control.find_organization_for_email($1,$2)`,
    [email.trim().toLowerCase(), organizationId],
  );

  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        schemaName: row.schema_name,
      }
    : null;
}
