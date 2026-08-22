import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { roles } from "../../../../../drizzle/schema";

export const GET = withTenantDb(async (_request, db) => {
  const rows = await db.select().from(roles).orderBy(asc(roles.orgRole));
  return NextResponse.json({
    success: true,
    roles: rows.map((role) => ({
      ...role,
      label: role.orgRole || role.jobRole || `Role ${role.id}`,
    })),
  });
});

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  if (!hasPermission(session.permissions, ["MANAGE_USERS", "ALL_ACCESS"])) {
    return NextResponse.json(
      { success: false, error: "Permission denied." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { success: false, error: "Role name is required." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(roles)
    .values({
      orgRole: name,
      jobRole: String(body?.jobRole ?? name).trim(),
      grantedPerms: Array.isArray(body?.grantedPerms)
        ? body.grantedPerms.map(String)
        : ["READ"],
      permDescription:
        body?.description != null ? String(body.description) : null,
    })
    .returning();

  return NextResponse.json(
    {
      success: true,
      role: {
        ...created,
        label: created.orgRole || created.jobRole || `Role ${created.id}`,
      },
    },
    { status: 201 },
  );
});
