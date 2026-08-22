import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { entityRecords } from "../../../../../drizzle/platformVNextSchema";

export const GET = withTenantDb(async (request, db) => {
  await ensureTenantPlatformVNext(db);

  const entityTypeId = Number(request.nextUrl.searchParams.get("entityTypeId"));
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1),
    100,
  );

  if (!Number.isInteger(entityTypeId)) {
    return NextResponse.json(
      { success: false, error: "entityTypeId is required." },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(entityRecords)
    .where(eq(entityRecords.entityTypeId, entityTypeId))
    .orderBy(desc(entityRecords.updatedAt))
    .limit(limit);

  return NextResponse.json({ success: true, records: rows });
});

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  if (!hasPermission(session.permissions, ["WRITE", "ALL_ACCESS"])) {
    return NextResponse.json(
      { success: false, error: "Permission denied." },
      { status: 403 },
    );
  }

  await ensureTenantPlatformVNext(db);
  const body = await request.json().catch(() => null);
  const entityTypeId = Number(body?.entityTypeId);

  if (!Number.isInteger(entityTypeId)) {
    return NextResponse.json(
      { success: false, error: "entityTypeId is required." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(entityRecords)
    .values({
      entityTypeId,
      externalKey: body?.externalKey ? String(body.externalKey) : null,
      status: body?.status ? String(body.status) : "active",
      data:
        body?.data && typeof body.data === "object" && !Array.isArray(body.data)
          ? body.data
          : {},
      createdByUserId: session.userId,
      updatedByUserId: session.userId,
    })
    .returning();

  return NextResponse.json(
    { success: true, record: created },
    { status: 201 },
  );
});
