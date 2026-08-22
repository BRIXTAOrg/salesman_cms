import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { dataSources } from "../../../../../../drizzle/platformVNextSchema";

type Context = {
  params: Promise<{ id: string }>;
};

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
    const body = await request.json().catch(() => null);

    if (!Number.isInteger(numericId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Data Source id." },
        { status: 400 },
      );
    }

    const patch: Partial<typeof dataSources.$inferInsert> = {
      updatedAt: new Date(),
    };

    for (const key of [
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
    ]) {
      if (body?.[key] !== undefined) {
        patch[key] = body[key];
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

    return NextResponse.json({ success: true, dataSource: updated });
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

    if (!Number.isInteger(numericId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Data Source id." },
        { status: 400 },
      );
    }

    await db.delete(dataSources).where(eq(dataSources.id, numericId));

    return NextResponse.json({ success: true });
  },
);
