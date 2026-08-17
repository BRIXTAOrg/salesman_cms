// src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { users, roles, userRoles } from '../../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';

export const GET = withTenantDb(async (request, db, session) => {
  try {
    if (!hasPermission(session.permissions, "READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const roleParam = request.nextUrl.searchParams.get('role');
    const roleFilter = roleParam && roleParam !== 'all' ? roleParam : undefined;

    // 1. Fetch all users and their joined roles
    const allCompanyUsersRaw = await db
      .select({
        user: users,
        orgRole: roles.orgRole,
        jobRole: roles.jobRole,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id));

    // 2. Aggregate the multiple role rows per user
    const usersMap = new Map();

    for (const row of allCompanyUsersRaw) {
      if (!usersMap.has(row.user.id)) {
        usersMap.set(row.user.id, {
          ...row.user,
          orgRole: row.orgRole || 'Unassigned',
          jobRoles: new Set<string>(),
        });
      }

      const u = usersMap.get(row.user.id);
      if (row.jobRole) u.jobRoles.add(row.jobRole);
      if (row.orgRole && u.orgRole === 'Unassigned') u.orgRole = row.orgRole;
    }

    const allUsers = Array.from(usersMap.values()).map(u => ({
      ...u,
      jobRole: Array.from(u.jobRoles),
    }));

    // 3. Filter by selected role
    const filteredUsers = roleFilter 
       ? allUsers.filter(u => u.orgRole === roleFilter) 
       : allUsers;

    // 4. Build the hierarchy
    const formattedTeamData = filteredUsers.map(member => {
      const manager = member.reportsToId ? allUsers.find(u => u.id === member.reportsToId) : null;
      const managerName = manager ? (manager.username || 'Unknown') : 'none';
      
      const directReports = allUsers.filter(u => u.reportsToId === member.id);
      const manages = directReports.map(r => r.username || 'Unknown').filter(Boolean).join(', ') || 'None';

      return {
        id: member.id,
        name: member.username || 'Unknown',
        orgRole: member.orgRole,
        jobRole: member.jobRole,
        managedBy: managerName,
        manages,
        managesReports: directReports.map(r => ({ name: r.username || 'Unknown', orgRole: r.orgRole })),
        managedById: member.reportsToId,
        managesIds: directReports.map(r => r.id),
      };
    });

    formattedTeamData.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(formattedTeamData, { status: 200 });

  } catch (error: any) {
    console.error("Team Overview Fetch Error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
});