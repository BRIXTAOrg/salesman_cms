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
  hasCompanyLink,
  rememberCompanyLink,
} from "@/lib/company-links";
import {
  clearAccountFailures,
  clientAddress,
  loginRules,
  recordFailure,
  throttleWait,
  tooManyAttemptsMessage,
} from "@/lib/login-throttle";
import {
  hashPassword,
  verifyStoredPassword,
} from "@/lib/password";
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
  const password =
    typeof body?.password === "string" ? body.password : "";

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

  // BRIXTA_COMPANY_SWITCH_PROOF_V1
  const throttle = loginRules({
    scope: "cms-switch",
    address: clientAddress(request),
    account: `${organization.schemaName}:${session.email}`,
  });
  const wait = throttleWait(throttle);

  if (wait > 0) {
    return NextResponse.json(
      { success: false, error: tooManyAttemptsMessage(wait) },
      { status: 429, headers: { "retry-after": String(wait) } },
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
        return { ok: false as const, reason: "no_access" as const };
      }

      // Same email is not proof of the same person. Ask for this
      // company's password unless this browser already proved it.
      const linked = await hasCompanyLink(
        session.email,
        organization.schemaName,
        user.id,
      );

      if (!linked) {
        if (!password) {
          return { ok: false as const, reason: "password_required" as const };
        }

        const check = await verifyStoredPassword(
          user.dashboardHashedPassword,
          password,
        );

        if (!check.ok) {
          return { ok: false as const, reason: "password_invalid" as const };
        }

        if (check.needsUpgrade) {
          await tx
            .update(users)
            .set({ dashboardHashedPassword: await hashPassword(password) })
            .where(eq(users.id, user.id));
        }
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
        return { ok: false as const, reason: "no_access" as const };
      }

      return {
        ok: true as const,
        linked,
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

  if (!target.ok) {
    if (target.reason === "password_required") {
      return NextResponse.json(
        {
          success: false,
          code: "PASSWORD_REQUIRED",
          company: organization.name,
          error: `Enter your ${organization.name} password to switch.`,
        },
        { status: 401 },
      );
    }

    if (target.reason === "password_invalid") {
      recordFailure(throttle);
      return NextResponse.json(
        {
          success: false,
          code: "PASSWORD_INVALID",
          company: organization.name,
          error: "That password is not right for this company.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Your account does not have active dashboard access inside that company.",
      },
      { status: 403 },
    );
  }

  clearAccountFailures(throttle);

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

  // Remember the proof under the email the new session will carry, so
  // switching back and forth stays one click.
  await rememberCompanyLink(
    target.user.email,
    organization.schemaName,
    target.user.id,
  );

  if (target.user.email.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
    // Keep the company we came from switchable too.
    await rememberCompanyLink(
      target.user.email,
      session.schemaName,
      session.userId,
    );
  }

  return NextResponse.json({
    success: true,
    organization,
    redirect: "/dashboard",
  });
}
