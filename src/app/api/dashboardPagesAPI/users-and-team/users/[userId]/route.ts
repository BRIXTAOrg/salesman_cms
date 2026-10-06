// src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { withTenantDb, hasPermission, liveDashboardAccess, type AppDatabase } from '@/lib/auth';
import { users, roles as rolesTable, userRoles } from '../../../../../../../drizzle/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  generatePassword,
  hashPassword,
  withoutSecrets,
} from '@/lib/password';

const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().optional(),
  orgRole: z.string().optional(),
  jobRole: z.union([z.string(), z.array(z.string())]).optional(),
  role: z.string().optional(),
  area: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isDashboardUser: z.boolean().optional(),
  isSalesAppUser: z.boolean().optional(),
  clearDevice: z.boolean().optional(),
  resetDashboardPassword: z.boolean().optional(),
}).strict();

type RouteContext = { params: Promise<{ userId: string }> };

/*
 * BRIXTA_ADMIN_LOCKOUT_GUARD_V1
 * Nobody can switch off their own dashboard access, and a company always
 * keeps at least one active person with full access.
 */
async function activeAdminCount(db: AppDatabase) {
  const result = await db.execute(sql`
    SELECT count(DISTINCT u.id)::int AS count
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
     WHERE u.status = 'active'
       AND u.is_dashboard_user = true
       AND 'ALL_ACCESS' = ANY(r.granted_perms)
  `);
  const row = result.rows[0] as { count?: number | string } | undefined;
  return Number(row?.count ?? 0);
}

export const PUT = withTenantDb<RouteContext>(async (request, db, session, context) => {
  try {
    const { userId } = await context.params;
    const targetUserLocalId = parseInt(userId);

    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // hasPermission check happens via withTenantDb's auth, but permission
    // level (UPDATE/WRITE) still needs its own check per route:
    if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = updateUserSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid body', errors: parsedBody.error.format() }, { status: 400 });
    }

    const {
      orgRole, jobRole, area, zone, phoneNumber, clearDevice,
      isDashboardUser, isSalesAppUser, resetDashboardPassword,
      ...standardData
    } = parsedBody.data;

    const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean) as string[];

    const targetUserResult = await db.select().from(users).where(eq(users.id, targetUserLocalId)).limit(1);
    const targetUser = targetUserResult[0];

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isSelf = targetUserLocalId === session.userId;
    if (isSelf && isDashboardUser === false) {
      return NextResponse.json(
        {
          code: 'SELF_LOCKOUT',
          error: "You can't remove your own dashboard access. Ask another admin to do it.",
        },
        { status: 400 },
      );
    }

    const adminsBefore = await activeAdminCount(db);
    await db.execute(sql`SAVEPOINT brixta_user_update`);

    // No nested db.transaction(): db is already inside the transaction
    // withTenantDb opened, so everything below is already atomic within
    // it. A second .transaction() here would issue a redundant BEGIN on
    // an already-open transaction and its COMMIT would end the outer one
    // early -- breaking the search_path scoping for anything after it.

    const drizzleUpdateData: any = {
      ...standardData,
      role: orgRole || jobRole,
      area: area !== undefined ? area : targetUser.area,
      zone: zone !== undefined ? zone : targetUser.zone,
      phoneNumber: phoneNumber !== undefined ? phoneNumber : targetUser.phoneNumber,
      deviceId: clearDevice === true ? null : targetUser.deviceId,
    };

    if (orgRole !== undefined) {
      drizzleUpdateData.role = orgRole;
    }

    const generatedCreds: any = {};

    // --- LOGIC A: Dashboard access ---
    // BRIXTA_PASSWORD_SECURITY_V1: passwords are random, stored as hashes and
    // shown exactly once. A stored password is never sent back to the CMS.
    if (isDashboardUser === true && !targetUser.dashboardHashedPassword) {
      const dashPassword = generatePassword();

      drizzleUpdateData.isDashboardUser = true;
      drizzleUpdateData.dashboardLoginId = standardData.email || targetUser.email;
      drizzleUpdateData.dashboardHashedPassword = await hashPassword(dashPassword);
      generatedCreds.dashboardEmail = drizzleUpdateData.dashboardLoginId;
      generatedCreds.dashboardPassword = dashPassword;
    } else if (isDashboardUser === true && targetUser.dashboardHashedPassword) {
      // Re-enabling someone who already has a login: their existing
      // password keeps working. Use resetDashboardPassword for a new one.
      drizzleUpdateData.isDashboardUser = true;
      generatedCreds.dashboardEmail = targetUser.dashboardLoginId ?? targetUser.email;
      generatedCreds.passwordUnchanged = true;
    } else if (isDashboardUser !== undefined) {
      drizzleUpdateData.isDashboardUser = isDashboardUser;
    }

    if (resetDashboardPassword === true) {
      if (!targetUser.isDashboardUser && isDashboardUser !== true) {
        return NextResponse.json(
          { error: 'Turn on dashboard access before resetting the password.' },
          { status: 400 },
        );
      }

      const dashPassword = generatePassword();
      const loginId =
        drizzleUpdateData.dashboardLoginId ??
        targetUser.dashboardLoginId ??
        standardData.email ??
        targetUser.email;

      drizzleUpdateData.dashboardLoginId = loginId;
      drizzleUpdateData.dashboardHashedPassword = await hashPassword(dashPassword);
      generatedCreds.dashboardEmail = loginId;
      generatedCreds.dashboardPassword = dashPassword;
      delete generatedCreds.passwordUnchanged;
    }

    // --- LOGIC B: Sales App Upgrade ---
    if (isSalesAppUser === true && !targetUser.salesmanLoginId) {
      let isUnique = false;
      let newSalesmanId = '';
      while (!isUnique) {
        newSalesmanId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const existingSalesman = await db.select({ id: users.id }).from(users).where(eq(users.salesmanLoginId, newSalesmanId)).limit(1);
        if (!existingSalesman[0]) isUnique = true;
      }
      const newSalesmanPassword = generatePassword();

      // Stored only as a hash, matching the backend's bcrypt check.
      const newSalesmanPasswordHash = await hashPassword(newSalesmanPassword);

      drizzleUpdateData.isSalesAppUser = true;
      drizzleUpdateData.salesmanLoginId = newSalesmanId;
      drizzleUpdateData.salesAppPasswordHash = newSalesmanPasswordHash;
      drizzleUpdateData.salesAppPassword = null;
      generatedCreds.salesmanId = newSalesmanId;
      generatedCreds.salesmanPassword = newSalesmanPassword;
    } else if (isSalesAppUser !== undefined) {
      drizzleUpdateData.isSalesAppUser = isSalesAppUser;
    }

    if (jobRole !== undefined) {
      await db.delete(userRoles).where(eq(userRoles.userId, targetUserLocalId));

      if (jobRolesArray.length > 0) {
        const resolvedOrgRole = orgRole || '';
        const dbRoles = await db.select({ id: rolesTable.id })
           .from(rolesTable)
           .where(
              and(
                  eq(rolesTable.orgRole, resolvedOrgRole),
                  inArray(rolesTable.jobRole, jobRolesArray)
              )
           );

        if (dbRoles.length > 0) {
          await db.insert(userRoles).values(dbRoles.map(r => ({ userId: targetUserLocalId, roleId: r.id })));
        }
      }
    }

    const updated = await db.update(users).set(drizzleUpdateData).where(eq(users.id, targetUserLocalId)).returning();
    const updatedUser = updated[0];

    if (adminsBefore > 0 && (await activeAdminCount(db)) === 0) {
      await db.execute(sql`ROLLBACK TO SAVEPOINT brixta_user_update`);
      return NextResponse.json(
        {
          code: 'LAST_ADMIN',
          error: 'This is the last admin. Give someone else full access before changing this.',
        },
        { status: 400 },
      );
    }

    if (isSelf && !(await liveDashboardAccess(db, session.userId)).ok) {
      await db.execute(sql`ROLLBACK TO SAVEPOINT brixta_user_update`);
      return NextResponse.json(
        {
          code: 'SELF_LOCKOUT',
          error: 'This change would lock you out of the dashboard.',
        },
        { status: 400 },
      );
    }

    await db.execute(sql`RELEASE SAVEPOINT brixta_user_update`);

    return NextResponse.json({
      message: 'User updated successfully',
      user: withoutSecrets(updatedUser),
      credentials: generatedCreds
    });

  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
});

// ==========================================
// GET - Get single user
// ==========================================
export const GET = withTenantDb<RouteContext>(async (request, db, session, context) => {
  await connection();
  try {
    const { userId } = await context.params;

    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session.permissions, "READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const targetUserResult = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        zone: users.zone,
        area: users.area,
        phoneNumber: users.phoneNumber,
        isDashboardUser: users.isDashboardUser,
        isSalesAppUser: users.isSalesAppUser,
        deviceId: users.deviceId,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        dashboardLoginId: users.dashboardLoginId,
        salesmanLoginId: users.salesmanLoginId,
      })
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    const targetUser = targetUserResult[0];

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
});