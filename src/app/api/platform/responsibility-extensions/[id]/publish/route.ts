import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  compileResponsibilityManifest,
  hashResponsibilityManifest,
  normalizeResponsibilityExtension,
} from "@/lib/responsibility-compiler";
import {
  hasPublishBlockingIssues,
  validateResponsibilityDefinition,
} from "@/lib/responsibility-validation";
import {
  compiledResponsibilityManifests,
  dataSources,
  platformAuditEvents,
  responsibilityExtensions,
  responsibilityVersions,
} from "../../../../../../../drizzle/platformVNextSchema";
import {
  mobileCapabilities,
  roles,
} from "../../../../../../../drizzle/schema";

type Context = {
  params: Promise<{ id: string }>;
};

export const POST = withTenantDb<Context>(
  async (_request, db, session, context) => {
    if (!hasPermission(session.permissions, ["WRITE", "UPDATE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

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

    const nextVersion = (extension?.publishedVersion ?? 0) + 1;
    const normalized = normalizeResponsibilityExtension(
      extension?.draftConfig ?? {},
    );

    const validationIssues = validateResponsibilityDefinition({
      baseDefinition: responsibility.config ?? {},
      extension: normalized,
      roles: roleRows,
      dataSources: sourceRows,
    });

    if (hasPublishBlockingIssues(validationIssues)) {
      return NextResponse.json(
        {
          success: false,
          code: "RESPONSIBILITY_VALIDATION_FAILED",
          error:
            "Publish blocked. Fix the Responsibility validation errors first.",
          issues: validationIssues,
        },
        { status: 422 },
      );
    }

    const manifest = compileResponsibilityManifest({
      responsibilityId,
      responsibilityKey: responsibility.key,
      responsibilityTitle: responsibility.title,
      version: nextVersion,
      baseDefinition: responsibility.config ?? {},
      extension: normalized,
    });

    const manifestHash = hashResponsibilityManifest(manifest);
    const now = new Date();

    await db
      .insert(responsibilityExtensions)
      .values({
        responsibilityId,
        draftConfig: normalized,
        publishedConfig: normalized,
        publishedVersion: nextVersion,
        compiledHash: manifestHash,
        publishedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: responsibilityExtensions.responsibilityId,
        set: {
          draftConfig: normalized,
          publishedConfig: normalized,
          publishedVersion: nextVersion,
          compiledHash: manifestHash,
          publishedAt: now,
          updatedAt: now,
        },
      });

    await db.insert(responsibilityVersions).values({
      responsibilityId,
      version: nextVersion,
      status: "published",
      baseDefinition: responsibility.config ?? {},
      extensionDefinition: normalized,
      createdByUserId: session.userId,
      publishedAt: now,
    });

    await db.insert(compiledResponsibilityManifests).values({
      responsibilityId,
      version: nextVersion,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestHash,
    });

    await db.insert(platformAuditEvents).values({
      actorUserId: session.userId,
      eventType: "responsibility.published",
      subjectType: "responsibility",
      subjectId: String(responsibilityId),
      payload: {
        version: nextVersion,
        manifestHash,
        manifestVersion: 2,
        warningCount: validationIssues.filter(
          (issue) => issue.severity === "warning",
        ).length,
      },
    });

    return NextResponse.json({
      success: true,
      version: nextVersion,
      manifestHash,
      manifest,
      issues: validationIssues,
      message:
        "Responsibility v2 manifest published. Backend/mobile runtime can now consume Data, Rules, Flow, Access, Output and Runtime semantics from one compiled contract.",
    });
  },
);
