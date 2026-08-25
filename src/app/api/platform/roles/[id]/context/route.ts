import { NextRequest, NextResponse } from "next/server";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  getRoleContextDefinition,
  saveRoleContextDefinition,
} from "@/lib/roles/role-context-store";

type Context = {
  params: Promise<{ id: string }>;
};

function roleIdFrom(value: string) {
  const roleId = Number(value);
  return Number.isInteger(roleId) && roleId > 0 ? roleId : null;
}

export const GET = withTenantDb<Context>(
  async (_request, db, _session, context) => {
    await ensureTenantPlatformVNext(db);

    const { id } = await context.params;
    const roleId = roleIdFrom(id);
    if (!roleId) {
      return NextResponse.json(
        { success: false, error: "Invalid Role id." },
        { status: 400 },
      );
    }

    const definition = await getRoleContextDefinition(db, roleId);
    if (!definition) {
      return NextResponse.json(
        { success: false, error: "Role not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, definition });
  },
);

export const PUT = withTenantDb<Context>(
  async (request: NextRequest, db, session, context) => {
    if (!hasPermission(session.permissions, ["MANAGE_USERS", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);

    const { id } = await context.params;
    const roleId = roleIdFrom(id);
    if (!roleId) {
      return NextResponse.json(
        { success: false, error: "Invalid Role id." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 },
      );
    }

    const definition = await saveRoleContextDefinition(db, {
      roleId,
      value: (body as { definition?: unknown }).definition ?? body,
      updatedByUserId: session.userId,
    });

    if (!definition) {
      return NextResponse.json(
        { success: false, error: "Role not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      definition,
      message:
        "Role Context saved. Responsibilities targeting this Role can now inherit these capabilities and workflow routes.",
    });
  },
);
