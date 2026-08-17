// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editRole/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { users, roles, userRoles } from '../../../../../../../drizzle/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { z } from 'zod';
import { canAssignRole } from '@/lib/roleHierarchy';

const editRoleSchema = z.object({
  userId: z.number(),
  newOrgRole: z.string().min(1, "New role is required"),
  newJobRoles: z.array(z.string()).optional().default([]),
});

export const POST = withTenantDb(async (request, db, session) => {
  try {
    if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedBody = editRoleSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validatedBody.error.format() }, { status: 400 });
    }

    const { userId, newOrgRole, newJobRoles } = validatedBody.data;

    const targetUserQuery = await db
      .select({ orgRole: roles.orgRole })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(users.id, userId));

    if (targetUserQuery.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentOrgRole = targetUserQuery[0].orgRole || 'Unassigned';

    if (currentOrgRole !== 'Unassigned' && !canAssignRole(session.orgRole, currentOrgRole)) {
      return NextResponse.json({ error: 'Forbidden: You do not have authority to modify this user.' }, { status: 403 });
    }

    if (!canAssignRole(session.orgRole, newOrgRole)) {
      return NextResponse.json({ error: 'Forbidden: You cannot assign this role level.' }, { status: 403 });
    }

    // Since withTenantDb creates an atomic transaction block, we don't nest db.transaction()[cite: 5]
    let roleQuery;
    if (newJobRoles.length > 0) {
      roleQuery = await db.select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.orgRole, newOrgRole), inArray(roles.jobRole, newJobRoles)));
    } else {
      roleQuery = await db.select({ id: roles.id })
        .from(roles)
        .where(eq(roles.orgRole, newOrgRole))
        .limit(1);
    }

    const roleIds = roleQuery.map(r => r.id);
    if (roleIds.length === 0) {
      throw new Error("No roles found in the database matching this configuration. Please contact admin.");
    }

    await db.delete(userRoles).where(eq(userRoles.userId, userId));

    const newMappings = roleIds.map(rId => ({ userId, roleId: rId }));
    await db.insert(userRoles).values(newMappings);

    return NextResponse.json({ message: 'Roles updated successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating user roles:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user roles' }, { status: 500 });
  }
});