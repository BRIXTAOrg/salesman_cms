import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  blankResponsibilityExtension,
  normalizeResponsibilityExtension,
} from "@/lib/responsibility-compiler";
import {
  responsibilityExtensions,
} from "../../../../../../drizzle/platformVNextSchema";
import { mobileCapabilities } from "../../../../../../drizzle/schema";

type Context = {
  params: Promise<{ id: string }>;
};

export const GET = withTenantDb<Context>(
  async (_request, db, _session, context) => {
    await ensureTenantPlatformVNext(db);
    const { id } = await context.params;
    const responsibilityId = Number(id);

    if (!Number.isInteger(responsibilityId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Responsibility id." },
        { status: 400 },
      );
    }

    const [responsibility] = await db
      .select({
        id: mobileCapabilities.id,
        key: mobileCapabilities.key,
        title: mobileCapabilities.title,
        config: mobileCapabilities.config,
      })
      .from(mobileCapabilities)
      .where(eq(mobileCapabilities.id, responsibilityId))
      .limit(1);

    if (!responsibility) {
      return NextResponse.json(
        { success: false, error: "Responsibility not found." },
        { status: 404 },
      );
    }

    const [extension] = await db
      .select()
      .from(responsibilityExtensions)
      .where(eq(responsibilityExtensions.responsibilityId, responsibilityId))
      .limit(1);

    return NextResponse.json({
      success: true,
      responsibility,
      extension: extension ?? {
        responsibilityId,
        draftConfig: blankResponsibilityExtension(),
        publishedConfig: blankResponsibilityExtension(),
        publishedVersion: 0,
        compiledHash: null,
        publishedAt: null,
      },
    });
  },
);

export const PUT = withTenantDb<Context>(
  async (request: NextRequest, db, session, context) => {
    if (!hasPermission(session.permissions, ["WRITE", "UPDATE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);
    const { id } = await context.params;
    const responsibilityId = Number(id);
    const body = await request.json().catch(() => null);

    if (!Number.isInteger(responsibilityId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Responsibility id." },
        { status: 400 },
      );
    }

    const config = normalizeResponsibilityExtension(body?.config);

    await db
      .insert(responsibilityExtensions)
      .values({
        responsibilityId,
        draftConfig: config,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: responsibilityExtensions.responsibilityId,
        set: {
          draftConfig: config,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      config,
      message: "Responsibility platform draft saved.",
    });
  },
);
