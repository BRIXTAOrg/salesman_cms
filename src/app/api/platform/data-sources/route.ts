import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { withTenantDb, hasPermission } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { dataSources } from "../../../../../drizzle/platformVNextSchema";

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const GET = withTenantDb(async (_request, db) => {
  await ensureTenantPlatformVNext(db);

  const rows = await db
    .select()
    .from(dataSources)
    .orderBy(asc(dataSources.title));

  return NextResponse.json({
    success: true,
    dataSources: rows,
  });
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
  const key = normalizeKey(body?.key || body?.title);
  const title = String(body?.title ?? "").trim();
  const sourceType = String(body?.sourceType ?? "").trim();
  const sourceRef = String(body?.sourceRef ?? "").trim();

  if (!key || !title || !sourceType || !sourceRef) {
    return NextResponse.json(
      {
        success: false,
        error: "key/title, sourceType and sourceRef are required.",
      },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.key, key))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { success: false, error: "A Data Source with that key already exists." },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(dataSources)
    .values({
      key,
      title,
      sourceType,
      sourceRef,
      displayField: body?.displayField || null,
      valueField: body?.valueField || null,
      searchableFields: Array.isArray(body?.searchableFields)
        ? body.searchableFields.map(String)
        : [],
      allowedFields: Array.isArray(body?.allowedFields)
        ? body.allowedFields.map(String)
        : [],
      defaultFilters: Array.isArray(body?.defaultFilters)
        ? body.defaultFilters
        : [],
      offlinePolicy:
        body?.offlinePolicy && typeof body.offlinePolicy === "object"
          ? body.offlinePolicy
          : {},
      config:
        body?.config && typeof body.config === "object"
          ? body.config
          : {},
    })
    .returning();

  return NextResponse.json(
    { success: true, dataSource: created },
    { status: 201 },
  );
});
