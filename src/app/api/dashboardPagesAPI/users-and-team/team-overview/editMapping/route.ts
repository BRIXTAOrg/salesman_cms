// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { users, roles, userRoles } from '../../../../../../../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { getRoleWeight, isSuperUser } from '@/lib/roleHierarchy';

const editMappingSchema = z.object({
  userId: z.number(),
  reportsToId: z.number().nullable(),
  managesIds: z.array(z.number()).optional().default([]),
});

export const POST = withTenantDb(async (request, db, session) => {
  try {
    if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, reportsToId, managesIds } = editMappingSchema.parse(body);

    if (reportsToId === userId || managesIds.includes(userId)) {
      return NextResponse.json({ error: "Self-mapping forbidden" }, { status: 400 });
    }

    const targetUserQuery = await db
      .select({ 
         reportsToId: users.reportsToId,
         orgRole: roles.orgRole 
       })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (targetUserQuery.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetUser = targetUserQuery[0];
    const targetOrgRole = targetUser.orgRole || 'Unassigned';
    const currentUserRole = session.orgRole; 
    const currentWeight = getRoleWeight(currentUserRole);
    const targetWeight = getRoleWeight(targetOrgRole);

    if (!isSuperUser(currentUserRole) && currentWeight <= targetWeight) {
      return NextResponse.json({ error: "Forbidden: Cannot modify mapping for a user with equal or higher authority." }, { status: 403 });
    }

    if (reportsToId && reportsToId !== targetUser.reportsToId) {
      const newManagerQuery = await db
        .select({ orgRole: roles.orgRole })
        .from(users)
        .leftJoin(userRoles, eq(users.id, userRoles.userId))
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(users.id, reportsToId))
        .limit(1);
        
      if (newManagerQuery.length === 0) {
        return NextResponse.json({ error: "Target manager not found" }, { status: 404 });
      }

      const managerOrgRole = newManagerQuery[0].orgRole || 'Unassigned';
      const managerWeight = getRoleWeight(managerOrgRole);

      if (!isSuperUser(managerOrgRole) && managerWeight <= targetWeight) {
        return NextResponse.json({ error: "Invalid Hierarchy: A user must report to someone with higher authority." }, { status: 400 });
      }

      if (!isSuperUser(currentUserRole) && currentWeight < managerWeight) {
        return NextResponse.json({ error: "Forbidden: Cannot assign a user to a manager with higher authority than yourself." }, { status: 403 });
      }
    }

    // Atomic queries via withTenantDb without a nested transaction[cite: 5]
    await db.update(users).set({ reportsToId: null }).where(eq(users.reportsToId, userId));
    
    if (managesIds.length > 0) {
      await db.update(users).set({ reportsToId: userId }).where(inArray(users.id, managesIds));
    }
    
    await db.update(users).set({ reportsToId }).where(eq(users.id, userId));

    return NextResponse.json({ message: 'Mapping updated successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Mapping Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});