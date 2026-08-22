import { NextResponse } from "next/server";

import { verifySession } from "@/lib/auth";
import { listOrganizationsForAccountEmail } from "@/lib/account-platform";

export async function GET() {
  const session = await verifySession();

  if (!session?.email) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const organizations = await listOrganizationsForAccountEmail(session.email);

    return NextResponse.json({
      success: true,
      currentSchemaName: session.schemaName,
      organizations,
    });
  } catch (error) {
    console.error("Account organizations error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load companies.",
      },
      { status: 500 },
    );
  }
}
