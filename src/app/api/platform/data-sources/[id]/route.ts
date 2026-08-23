import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { dataSources } from "../../../../../../drizzle/platformVNextSchema";

type Context = {
  params: Promise<{ id: string }>;
};

type DataSourcePatch = Partial<typeof dataSources.$inferInsert>;

const EDITABLE_FIELDS = [
  "title",
  "displayField",
  "valueField",
  "sourceType",
  "sourceRef",
  "searchableFields",
  "allowedFields",
  "defaultFilters",
  "offlinePolicy",
  "config",
  "isActive",
] as const satisfies readonly (keyof DataSourcePatch)[];

export const PATCH = withTenantDb<Context>(
  async (request: NextRequest, db, session, context) => {
    if (!hasPermission(session.permissions, ["UPDATE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);

    const { id } = await context.params;
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid Data Source id." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 },
      );
    }

    const patch: DataSourcePatch = {
      updatedAt: new Date(),
    };

    for (const key of EDITABLE_FIELDS) {
      if (body[key] !== undefined) {
        Object.assign(patch, {
          [key]: body[key],
        });
      }
    }

    const [updated] = await db
      .update(dataSources)
      .set(patch)
      .where(eq(dataSources.id, numericId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Data Source not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      dataSource: updated,
    });
  },
);

export const DELETE = withTenantDb<Context>(
  async (_request, db, session, context) => {
    if (!hasPermission(session.permissions, ["DELETE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);

    const { id } = await context.params;
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid Data Source id." },
        { status: 400 },
      );
    }

    const [deleted] = await db
      .delete(dataSources)
      .where(eq(dataSources.id, numericId))
      .returning({ id: dataSources.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Data Source not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: deleted.id,
    });
  },
);