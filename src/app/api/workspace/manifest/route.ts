import "server-only";

import { NextResponse } from "next/server";

import type { PlatformRuntime, Responsibility } from "@/lib/appliance-types";
import {
  applianceBackendFetch,
  forwardBackendJson,
  requireApplianceSession,
} from "@/lib/appliance-backend";
import { buildWorkspaceManifest } from "@/lib/workspace-manifest";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  const auth = await requireApplianceSession(false);

  if (!auth.ok) {
    return NextResponse.json(
      {
        success: false,
        error: auth.error,
      },
      {
        status: auth.status,
      },
    );
  }

  try {
    const [
      runtimeResponse,
      responsibilitiesResponse,
      archivedResponsibilitiesResponse,
      approvalsResponse,
    ] = await Promise.all([
      applianceBackendFetch("/api/admin/appliance/runtime", auth.session),
      applianceBackendFetch(
        "/api/admin/appliance/responsibilities",
        auth.session,
      ),
      applianceBackendFetch(
        "/api/admin/appliance/archived-responsibilities",
        auth.session,
      ),
      applianceBackendFetch(
        "/api/admin/appliance/approvals?status=pending",
        auth.session,
      ),
    ]);

    if (!runtimeResponse.ok) {
      return NextResponse.json(await forwardBackendJson(runtimeResponse), {
        status: runtimeResponse.status,
      });
    }

    if (!responsibilitiesResponse.ok) {
      return NextResponse.json(
        await forwardBackendJson(responsibilitiesResponse),
        { status: responsibilitiesResponse.status },
      );
    }

    if (!archivedResponsibilitiesResponse.ok) {
      return NextResponse.json(
        await forwardBackendJson(archivedResponsibilitiesResponse),
        {
          status: archivedResponsibilitiesResponse.status,
        },
      );
    }

    const runtimeBody = objectValue(await forwardBackendJson(runtimeResponse));
    const responsibilitiesBody = objectValue(
      await forwardBackendJson(responsibilitiesResponse),
    );

    const archivedResponsibilitiesBody = objectValue(
      await forwardBackendJson(archivedResponsibilitiesResponse),
    );

    // The approvals request is allowed to fail independently. It is an
    // attention counter, not a prerequisite for rendering the workspace.
    let pendingApprovals = 0;
    if (approvalsResponse.ok) {
      const approvalsBody = objectValue(
        await forwardBackendJson(approvalsResponse),
      );
      pendingApprovals = Array.isArray(approvalsBody.approvals)
        ? approvalsBody.approvals.length
        : 0;
    }

    const manifest = buildWorkspaceManifest({
      identity: auth.session,
      runtime: runtimeBody as unknown as PlatformRuntime,
      responsibilities: (Array.isArray(responsibilitiesBody.responsibilities)
        ? responsibilitiesBody.responsibilities
        : []) as Responsibility[],

      archivedResponsibilities: (Array.isArray(
        archivedResponsibilitiesBody.responsibilities,
      )
        ? archivedResponsibilitiesBody.responsibilities
        : []) as Responsibility[],

      pendingApprovals,
    });

    return NextResponse.json({
      success: true,
      manifest,
    });
  } catch (error) {
    console.error("Workspace manifest backend error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve workspace.",
      },
      { status: 500 },
    );
  }
}
