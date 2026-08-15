
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

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

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
  const encodedPath = path
    .map((part) => encodeURIComponent(part))
    .join("/");

  const query = request.nextUrl.search;
  const upstreamPath =
    `/api/admin/appliance/${encodedPath}${query}`;

  let body: string | undefined;

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    const text = await request.text();
    body = text || undefined;
  }

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
              request.headers.get("content-type") ??
              "application/json",
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
