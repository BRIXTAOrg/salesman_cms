import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import {
  encrypt,
  verifySession,
} from "@/lib/auth";
import {
  findOrganizationForAccountEmail,
} from "@/lib/account-platform";
import {
  withTenantSchema,
} from "@/lib/drizzle";
import {
  roles,
  userRoles,
  users,
} from "../../../../../drizzle/schema";

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session?.email) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const organizationId = Number(body?.organizationId);

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return NextResponse.json(
      { success: false, error: "organizationId is required." },
      { status: 400 },
    );
  }

  const organization = await findOrganizationForAccountEmail(
    session.email,
    organizationId,
  );

  if (!organization) {
    return NextResponse.json(
      { success: false, error: "You do not have access to that company." },
      { status: 403 },
    );
  }

  const target = await withTenantSchema(
    organization.schemaName,
    async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.dashboardLoginId, session.email))
        .limit(1);

      if (!user || !user.isDashboardUser || user.status !== "active") {
        return null;
      }

      const roleRows = await tx
        .select({
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
          grantedPerms: roles.grantedPerms,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id));

      const permissions = Array.from(
        new Set(
          roleRows.flatMap((row) =>
            Array.isArray(row.grantedPerms)
              ? row.grantedPerms
              : [],
          ),
        ),
      );

      if (permissions.length === 0) {
        return null;
      }

      return {
        user,
        permissions,
        orgRole:
          roleRows
            .map((row) => row.orgRole)
            .find((value): value is string => Boolean(value)) ?? "",
        jobRoles: Array.from(
          new Set(
            roleRows
              .map((row) => row.jobRole)
              .filter((value): value is string => Boolean(value)),
          ),
        ),
      };
    },
  );

  if (!target) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Your account does not have active dashboard access inside that company.",
      },
      { status: 403 },
    );
  }

  const token = await encrypt({
    userId: target.user.id,
    schemaName: organization.schemaName,
    companyName: organization.name,
    email: target.user.email,
    username: target.user.username,
    orgRole: target.orgRole,
    jobRoles: target.jobRoles,
    permissions: target.permissions,
  });

  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return NextResponse.json({
    success: true,
    organization,
    redirect: "/dashboard",
  });
}
