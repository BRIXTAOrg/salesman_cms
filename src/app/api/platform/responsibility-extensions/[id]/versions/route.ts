import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  responsibilityVersions,
} from "../../../../../../../drizzle/platformVNextSchema";

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

    const versions = await db
      .select({
        id: responsibilityVersions.id,
        version: responsibilityVersions.version,
        status: responsibilityVersions.status,
        createdAt: responsibilityVersions.createdAt,
        publishedAt: responsibilityVersions.publishedAt,
        createdByUserId: responsibilityVersions.createdByUserId,
      })
      .from(responsibilityVersions)
      .where(eq(responsibilityVersions.responsibilityId, responsibilityId))
      .orderBy(desc(responsibilityVersions.version))
      .limit(50);

    return NextResponse.json({ success: true, versions });
  },
);
