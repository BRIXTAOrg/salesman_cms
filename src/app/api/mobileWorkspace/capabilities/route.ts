import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  forwardBackendJson,
  mobileWorkspaceBackendFetch,
  requireMobileWorkspaceAdmin,
} from "@/lib/mobile-workspace-backend";

export async function GET() {
  const auth =
    await requireMobileWorkspaceAdmin();

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
    const upstream =
      await mobileWorkspaceBackendFetch(
        "/api/admin/flow1/capabilities",
      );

    return NextResponse.json(
      await forwardBackendJson(upstream),
      {
        status: upstream.status,
      },
    );
  } catch (error) {
    console.error(
      "Mobile workspace capabilities GET error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load capabilities.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  const auth =
    await requireMobileWorkspaceAdmin();

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
    const body = await request.json();

    const upstream =
      await mobileWorkspaceBackendFetch(
        "/api/admin/flow1/capabilities",
        {
          method: "POST",
          body: JSON.stringify(body),
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
      "Mobile workspace capabilities POST error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create capability.",
      },
      {
        status: 500,
      },
    );
  }
}
