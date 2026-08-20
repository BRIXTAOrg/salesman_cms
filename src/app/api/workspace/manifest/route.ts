import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  buildWorkspaceManifest,
} from "@/lib/workspace-manifest";

export const GET = withTenantDb(
  async (
    _request: NextRequest,
    db,
    session,
  ) => {
    const manifest =
      await buildWorkspaceManifest(
        db,
        session,
      );

    return NextResponse.json(
      {
        success: true,
        manifest,
      },
      {
        status: 200,
      },
    );
  },
);
