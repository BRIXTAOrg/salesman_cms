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

function isCapabilitiesCollection(
  path: string[],
) {
  return (
    path.length === 1 &&
    path[0] === "capabilities"
  );
}

function isCapabilityItem(
  path: string[],
) {
  return (
    path.length === 2 &&
    path[0] === "capabilities" &&
    /^\d+$/.test(path[1])
  );
}

function parseJsonBody(
  body: string | undefined,
) {
  if (!body) return {};

  try {
    const parsed = JSON.parse(body);

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function proxy(
  request: NextRequest,
  context: RouteContext,
) {
  const write =
    request.method !== "GET" &&
    request.method !== "HEAD";

  const auth =
    await requireApplianceSession(write);

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

  const { path } = await context.params;

  let body: string | undefined;

  if (write) {
    const text = await request.text();
    body = text || undefined;
  }

  /**
   * Paywall enforcement belongs on the server boundary, not only in the
   * React UI.
   *
   * Built-in capabilities are provisioned directly during signup. A
   * customer-created capability therefore always comes through this POST.
   */
  if (
    request.method === "POST" &&
    isCapabilitiesCollection(path)
  ) {
    const entitled =
      await hasTenantEntitlement(
        auth.session.schemaName,
        ENTITLEMENT_KEYS.RESPONSIBILITY_CREATE,
      );

    if (!entitled) {
      return NextResponse.json(
        {
          success: false,
          code: "ENTITLEMENT_REQUIRED",
          feature:
            ENTITLEMENT_KEYS.RESPONSIBILITY_CREATE,
          error:
            "Custom responsibility creation is not enabled for this company.",
        },
        { status: 403 },
      );
    }

    try {
      const parsed = parseJsonBody(body);
      const existingConfig =
        parsed.config &&
        typeof parsed.config === "object" &&
        !Array.isArray(parsed.config)
          ? parsed.config
          : {};

      /**
       * Customers no longer choose internal engine types.
       * Custom responsibilities are currently generic dynamic forms.
       * Native/tracking/report/etc. remain engine-internal concepts.
       */
      parsed.type = "form";
      parsed.config = {
        ...existingConfig,
        origin: "custom",
        renderer: "dynamic_v1",
      };

      body = JSON.stringify(parsed);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Invalid request body.",
        },
        { status: 400 },
      );
    }
  }

  /**
   * Prevent the CMS client from changing a capability's engine type.
   * Engine type is implementation metadata, not a tenant-admin setting.
   */
  if (
    request.method === "PATCH" &&
    isCapabilityItem(path) &&
    body
  ) {
    try {
      const parsed = parseJsonBody(body);

      if ("type" in parsed) {
        delete parsed.type;
      }

      body = JSON.stringify(parsed);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Invalid request body.",
        },
        { status: 400 },
      );
    }
  }

  const encodedPath = path
    .map((part) => encodeURIComponent(part))
    .join("/");

  const query = request.nextUrl.search;

  const upstreamPath =
    `/api/admin/appliance/${encodedPath}${query}`;

  try {
    const upstream =
      await applianceBackendFetch(
        upstreamPath,
        auth.session,
        {
          method: request.method,
          body,
          headers: {
            "content-type":
              request.headers.get(
                "content-type",
              ) ?? "application/json",
          },
        },
      );

    return NextResponse.json(
      await forwardBackendJson(upstream),
      {
        status: upstream.status,
      },
    );
  } catch (error) {
    console.error(
      "Appliance backend proxy error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach Field Control backend.",
      },
      {
        status: 500,
      },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
