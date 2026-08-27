// BRIXTA_PIXEL_LOGIC_KERNEL_V1
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { isPixelLogicAssigned } from "@/lib/pixel-logic-assignment";
import {
  normalizePixelLogicProgram,
  PIXEL_LOGIC_METADATA_KEY,
} from "@/lib/pixel-logic-types";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  responsibilityExtensions,
} from "../../../../../../drizzle/platformVNextSchema";

type Context = {
  params: Promise<{ responsibilityId: string }>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Host/mobile-facing gate for Pixel Logic.
 *
 * A published graph is returned only when:
 *   1) this employee has Pixel Logic ticked for the Responsibility, and
 *   2) the Responsibility has a published Pixel Logic program.
 */
export const GET = withTenantDb<Context>(
  async (request: NextRequest, db, _session, context) => {
    await ensureTenantPlatformVNext(db);

    const { responsibilityId: raw } = await context.params;
    const responsibilityId = Number(raw);
    const employeeId = Number(request.nextUrl.searchParams.get("employeeId"));

    if (!Number.isInteger(responsibilityId) || responsibilityId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid Responsibility id." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: "employeeId query parameter is required." },
        { status: 400 },
      );
    }

    const assigned = await isPixelLogicAssigned(
      db,
      employeeId,
      responsibilityId,
    );

    if (!assigned) {
      return NextResponse.json({
        success: true,
        assigned: false,
        responsibilityId,
        employeeId,
        program: null,
      });
    }

    const [extension] = await db
      .select({
        publishedConfig: responsibilityExtensions.publishedConfig,
        publishedVersion: responsibilityExtensions.publishedVersion,
      })
      .from(responsibilityExtensions)
      .where(eq(responsibilityExtensions.responsibilityId, responsibilityId))
      .limit(1);

    const extensionObject = asObject(extension?.publishedConfig);
    const metadata = asObject(extensionObject.metadata);
    const rawProgram = metadata[PIXEL_LOGIC_METADATA_KEY];
    const program = rawProgram
      ? normalizePixelLogicProgram(rawProgram)
      : null;

    return NextResponse.json({
      success: true,
      assigned: true,
      responsibilityId,
      employeeId,
      publishedVersion: extension?.publishedVersion ?? 0,
      program,
    });
  },
);
