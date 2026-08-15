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

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
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

  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid employee ID.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const body = await request.json();

    const upstream =
      await mobileWorkspaceBackendFetch(
        `/api/admin/flow1/employees/${id}/capabilities`,
        {
          method: "PUT",
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
      "Mobile workspace employee capability update error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update employee capabilities.",
      },
      {
        status: 500,
      },
    );
  }
}
