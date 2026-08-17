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

export async function GET() {
  const auth =
    await requireApplianceSession();

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
      await applianceBackendFetch(
        "/api/admin/appliance/employees",
        auth.session,
      );

    return NextResponse.json(
      await forwardBackendJson(upstream),
      {
        status: upstream.status,
      },
    );
  } catch (error) {
    console.error(
      "Mobile workspace employees GET error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load employees.",
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
    await requireApplianceSession(true);

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
      await applianceBackendFetch(
        "/api/admin/appliance/employees",
        auth.session,
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
      "Mobile workspace employees POST error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create employee.",
      },
      {
        status: 500,
      },
    );
  }
}