import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  compileResponsibilityManifest,
  hashResponsibilityManifest,
  normalizeResponsibilityExtension,
} from "@/lib/responsibility-compiler";
import { sanitizeResponsibilityExtensionKernel } from "@/lib/responsibility-kernel-normalizer";
import { compileKernelToBaseDefinition } from "@/lib/responsibility-kernel-compiler";

import {
  applyPixelRealityToKernel,
} from "@/lib/pixel-reality-compiler";

import {
  PIXEL_REALITY_METADATA_KEY,
  normalizePixelReality,
} from "@/lib/pixel-reality-types";

import { compileResponsibilitySemantics } from "@/lib/responsibility-semantic-compiler";
import {
  RESPONSIBILITY_KERNEL_METADATA_KEY,
  type ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
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
import { capabilityAssignmentRules } from "../../../../../../../drizzle/applianceSchema";
import { mobileCapabilities, roles } from "../../../../../../../drizzle/schema";

const BUILDER_TARGET_ROLE_IDS_KEY = "builderTargetRoleIds";

function builderTargetRoleIds(metadata: Record<string, unknown> | undefined) {
  const raw = metadata?.[BUILDER_TARGET_ROLE_IDS_KEY];

  if (!Array.isArray(raw)) {
    return [];
  }

  return [
    ...new Set(
      raw.map(Number).filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

type Context = {
  params: Promise<{ id: string }>;
};

function kernelFromMetadata(metadata: Record<string, unknown> | undefined) {
  const candidate = metadata?.[RESPONSIBILITY_KERNEL_METADATA_KEY];
  if (
    candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    (candidate as { kernelVersion?: unknown }).kernelVersion === 3
  ) {
    return candidate as ResponsibilityKernel;
  }
  return null;
}

export const POST = withTenantDb<Context>(
  async (_request, db, session, context) => {
    if (
      !hasPermission(session.permissions, ["WRITE", "UPDATE", "ALL_ACCESS"])
    ) {
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
    const normalized = sanitizeResponsibilityExtensionKernel(
      normalizeResponsibilityExtension(extension?.draftConfig ?? {}),
    ).config;

    /*
     * RESPONSIBILITY SOURCE-OF-TRUTH PIPELINE
     *
     * Draft Kernel
     *     +
     * stored Pixel Reality declarations
     *     ↓
     * canonical Responsibility Kernel
     *     ↓
     * semantic compiler
     *     ↓
     * published runtime manifest
     *
     * Pixel Reality is intentionally reapplied here so a stale editor
     * cannot publish a graph whose business actions exist only as Pixel
     * event names.
     */
    const storedKernel =
      kernelFromMetadata(
        normalized.metadata,
      );

    const rawReality =
      normalized.metadata
        ?.[PIXEL_REALITY_METADATA_KEY];

    const reality =
      rawReality
        ? normalizePixelReality(
            rawReality,
          )
        : null;

    const kernel =
      storedKernel && reality
        ? applyPixelRealityToKernel(
            storedKernel,
            reality,
          )
        : storedKernel;

    const normalizedWithReality =
      kernel
        ? {
            ...normalized,

            metadata: {
              ...(normalized.metadata ?? {}),

              [RESPONSIBILITY_KERNEL_METADATA_KEY]:
                kernel,
            },
          }
        : normalized;

    const publishedKernel =
      kernel
        ? compileResponsibilitySemantics(
            kernel,
          )
        : null;

    const publishedNormalized =
      publishedKernel
        ? {
            ...normalizedWithReality,

            metadata: {
              ...(normalizedWithReality.metadata ?? {}),

              [RESPONSIBILITY_KERNEL_METADATA_KEY]:
                publishedKernel,
            },
          }
        : normalizedWithReality;
    const publishedBaseDefinition = publishedKernel
      ? compileKernelToBaseDefinition(publishedKernel)
      : (responsibility.config ?? {});

    const validationIssues = validateResponsibilityDefinition({
      baseDefinition: publishedBaseDefinition,
      extension: publishedNormalized,
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
      baseDefinition: publishedBaseDefinition,
      extension: publishedNormalized,
    });

    const manifestHash = hashResponsibilityManifest(manifest);
    const now = new Date();

    await db
      .insert(responsibilityExtensions)
      .values({
        responsibilityId,
        draftConfig: normalizedWithReality,
        publishedConfig: publishedNormalized,
        publishedVersion: nextVersion,
        compiledHash: manifestHash,
        publishedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: responsibilityExtensions.responsibilityId,
        set: {
          draftConfig: normalizedWithReality,
          publishedConfig: publishedNormalized,
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
      baseDefinition: publishedBaseDefinition,
      extensionDefinition: publishedNormalized,
      createdByUserId: session.userId,
      publishedAt: now,
    });

    await db.insert(compiledResponsibilityManifests).values({
      responsibilityId,
      version: nextVersion,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestHash,
    });

    // This is the point at which currently-installed employee apps see the new
    // generated app contract. withTenantDb/withTenantSchema already wraps this
    // whole route in one PostgreSQL transaction, so any later failure rolls back.
    await db
      .update(mobileCapabilities)
      .set({
        config: publishedBaseDefinition as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .where(eq(mobileCapabilities.id, responsibilityId));

    /*
     * RESPONSIBILITY → ROLE ASSIGNMENT BRIDGE
     *
     * The Builder's "This Responsibility is for" Role chips are authored
     * in draft metadata. Publish materializes them into the runtime control
     * plane used by salesapp_backend.
     *
     * Save Draft does NOT affect employee devices.
     * Publish DOES.
     */
    const knownRoleIds = new Set(roleRows.map((role) => role.id));

    const publishedTargetRoleIds = builderTargetRoleIds(
      normalizedWithReality.metadata,
    ).filter((roleId) => knownRoleIds.has(roleId));

    // Remove only rules owned by this Builder bridge. Other explicit
    // user/department/designation/manual rules remain untouched.
    await db
      .delete(capabilityAssignmentRules)
      .where(
        and(
          eq(capabilityAssignmentRules.capabilityId, responsibilityId),
          eq(capabilityAssignmentRules.subjectType, "role"),
          sql`${capabilityAssignmentRules.config} ->> 'origin' = 'responsibility_builder_role_target'`,
        ),
      );

    if (publishedTargetRoleIds.length > 0) {
      await db.insert(capabilityAssignmentRules).values(
        publishedTargetRoleIds.map((roleId) => ({
          capabilityId: responsibilityId,
          subjectType: "role",
          subjectValue: String(roleId),
          effect: "allow",
          priority: 100,
          enabled: true,
          config: {
            origin: "responsibility_builder_role_target",
            source: BUILDER_TARGET_ROLE_IDS_KEY,
            publishedVersion: nextVersion,
          },
          createdByUserId: session.userId,
          updatedAt: now,
        })),
      );
    }

    await db.insert(platformAuditEvents).values({
      actorUserId: session.userId,
      eventType: "responsibility.published",
      subjectType: "responsibility",
      subjectId: String(responsibilityId),
      payload: {
        version: nextVersion,
        manifestHash,
        manifestVersion: 2,
        kernelVersion: publishedKernel?.kernelVersion ?? null,
        generatedBaseDefinition: Boolean(kernel),
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
      message: kernel
        ? "Responsibility published. The App Builder + Kernel definition was compiled into the employee app contract and is ready for workspace refresh."
        : "Responsibility manifest published.",
    });
  },
);
