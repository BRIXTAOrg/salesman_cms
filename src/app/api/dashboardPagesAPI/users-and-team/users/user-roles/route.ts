// src/app/api/dashboardPagesAPI/users-and-team/users/user-roles/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { withTenantDb } from "@/lib/auth";
import { users, roles, userRoles } from "../../../../../../../drizzle/schema";
import { eq } from "drizzle-orm";

export const GET = withTenantDb(async (request, db, session) => {
  try {
    const rawRoles = await db
      .select({ 
         orgRole: roles.orgRole,
         jobRole: roles.jobRole
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id));

    const orgRoleSet = new Set<string>();
    const jobRoleSet = new Set<string>();

    rawRoles.forEach((r) => {
      if (r.orgRole) orgRoleSet.add(r.orgRole);
      if (r.jobRole) jobRoleSet.add(r.jobRole);
    });

    return NextResponse.json({ 
       roles: Array.from(orgRoleSet), // backward compatibility
       orgRoles: Array.from(orgRoleSet), 
       jobRoles: Array.from(jobRoleSet) 
     }, { status: 200 });

  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json({ error: "Failed to fetch user roles" }, { status: 500 });
  }
});