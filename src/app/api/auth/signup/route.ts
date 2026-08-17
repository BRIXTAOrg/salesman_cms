// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql, eq } from 'drizzle-orm';
import { db, pool, withTenantSchema, type AppDatabase } from '@/lib/drizzle';
import { users, roles, userRoles, mobileCapabilities } from '../../../../../drizzle/schema';
import { organizations } from '../../../../../drizzle/publicSchema';

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

// Generated fresh via `npx drizzle-kit generate` against the current
// (schema-less) schema.ts + applianceSchema.ts. Statements are separated
// by drizzle-kit's own "--> statement-breakpoint" marker.
const PROVISION_SQL_PATH = path.join(
  process.cwd(),
  'drizzle',
  'provision-schema.sql',
);

const DEFAULT_CAPABILITIES = [
  {
    key: 'attendance',
    title: 'Attendance',
    type: 'native',
    description: 'Check in / check out',
    icon: 'clock',
  },
  {
    key: 'dealer_visit',
    title: 'Dealer Visit',
    type: 'form',
    description: 'Record a dealer visit',
    icon: 'map-pin',
    config: {
      fields: [
        { key: 'notes', label: 'Notes', type: 'textarea', required: false },
        { key: 'photo', label: 'Photo', type: 'photo', required: true },
      ],
    },
  },
  {
    key: 'leave',
    title: 'Leave',
    type: 'form',
    description: 'Request time off',
    icon: 'calendar',
    config: {
      fields: [
        { key: 'reason', label: 'Reason', type: 'textarea', required: true },
      ],
    },
  },
];

async function runProvisionSql(tx: AppDatabase) {
  let fileContents: string;

  try {
    fileContents = await readFile(PROVISION_SQL_PATH, 'utf8');
  } catch {
    throw new Error(
      `Missing ${PROVISION_SQL_PATH}. Generate it with "npx drizzle-kit generate" ` +
        'against the current schema.ts before company signup can run.',
    );
  }

  const statements = fileContents
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await tx.execute(sql.raw(statement));
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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
      { error: 'Company name, code, office address, contact number, and admin details are required.' },
      { status: 400 },
    );
  }

  const schemaName = String(rawSchemaName).trim().toLowerCase();

  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    return NextResponse.json(
      { error: 'Company code must start with a letter and contain only lowercase letters, numbers and underscores.' },
      { status: 400 },
    );
  }

  if (String(adminPassword).length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  // 1. Reserve the schema name. Checked against public.organizations
  // first (cheap, friendly error) -- the schema's own unique index is the
  // real guard against a race between two concurrent signups.
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.schemaName, schemaName))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: 'That company code is already taken.' }, { status: 409 });
  }

  let schemaCreated = false;

  try {
    // 2. Create the schema itself. Deliberately a plain pool query, not
    // inside withTenantSchema -- search_path can't usefully point at a
    // schema that doesn't exist yet.
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    // 3. Build every table inside it, then seed defaults, all inside one
    // transaction with search_path locked to the new schema.
    await withTenantSchema(schemaName, async (tx) => {
      await runProvisionSql(tx);

      const [adminRole] = await tx
        .insert(roles)
        .values({
          orgRole: 'Admin',
          jobRole: 'Administrator',
          grantedPerms: ['ALL_ACCESS'],
          permDescription: 'Full system access',
        })
        .returning();

      await tx.insert(mobileCapabilities).values(
        DEFAULT_CAPABILITIES.map((capability) => ({
          key: capability.key,
          title: capability.title,
          type: capability.type,
          description: capability.description,
          icon: capability.icon,
          config: capability.config ?? {},
          isActive: true,
        })),
      );

      const [adminUser] = await tx
        .insert(users)
        .values({
          email: String(adminEmail).trim(),
          username: String(adminName).trim(),
          displayName: String(adminName).trim(),
          role: 'ADMIN',
          status: 'active',
          isDashboardUser: true,
          dashboardLoginId: String(adminEmail).trim(),
          // NOTE: matches the existing (plaintext) comparison in
          // app/api/auth/login/route.ts -- not actually hashed despite
          // the column name. Pre-existing behavior, not something this
          // signup route introduces.
          dashboardHashedPassword: String(adminPassword),
          isSalesAppUser: false,
        })
        .returning();

      await tx.insert(userRoles).values({
        userId: adminUser.id,
        roleId: adminRole.id,
      });
    });

    // 4. Register the tenant. Last step, deliberately -- a company only
    // becomes "real" (loggable-into) once provisioning fully succeeded.
    await db.insert(organizations).values({
      name: String(companyName).trim(),
      schemaName,
      phoneNumber: String(contactNumber).trim(),
      email: companyEmail ? String(companyEmail).trim() : null,
      officeAddress: String(officeAddress).trim(),
    });

    return NextResponse.json({
      message: 'Company created',
      schemaName,
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);

    // Best-effort cleanup so a failed signup doesn't leave an orphaned,
    // half-built schema with no registry row pointing at it.
    if (schemaCreated) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } catch (cleanupError) {
        console.error('Signup cleanup failed:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create company.' },
      { status: 500 },
    );
  }
}