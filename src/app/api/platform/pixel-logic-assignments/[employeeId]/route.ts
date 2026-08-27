// BRIXTA_PIXEL_LOGIC_KERNEL_V1
import { NextRequest, NextResponse } from "next/server";

import { hasPermission, withTenantDb } from "@/lib/auth";
import {
  getPixelLogicAssignmentIds,
  setPixelLogicAssignmentIds,
} from "@/lib/pixel-logic-assignment";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";

type Context = {
  params: Promise<{ employeeId: string }>;
};

export const GET = withTenantDb<Context>(
  async (_request, db, _session, context) => {
    await ensureTenantPlatformVNext(db);
    const { employeeId: raw } = await context.params;
    const employeeId = Number(raw);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid employee id." },
        { status: 400 },
      );
    }

    const responsibilityIds = await getPixelLogicAssignmentIds(db, employeeId);

    return NextResponse.json({
      success: true,
      employeeId,
      responsibilityIds,
    });
  },
);

export const PUT = withTenantDb<Context>(
  async (request: NextRequest, db, session, context) => {
    if (!hasPermission(session.permissions, ["WRITE", "UPDATE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);
    const { employeeId: raw } = await context.params;
    const employeeId = Number(raw);
    const body = await request.json().catch(() => null);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid employee id." },
        { status: 400 },
      );
    }

    const requested = Array.isArray(body?.responsibilityIds)
      ? body.responsibilityIds
      : [];

    const responsibilityIds = await setPixelLogicAssignmentIds(
      db,
      employeeId,
      requested,
    );

    return NextResponse.json({
      success: true,
      employeeId,
      responsibilityIds,
      message: "Pixel Logic assignments saved.",
    });
  },
);
