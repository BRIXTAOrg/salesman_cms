import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { users } from "../../../../../../drizzle/schema";

/* BRIXTA_FIELD_APP_V1 — field executives who can receive assignments. */

export const GET = withTenantDb(async (_request: NextRequest, db, session) => {
  if (!hasPermission(session.permissions, ["READ", "WRITE", "UPDATE", "ALL_ACCESS"])) {
    return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      salesmanLoginId: users.salesmanLoginId,
      area: users.area,
      zone: users.zone,
    })
    .from(users)
    .where(and(eq(users.isSalesAppUser, true), eq(users.status, "active")))
    .orderBy(asc(users.displayName), asc(users.username))
    .limit(1_000);

  return NextResponse.json({
    success: true,
    people: rows.map((row) => ({
      id: row.id,
      name: row.displayName ?? row.username ?? row.salesmanLoginId ?? `Employee ${row.id}`,
      code: row.salesmanLoginId,
      area: [row.area, row.zone].filter(Boolean).join(" · ") || null,
    })),
  });
});
