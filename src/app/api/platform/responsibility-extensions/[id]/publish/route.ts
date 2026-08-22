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
  compiledResponsibilityManifests,
  platformAuditEvents,
  responsibilityExtensions,
  responsibilityVersions,
} from "../../../../../../../drizzle/platformVNextSchema";
import { mobileCapabilities } from "../../../../../../../drizzle/schema";

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

    const nextVersion = (extension?.publishedVersion ?? 0) + 1;
    const normalized = normalizeResponsibilityExtension(
      extension?.draftConfig ?? {},
    );

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

    // withTenantDb already runs inside the tenant transaction, so these
    // writes stay atomic without opening a nested transaction.
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
      },
    });

    return NextResponse.json({
      success: true,
      version: nextVersion,
      manifestHash,
      manifest,
      message:
        "Responsibility platform definition published and compiled. Backend/mobile runtime must consume this compiled manifest for live execution.",
    });
  },
);
