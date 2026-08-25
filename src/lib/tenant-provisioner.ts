import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";

import { pool } from "@/lib/drizzle";

const CORE_SQL = path.join(process.cwd(), "drizzle", "provision-schema.sql");
const TENANT_PLATFORM_SQL = path.join(
  process.cwd(),
  "drizzle",
  "tenant-platform-provision.sql",
);
const ROLE_CONTEXT_SQL = path.join(
  process.cwd(),
  "drizzle",
  "role-context-provision.sql",
);

const DEFAULT_ROLES = [
  {
    orgRole: "Admin",
    jobRole: "Admin",
    grantedPerms: [
      "READ",
      "WRITE",
      "UPDATE",
      "DELETE",
      "MANAGE_USERS",
      "ALL_ACCESS",
    ],
    description: "Super Administrator with ALL PERMS",
  },
  {
    orgRole: "Manager",
    jobRole: "Manager",
    grantedPerms: ["READ", "WRITE", "UPDATE"],
    description: "Common Manager level user",
  },
  {
    orgRole: "Assistant-Manager",
    jobRole: "Assistant-Manager",
    grantedPerms: ["READ", "WRITE", "UPDATE"],
    description: "Common Assistant-Manager level user",
  },
] as const;

export type ProvisionCompanyInput = {
  companyName: string;
  schemaName: string;
  officeAddress: string;
  contactNumber: string;
  companyEmail?: string | null;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

async function runSqlFile(client: PoolClient, filePath: string) {
  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Missing provisioning SQL: ${filePath}`);
  }

  const statements = contents
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.query(statement);
  }
}

async function assertControlPlaneInstalled(client: PoolClient) {
  const result = await client.query<{ fn: string | null }>(`
    SELECT to_regprocedure(
      'brixta_control.register_organization(text,text,text,text,text,text,text)'
    )::text AS fn
  `);

  if (!result.rows[0]?.fn) {
    throw new Error(
      "BRIXTA public control plane is not installed. Run drizzle/public-control-plane-bootstrap.sql once in Supabase SQL Editor.",
    );
  }
}

export async function provisionCompany(input: ProvisionCompanyInput) {
  const client = await pool.connect();

  try {
    await assertControlPlaneInstalled(client);

    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '60000ms'");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`brixta:tenant:${input.schemaName}`],
    );

    const existing = await client.query(
      `SELECT id FROM public.organizations WHERE schema_name = $1 LIMIT 1`,
      [input.schemaName],
    );
    if (existing.rowCount) {
      throw new Error("That company code is already taken.");
    }

    const orphanSchema = await client.query(
      `SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1`,
      [input.schemaName],
    );
    if (orphanSchema.rowCount) {
      throw new Error(
        `Schema "${input.schemaName}" already exists but is not registered as a BRIXTA organization. Inspect schema_registry before continuing.`,
      );
    }

    await client.query(
      `CREATE SCHEMA "${input.schemaName}" AUTHORIZATION CURRENT_USER`,
    );

    await client.query(
      `SET LOCAL search_path TO "${input.schemaName}", public`,
    );

    await runSqlFile(client, CORE_SQL);
    await runSqlFile(client, TENANT_PLATFORM_SQL);
    // V3: Role Context + desired device runtime state.
    await runSqlFile(client, ROLE_CONTEXT_SQL);

    const roleIds = new Map<string, number>();
    for (const role of DEFAULT_ROLES) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO roles(org_role, job_role, granted_perms, perm_description)
         VALUES ($1, $2, $3::text[], $4)
         RETURNING id`,
        [
          role.orgRole,
          role.jobRole,
          [...role.grantedPerms],
          role.description,
        ],
      );
      roleIds.set(role.orgRole, result.rows[0].id);
    }

    const adminRoleId = roleIds.get("Admin");
    if (!adminRoleId) {
      throw new Error("Admin role was not created during provisioning.");
    }

    const admin = await client.query<{ id: number }>(
      `INSERT INTO users(
        email,
        username,
        display_name,
        role,
        status,
        is_dashboard_user,
        dashboard_login_id,
        dashboard_hashed_password,
        is_sales_app_user
      )
      VALUES ($1,$2,$3,'Admin','active',true,$1,$4,false)
      RETURNING id`,
      [
        input.adminEmail.trim(),
        input.adminName.trim(),
        input.adminName.trim(),
        input.adminPassword,
      ],
    );

    await client.query(
      `INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2)`,
      [admin.rows[0].id, adminRoleId],
    );

    await client.query(`SET LOCAL search_path TO public`);

    const registered = await client.query<{
      organization_id: number;
      account_id: number;
    }>(
      `SELECT *
         FROM brixta_control.register_organization(
           $1,$2,$3,$4,$5,$6,$7
         )`,
      [
        input.companyName.trim(),
        input.schemaName,
        input.contactNumber.trim(),
        input.companyEmail?.trim() ?? "",
        input.officeAddress.trim(),
        input.adminName.trim(),
        input.adminEmail.trim(),
      ],
    );

    await client.query("COMMIT");

    return {
      organizationId: registered.rows[0].organization_id,
      accountId: registered.rows[0].account_id,
      schemaName: input.schemaName,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // If BEGIN itself failed, there may be nothing to roll back.
    }
    throw error;
  } finally {
    client.release();
  }
}
