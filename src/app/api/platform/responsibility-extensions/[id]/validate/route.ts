import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { normalizeResponsibilityExtension } from "@/lib/responsibility-compiler";
import {
  hasPublishBlockingIssues,
  validateResponsibilityDefinition,
} from "@/lib/responsibility-validation";
import {
  dataSources,
  responsibilityExtensions,
} from "../../../../../../../drizzle/platformVNextSchema";
import {
  mobileCapabilities,
  roles,
} from "../../../../../../../drizzle/schema";

type Context = {
  params: Promise<{ id: string }>;
};

export const POST = withTenantDb<Context>(
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
      .select({ draftConfig: responsibilityExtensions.draftConfig })
      .from(responsibilityExtensions)
      .where(eq(responsibilityExtensions.responsibilityId, responsibilityId))
      .limit(1);

    const [roleRows, sourceRows] = await Promise.all([
      db.select({ id: roles.id }).from(roles),
      db
        .select({
          key: dataSources.key,
          allowedFields: dataSources.allowedFields,
        })
        .from(dataSources)
        .where(eq(dataSources.isActive, true)),
    ]);

    const normalized = normalizeResponsibilityExtension(
      extension?.draftConfig ?? {},
    );
    const issues = validateResponsibilityDefinition({
      baseDefinition: responsibility.config ?? {},
      extension: normalized,
      roles: roleRows,
      dataSources: sourceRows,
    });

    return NextResponse.json({
      success: true,
      valid: !hasPublishBlockingIssues(issues),
      issues,
    });
  },
);
