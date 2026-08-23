import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import {
  applianceBackendFetch,
  forwardBackendJson,
  requireApplianceSession,
} from "@/lib/appliance-backend";
import {
  ENTITLEMENT_KEYS,
  hasTenantEntitlement,
} from "@/lib/entitlements";
import { withTenantSchema } from "@/lib/drizzle";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { normalizeResponsibilityExtension } from "@/lib/responsibility-compiler";
import { findResponsibilityTemplate } from "@/lib/responsibility-power-templates";
import {
  platformAuditEvents,
  responsibilityExtensions,
} from "../../../../../drizzle/platformVNextSchema";
import { mobileCapabilities } from "../../../../../drizzle/schema";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function uniqueResponsibilityKey(
  schemaName: string,
  requested: string,
) {
  const base = normalizeKey(requested) || "responsibility";

  return withTenantSchema(schemaName, async (db) => {
    let candidate = base;
    let counter = 2;

    while (true) {
      const [existing] = await db
        .select({ id: mobileCapabilities.id })
        .from(mobileCapabilities)
        .where(eq(mobileCapabilities.key, candidate))
        .limit(1);

      if (!existing) return candidate;
      candidate = `${base}_${counter}`;
      counter += 1;
    }
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApplianceSession(true);

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status },
    );
  }

  if (
    !(await hasTenantEntitlement(
      auth.session.schemaName,
      ENTITLEMENT_KEYS.RESPONSIBILITY_CREATE,
    ))
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "ENTITLEMENT_REQUIRED",
        error:
          "Responsibility customization is not enabled for this company.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const template = findResponsibilityTemplate(
    String(body?.templateKey ?? ""),
  );

  if (!template) {
    return NextResponse.json(
      { success: false, error: "Unknown Responsibility template." },
      { status: 400 },
    );
  }

  const title = String(body?.title ?? template.base.title).trim();
  if (!title) {
    return NextResponse.json(
      { success: false, error: "Responsibility title is required." },
      { status: 400 },
    );
  }

  const key = await uniqueResponsibilityKey(
    auth.session.schemaName,
    title,
  );

  try {
    const upstream = await applianceBackendFetch(
      "/api/admin/appliance/responsibilities",
      auth.session,
      {
        method: "POST",
        body: JSON.stringify({
          key,
          title,
          description: template.base.description,
          icon: template.base.icon,
          config: template.base.config,
        }),
      },
    );

    const backendBody = await forwardBackendJson(upstream);

    if (!upstream.ok) {
      return NextResponse.json(backendBody, {
        status: upstream.status,
      });
    }

    const responseObject =
      backendBody && typeof backendBody === "object"
        ? (backendBody as Record<string, unknown>)
        : {};
    const responseResponsibility =
      responseObject.responsibility &&
      typeof responseObject.responsibility === "object"
        ? (responseObject.responsibility as Record<string, unknown>)
        : {};
    const responseData =
      responseObject.data && typeof responseObject.data === "object"
        ? (responseObject.data as Record<string, unknown>)
        : {};

    let responsibilityId = Number(
      responseResponsibility.id ?? responseData.id ?? responseObject.id,
    );

    await withTenantSchema(
      auth.session.schemaName,
      async (db) => {
        await ensureTenantPlatformVNext(db);

        if (!Number.isInteger(responsibilityId)) {
          const [created] = await db
            .select({ id: mobileCapabilities.id })
            .from(mobileCapabilities)
            .where(eq(mobileCapabilities.key, key))
            .limit(1);

          responsibilityId = created?.id ?? Number.NaN;
        }

        if (!Number.isInteger(responsibilityId)) {
          throw new Error(
            "Responsibility was created, but its tenant record could not be resolved.",
          );
        }

        const extension = normalizeResponsibilityExtension(
          template.extension,
        );

        await db
          .insert(responsibilityExtensions)
          .values({
            responsibilityId,
            draftConfig: extension,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: responsibilityExtensions.responsibilityId,
            set: {
              draftConfig: extension,
              updatedAt: new Date(),
            },
          });

        await db.insert(platformAuditEvents).values({
          actorUserId: auth.session.userId,
          eventType: "responsibility.template_created",
          subjectType: "responsibility",
          subjectId: String(responsibilityId),
          payload: {
            templateKey: template.key,
            builderMode: template.mode,
          },
        });
      },
    );

    return NextResponse.json(
      {
        success: true,
        responsibility: {
          id: responsibilityId,
          key,
          title,
        },
        templateKey: template.key,
        setupNotes: template.setupNotes,
        message:
          template.setupNotes.length > 0
            ? "Template created as a draft. Complete the highlighted setup before publishing."
            : "Template created as a draft and is ready to configure.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Responsibility template creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Responsibility template.",
      },
      { status: 500 },
    );
  }
}
