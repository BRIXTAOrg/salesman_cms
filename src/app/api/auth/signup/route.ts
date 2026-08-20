import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql, eq } from "drizzle-orm";

import {
  db,
  pool,
  withTenantSchema,
  type AppDatabase,
} from "@/lib/drizzle";

import {
  users,
  roles,
  userRoles,
} from "../../../../../drizzle/schema";

import {
  organizationEntitlements,
  organizations,
} from "../../../../../drizzle/publicSchema";

import { ENTITLEMENT_KEYS } from "@/lib/entitlements";

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

const CORE_PROVISION_SQL_PATH = path.join(
  process.cwd(),
  "drizzle",
  "provision-schema.sql",
);

const WORKFLOW_PROVISION_SQL_PATH = path.join(
  process.cwd(),
  "drizzle",
  "workflow-provision.sql",
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
    permDescription: "Super Administrator with ALL PERMS",
  },
  {
    orgRole: "Manager",
    jobRole: "Manager",
    grantedPerms: ["READ", "WRITE", "UPDATE"],
    permDescription: "Common Manager level user",
  },
  {
    orgRole: "Assistant-Manager",
    jobRole: "Assistant-Manager",
    grantedPerms: ["READ", "WRITE", "UPDATE"],
    permDescription: "Common Assistant-Manager level user",
  },
];

/**
 * A new BRIXTA tenant starts as a blank platform workspace.
 *
 * We deliberately do NOT seed Attendance, Leave, Journey Plan, Dealer, etc.
 * A tenant manufactures its application by defining Responsibilities and
 * connecting them with Workflows.
 *
 * Existing tenants keep their existing public entitlement rows unchanged.
 */
const DEFAULT_ENTITLEMENTS = [
  {
    featureKey: ENTITLEMENT_KEYS.RESPONSIBILITY_CREATE,
    enabled: true,
  },
  {
    featureKey: ENTITLEMENT_KEYS.WORKFLOW_CUSTOMIZE,
    enabled: true,
  },
];

async function runSqlFile(
  tx: AppDatabase,
  filePath: string,
) {
  let fileContents: string;

  try {
    fileContents = await readFile(filePath, "utf8");
  } catch {
    throw new Error(
      `Missing provisioning SQL: ${filePath}`,
    );
  }

  const statements = fileContents
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await tx.execute(sql.raw(statement));
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    companyName,
    schemaName: rawSchemaName,
    officeAddress,
    contactNumber,
    companyEmail,
    adminName,
    adminEmail,
    adminPassword,
  } = body;

  if (
    !companyName ||
    !rawSchemaName ||
    !officeAddress ||
    !contactNumber ||
    !adminName ||
    !adminEmail ||
    !adminPassword
  ) {
    return NextResponse.json(
      {
        error:
          "Company name, code, office address, contact number, and admin details are required.",
      },
      { status: 400 },
    );
  }

  const schemaName = String(rawSchemaName)
    .trim()
    .toLowerCase();

  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    return NextResponse.json(
      {
        error:
          "Company code must start with a letter and contain only lowercase letters, numbers and underscores.",
      },
      { status: 400 },
    );
  }

  if (String(adminPassword).length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.schemaName, schemaName))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "That company code is already taken." },
      { status: 409 },
    );
  }

  let schemaCreated = false;

  try {
    // 1. Physical tenant schema.
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    // 2. Build the tenant substrate.
    await withTenantSchema(
      schemaName,
      async (tx) => {
        /**
         * `provision-schema.sql` remains the repository's physical baseline
         * for this transition. It still contains historical tables so we do
         * not accidentally produce destructive Drizzle migrations for old
         * tenants. They are inert: Platform Core does not seed or expose the
         * old business applications.
         */
        await runSqlFile(
          tx,
          CORE_PROVISION_SQL_PATH,
        );

        // Workflow tables are provisioned after users/roles/capabilities.
        await runSqlFile(
          tx,
          WORKFLOW_PROVISION_SQL_PATH,
        );

        const insertedRoles = await tx
          .insert(roles)
          .values(DEFAULT_ROLES)
          .returning();

        const adminRole = insertedRoles.find(
          (role) => role.orgRole === "Admin",
        );

        if (!adminRole) {
          throw new Error(
            "Admin role was not created during provisioning.",
          );
        }

        // No domain-specific Responsibilities are seeded here.
        // The first admin creates the tenant's actual work model in CMS.

        /**
         * NOTE:
         * This retains the repository's current dashboard-password storage
         * behavior so existing dashboard identities remain compatible.
         * Password hashing migration must be handled separately for all
         * existing tenant rows, not silently during this platform refactor.
         */
        const [adminUser] = await tx
          .insert(users)
          .values({
            email: String(adminEmail).trim(),
            username: String(adminName).trim(),
            displayName: String(adminName).trim(),
            role: adminRole.orgRole ?? "Admin",
            status: "active",
            isDashboardUser: true,
            dashboardLoginId: String(adminEmail).trim(),
            dashboardHashedPassword: String(adminPassword),
            isSalesAppUser: false,
          })
          .returning();

        await tx.insert(userRoles).values({
          userId: adminUser.id,
          roleId: adminRole.id,
        });
      },
    );

    // 3. Register tenant + platform-authoring entitlements atomically in public.
    await db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: String(companyName).trim(),
          schemaName,
          phoneNumber: String(contactNumber).trim(),
          email: companyEmail
            ? String(companyEmail).trim()
            : null,
          officeAddress: String(officeAddress).trim(),
          adminName: String(adminName).trim(),
          adminEmail: String(adminEmail).trim(),
          isProvisioned: true,
        })
        .returning({
          id: organizations.id,
        });

      await tx
        .insert(organizationEntitlements)
        .values(
          DEFAULT_ENTITLEMENTS.map(
            (entitlement) => ({
              organizationId: organization.id,
              featureKey: entitlement.featureKey,
              enabled: entitlement.enabled,
              source: "signup_default",
            }),
          ),
        );
    });

    return NextResponse.json(
      {
        message: "Company created",
        schemaName,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);

    if (schemaCreated) {
      try {
        await pool.query(
          `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
      } catch (cleanupError) {
        console.error(
          "Signup cleanup failed:",
          cleanupError,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create company.",
      },
      { status: 500 },
    );
  }
}
