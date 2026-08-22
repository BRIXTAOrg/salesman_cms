import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  entityRecords,
  entityTypes,
} from "../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };

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
        { success: false, error: "Invalid Entity Type id." },
        { status: 400 },
      );
    }

    const patch: Partial<typeof entityTypes.$inferInsert> = {
      updatedAt: new Date(),
    };

    for (const key of [
      "title",
      "description",
      "fieldDefinitions",
      "displayTemplate",
      "searchableFields",
      "config",
      "isActive",
    ] as const) {
      if (body?.[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = body[key];
      }
    }

    const [updated] = await db
      .update(entityTypes)
      .set(patch)
      .where(eq(entityTypes.id, numericId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Entity Type not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, entityType: updated });
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

    const [usage] = await db
      .select({ count: count() })
      .from(entityRecords)
      .where(eq(entityRecords.entityTypeId, numericId));

    if (Number(usage?.count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This Entity Type already has records. Disable it instead of deleting it.",
        },
        { status: 409 },
      );
    }

    await db.delete(entityTypes).where(eq(entityTypes.id, numericId));
    return NextResponse.json({ success: true });
  },
);
