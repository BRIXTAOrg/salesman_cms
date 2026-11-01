import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  dataSources,
  entityTypes,
} from "../../../../../drizzle/platformVNextSchema";

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
    .from(entityTypes)
    .orderBy(asc(entityTypes.title));

  return NextResponse.json({ success: true, entityTypes: rows });
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

  const title = String(body?.title ?? "").trim();
  const key = normalizeKey(body?.key || title);
  const fieldDefinitions = Array.isArray(body?.fieldDefinitions)
    ? body.fieldDefinitions
    : [];
  const searchableFields = Array.isArray(body?.searchableFields)
    ? body.searchableFields.map(String)
    : [];

  if (!title || !key) {
    return NextResponse.json(
      { success: false, error: "Entity title/key is required." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: entityTypes.id })
    .from(entityTypes)
    .where(eq(entityTypes.key, key))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { success: false, error: "An Entity Type with that key already exists." },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(entityTypes)
    .values({
      key,
      title,
      description: body?.description ? String(body.description) : null,
      fieldDefinitions,
      displayTemplate: body?.displayTemplate
        ? String(body.displayTemplate)
        : null,
      searchableFields,
      config:
        body?.config && typeof body.config === "object"
          ? body.config
          : {},
    })
    .returning();

  await db
    .insert(dataSources)
    .values({
      key,
      title,
      sourceType: "entity_store",
      sourceRef: key,
      displayField:
        typeof body?.displayField === "string" && body.displayField
          ? body.displayField
          : searchableFields[0] ?? null,
      valueField: "id",
      searchableFields,
      allowedFields: fieldDefinitions
        .map((field: { key?: unknown }) => String(field?.key ?? ""))
        .filter(Boolean),
      config: {
        entityTypeId: created.id,
        entityTypeKey: key,
      },
    })
    .onConflictDoNothing({ target: dataSources.key });

  return NextResponse.json(
    { success: true, entityType: created },
    { status: 201 },
  );
});
