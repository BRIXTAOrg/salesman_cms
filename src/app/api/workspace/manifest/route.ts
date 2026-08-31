import "server-only";

import { NextResponse } from "next/server";

import type {
  PlatformRuntime,
  Responsibility,
} from "@/lib/appliance-types";

import {
  applianceBackendFetch,
  forwardBackendJson,
  requireApplianceSession,
} from "@/lib/appliance-backend";

import {
  buildWorkspaceManifest,
} from "@/lib/workspace-manifest";

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : {};
}

type BackendSession =
  Extract<
    Awaited<
      ReturnType<
        typeof requireApplianceSession
      >
    >,
    {
      ok: true;
    }
  >["session"];

type WorkspaceManifestValue =
  ReturnType<
    typeof buildWorkspaceManifest
  >;

type ManifestCacheEntry = {
  cachedAt: number;
  manifest:
    WorkspaceManifestValue;
};

/*
 * BRIXTA_WORKSPACE_FAST_PATH_V1
 *
 * The Workspace shell is read constantly by Sidebar/Control Center.
 *
 * It must NEVER depend on an expensive inbox reconstruction.
 */
const MANIFEST_CACHE_TTL_MS =
  15_000;

const MANIFEST_STALE_TTL_MS =
  5 * 60_000;

const manifestCache =
  new Map<
    string,
    ManifestCacheEntry
  >();

const manifestInFlight =
  new Map<
    string,
    Promise<WorkspaceManifestValue>
  >();

/*
 * Fetch AND consume the backend body inside the same promise.
 *
 * Do not return a raw Response into a Promise.all() and postpone
 * response.text()/response.json() until some unrelated slow request
 * has completed.
 */
async function fetchBackendObject(
  path: string,
  session: BackendSession,
  optional = false,
): Promise<Record<string, unknown>> {
  let lastError:
    unknown = null;

  /*
   * One transparent retry handles a stale keep-alive/socket reset
   * without turning a transient transport event into a dead workspace.
   */
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    try {
      const response =
        await applianceBackendFetch(
          path,
          session,
        );

      const body =
        objectValue(
          await forwardBackendJson(
            response,
          ),
        );

      if (!response.ok) {
        const message =
          typeof body.error ===
          "string"
            ? body.error
            : `Backend request failed (${response.status}) for ${path}.`;

        throw new Error(
          message,
        );
      }

      return body;
    } catch (error) {
      lastError =
        error;
    }
  }

  if (optional) {
    console.warn(
      `[workspace-manifest] optional backend resource failed: ${path}`,
      lastError,
    );

    return {};
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          `Unable to load required workspace resource: ${path}`,
        )
  );
}

async function resolveWorkspaceManifest(
  session: BackendSession,
): Promise<WorkspaceManifestValue> {
  /*
   * These three are cheap control-plane projections.
   *
   * IMPORTANT:
   * Full /approvals is intentionally NOT here.
   *
   * Approval inbox reconstruction performs Kernel reality evaluation
   * over Responsibility records and belongs on the Approvals screen,
   * not on every Sidebar render.
   */
  const [
    runtimeBody,
    responsibilitiesBody,
    archivedResponsibilitiesBody,
  ] =
    await Promise.all([
      fetchBackendObject(
        "/api/admin/appliance/runtime",
        session,
      ),

      fetchBackendObject(
        "/api/admin/appliance/responsibilities",
        session,
      ),

      fetchBackendObject(
        "/api/admin/appliance/archived-responsibilities",
        session,
        true,
      ),
    ]);

  return buildWorkspaceManifest({
    identity:
      session,

    runtime:
      runtimeBody as unknown as PlatformRuntime,

    responsibilities:
      (
        Array.isArray(
          responsibilitiesBody
            .responsibilities,
        )
          ? responsibilitiesBody
              .responsibilities
          : []
      ) as Responsibility[],

    archivedResponsibilities:
      (
        Array.isArray(
          archivedResponsibilitiesBody
            .responsibilities,
        )
          ? archivedResponsibilitiesBody
              .responsibilities
          : []
      ) as Responsibility[],

    /*
     * Intentionally zero on shell bootstrap.
     * Full authoritative decisions are loaded only on the Approvals
     * surface.
     */
    pendingApprovals:
      0,
  });
}

export async function GET() {
  const auth =
    await requireApplianceSession(
      false,
    );

  if (!auth.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          auth.error,
      },
      {
        status:
          auth.status,
      },
    );
  }

  const cacheKey =
    [
      auth.session
        .schemaName,
      auth.session
        .userId,
    ].join(":");

  const now =
    Date.now();

  const cached =
    manifestCache.get(
      cacheKey,
    );

  /*
   * Three tabs/sidebar mounts hitting at once now cost essentially
   * one backend projection instead of three.
   */
  if (
    cached &&
    now - cached.cachedAt <
      MANIFEST_CACHE_TTL_MS
  ) {
    return NextResponse.json(
      {
        success:
          true,
        manifest:
          cached.manifest,
      },
      {
        headers: {
          "x-brixta-workspace-cache":
            "hit",
        },
      },
    );
  }

  let pending =
    manifestInFlight.get(
      cacheKey,
    );

  if (!pending) {
    pending =
      resolveWorkspaceManifest(
        auth.session,
      );

    manifestInFlight.set(
      cacheKey,
      pending,
    );
  }

  try {
    const manifest =
      await pending;

    manifestCache.set(
      cacheKey,
      {
        cachedAt:
          Date.now(),

        manifest,
      },
    );

    return NextResponse.json(
      {
        success:
          true,
        manifest,
      },
      {
        headers: {
          "x-brixta-workspace-cache":
            "miss",
        },
      },
    );
  } catch (error) {
    /*
     * Do not destroy the dashboard because the backend had a transient
     * socket/database hiccup. A recently valid manifest is safer than
     * replacing the entire shell with HTTP 500.
     */
    if (
      cached &&
      now - cached.cachedAt <
        MANIFEST_STALE_TTL_MS
    ) {
      console.warn(
        "Workspace manifest backend error; serving stale manifest:",
        error,
      );

      return NextResponse.json(
        {
          success:
            true,

          manifest:
            cached.manifest,

          stale:
            true,
        },
        {
          headers: {
            "x-brixta-workspace-cache":
              "stale",
          },
        },
      );
    }

    console.error(
      "Workspace manifest backend error:",
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve workspace.",
      },
      {
        status:
          500,
      },
    );
  } finally {
    if (
      manifestInFlight.get(
        cacheKey,
      ) === pending
    ) {
      manifestInFlight.delete(
        cacheKey,
      );
    }
  }
}
