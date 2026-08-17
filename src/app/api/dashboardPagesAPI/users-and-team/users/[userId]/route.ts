// src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { users, roles as rolesTable, userRoles } from '../../../../../../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateRandomPassword } from '@/app/api/dashboardPagesAPI/users-and-team/users/helpers';

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
}).strict();

type RouteContext = { params: Promise<{ userId: string }> };

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
      isDashboardUser, isSalesAppUser,
      ...standardData
    } = parsedBody.data;

    const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean) as string[];

    const targetUserResult = await db.select().from(users).where(eq(users.id, targetUserLocalId)).limit(1);
    const targetUser = targetUserResult[0];

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

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

    // --- LOGIC A: Dashboard User Upgrade ---
    if (isDashboardUser === true && !targetUser.dashboardHashedPassword) {
      const emailToUse = standardData.email || targetUser.email || "";
      const emailLocalPart = emailToUse.split('@')[0];
      let dashPassword = "";

      if (emailLocalPart.includes('.')) {
        dashPassword = emailLocalPart.split('.')[0] + '@123';
      } else {
        dashPassword = emailLocalPart.substring(0, 6) + '@123';
      }

      // NOTE: dashboardHashedPassword is plaintext here despite the
      // column name -- matches app/api/auth/login/route.ts's comparison
      // (`user.dashboardHashedPassword !== password`), which is also
      // plaintext. Pre-existing pattern, left as-is (see the same note
      // in users/route.ts's POST handler).
      drizzleUpdateData.isDashboardUser = true;
      drizzleUpdateData.dashboardLoginId = standardData.email || targetUser.email;
      drizzleUpdateData.dashboardHashedPassword = dashPassword;
      generatedCreds.dashboardEmail = drizzleUpdateData.dashboardLoginId;
      generatedCreds.dashboardPassword = dashPassword;
    } else if (isDashboardUser !== undefined) {
      drizzleUpdateData.isDashboardUser = isDashboardUser;
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
      const newSalesmanPassword = generateRandomPassword();

      // Hash it here, matching the backend's bcrypt.compare against
      // salesAppPasswordHash -- same fix as users/route.ts's POST
      // handler. Previously this saved the plaintext password straight
      // into salesAppPassword.
      const newSalesmanPasswordHash = await bcrypt.hash(newSalesmanPassword, 12);

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

    return NextResponse.json({ 
      message: 'User updated successfully', 
      user: updatedUser,
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