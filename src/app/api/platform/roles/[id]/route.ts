import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import {
  approvalPolicyActors,
} from "../../../../../../drizzle/workflowSchema";
import {
  roles,
  userRoles,
} from "../../../../../../drizzle/schema";

type Context = {
  params: Promise<{ id: string }>;
};

export const PATCH = withTenantDb<Context>(
  async (request: NextRequest, db, session, context) => {
    if (!hasPermission(session.permissions, ["MANAGE_USERS", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const roleId = Number(id);
    const body = await request.json().catch(() => null);

    if (!Number.isInteger(roleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Role id." },
        { status: 400 },
      );
    }

    const patch: Partial<typeof roles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body?.name !== undefined) {
      patch.orgRole = String(body.name).trim();
    }
    if (body?.jobRole !== undefined) {
      patch.jobRole = String(body.jobRole).trim();
    }
    if (body?.description !== undefined) {
      patch.permDescription = body.description
        ? String(body.description)
        : null;
    }
    if (body?.grantedPerms !== undefined) {
      patch.grantedPerms = Array.isArray(body.grantedPerms)
        ? body.grantedPerms.map(String)
        : [];
    }

    const [updated] = await db
      .update(roles)
      .set(patch)
      .where(eq(roles.id, roleId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Role not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      role: {
        ...updated,
        label: updated.orgRole || updated.jobRole || `Role ${updated.id}`,
      },
    });
  },
);

export const DELETE = withTenantDb<Context>(
  async (_request, db, session, context) => {
    if (!hasPermission(session.permissions, ["MANAGE_USERS", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const roleId = Number(id);

    if (!Number.isInteger(roleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Role id." },
        { status: 400 },
      );
    }

    const [employeeUse] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    const [workflowUse] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(approvalPolicyActors)
      .where(eq(approvalPolicyActors.roleId, roleId));

    if ((employeeUse?.count ?? 0) > 0 || (workflowUse?.count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          code: "ROLE_IN_USE",
          error:
            "Role cannot be deleted while employees or Workflow approval policies still use it.",
          dependencies: {
            employees: employeeUse?.count ?? 0,
            workflowActors: workflowUse?.count ?? 0,
          },
        },
        { status: 409 },
      );
    }

    await db.delete(roles).where(eq(roles.id, roleId));
    return NextResponse.json({ success: true });
  },
);
