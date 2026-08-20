import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  applianceBackendFetch,
  forwardBackendJson,
  requireApplianceSession,
} from "@/lib/appliance-backend";
import {
  ENTITLEMENT_KEYS,
  hasTenantEntitlement,
} from "@/lib/entitlements";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function isResponsibilityWrite(
  method: string,
  path: string[],
) {
  return (
    path[0] === "responsibilities" &&
    ["POST", "PATCH", "PUT", "DELETE"].includes(method)
  );
}

function isWorkflowWrite(
  method: string,
  path: string[],
) {
  return (
    path[0] === "workflows" &&
    ["POST", "PATCH", "PUT", "DELETE"].includes(method)
  );
}

async function entitlementGuard(
  schemaName: string,
  method: string,
  path: string[],
) {
  const feature = isResponsibilityWrite(method, path)
    ? ENTITLEMENT_KEYS.RESPONSIBILITY_CREATE
    : isWorkflowWrite(method, path)
      ? ENTITLEMENT_KEYS.WORKFLOW_CUSTOMIZE
      : null;

  if (!feature) {
    return null;
  }

  if (
    await hasTenantEntitlement(
      schemaName,
      feature,
    )
  ) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      code: "ENTITLEMENT_REQUIRED",
      feature,
      error:
        feature === ENTITLEMENT_KEYS.WORKFLOW_CUSTOMIZE
          ? "Workflow customization is not enabled for this company."
          : "Responsibility customization is not enabled for this company.",
    },
    { status: 403 },
  );
}

async function proxy(
  request: NextRequest,
  context: RouteContext,
) {
  const write = ![
    "GET",
    "HEAD",
  ].includes(request.method);

  const auth =
    await requireApplianceSession(write);

  if (!auth.ok) {
    return NextResponse.json(
      {
        success: false,
        error: auth.error,
      },
      { status: auth.status },
    );
  }

  const { path } = await context.params;

  const blocked = await entitlementGuard(
    auth.session.schemaName,
    request.method,
    path,
  );

  if (blocked) {
    return blocked;
  }

  const encodedPath = path
    .map((part) => encodeURIComponent(part))
    .join("/");

  const upstreamPath =
    `/api/admin/appliance/${encodedPath}${request.nextUrl.search}`;

  let body: string | undefined;

  if (write) {
    const text = await request.text();
    body = text || undefined;
  }

  try {
    const upstream = await applianceBackendFetch(
      upstreamPath,
      auth.session,
      {
        method: request.method,
        body,
        headers: body
          ? {
              "content-type":
                request.headers.get("content-type") ??
                "application/json",
            }
          : undefined,
      },
    );

    return NextResponse.json(
      await forwardBackendJson(upstream),
      { status: upstream.status },
    );
  } catch (error) {
    console.error(
      "Platform Core backend proxy error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the BRIXTA backend.",
      },
      { status: 500 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
