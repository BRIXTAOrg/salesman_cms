import "server-only";

import {
  NextResponse,
  connection,
} from "next/server";

import { verifySession } from "@/lib/auth";
import { getTenantEntitlements } from "@/lib/entitlements";

export async function GET() {
  await connection();

  try {
    const session = await verifySession();

    if (!session?.userId || !session.schemaName) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    /**
     * Entitlements are read fresh from the database instead of being
     * embedded in the 7-day session token. Plan/feature changes therefore
     * become visible to the UI immediately on the next /api/me request.
     */
    const entitlements =
      await getTenantEntitlements(
        session.schemaName,
      );

    return NextResponse.json(
      {
        ...session,
        entitlements,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Error fetching current user:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to fetch current user",
      },
      { status: 500 },
    );
  }
}
