import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  cookies,
} from "next/headers";
import {
  eq,
} from "drizzle-orm";

import {
  encrypt,
} from "@/lib/auth";
import {
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
  burnPasswordCheck,
  hashPassword,
  verifyStoredPassword,
} from "@/lib/password";
import {
  db,
  withTenantSchema,
} from "@/lib/drizzle";
import {
  roles,
  userRoles,
  users,
} from "../../../../../drizzle/schema";
import {
  organizations,
} from "../../../../../drizzle/publicSchema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyCode = String(body?.companyCode ?? "").trim().toLowerCase();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!companyCode || !email || !password) {
      return NextResponse.json(
        { error: "Company code, email and password are required" },
        { status: 400 },
      );
    }

    // BRIXTA_LOGIN_HARDENING_V1
    const throttle = loginRules({
      scope: "cms-login",
      address: clientAddress(request),
      account: `${companyCode}:${email}`,
    });
    const wait = throttleWait(throttle);

    if (wait > 0) {
      return NextResponse.json(
        { error: tooManyAttemptsMessage(wait) },
        { status: 429, headers: { "retry-after": String(wait) } },
      );
    }

    // Tenant resolution is the only deliberately public-schema query.
    const [org] = await db
      .select({
        schemaName: organizations.schemaName,
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.schemaName, companyCode))
      .limit(1);

    if (!org) {
      await burnPasswordCheck(password);
      recordFailure(throttle);
      return NextResponse.json(
        { error: "Invalid company code, email or password" },
        { status: 401 },
      );
    }

    const result = await withTenantSchema(
      org.schemaName,
      async (tx) => {
        const [user] = await tx
          .select({
            id: users.id,
            email: users.email,
            username: users.username,
            status: users.status,
            isDashboardUser: users.isDashboardUser,
            dashboardLoginId: users.dashboardLoginId,
            dashboardHashedPassword: users.dashboardHashedPassword,
            isSalesAppUser: users.isSalesAppUser,
          })
          .from(users)
          .where(eq(users.dashboardLoginId, email))
          .limit(1);

        // Password first: account state is only revealed to someone who
        // already knows the password.
        const check = await verifyStoredPassword(
          user?.dashboardHashedPassword,
          password,
        );

        if (!user || !check.ok) {
          return {
            ok: false as const,
            status: 401,
            error: "Invalid company code, email or password",
            countsAsFailure: true,
          };
        }

        if (check.needsUpgrade) {
          // Legacy plaintext password matched: store it hashed from now on.
          await tx
            .update(users)
            .set({
              dashboardHashedPassword: await hashPassword(password),
            })
            .where(eq(users.id, user.id));
        }

        if (!user.isDashboardUser) {
          return {
            ok: false as const,
            status: 403,
            error: "Dashboard access is not enabled for this account",
          };
        }

        // IMPORTANT: login must never reactivate a suspended/inactive user.
        if (user.status !== "active") {
          return {
            ok: false as const,
            status: 403,
            error: "This dashboard account is not active",
          };
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
          return {
            ok: false as const,
            status: 403,
            error: "Dashboard permissions are not configured for this account",
          };
        }

        const orgRole =
          roleRows
            .map((row) => row.orgRole)
            .find((value): value is string => Boolean(value)) ?? "";

        const jobRoles = Array.from(
          new Set(
            roleRows
              .map((row) => row.jobRole)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        return {
          ok: true as const,
          user,
          orgRole,
          jobRoles,
          permissions,
        };
      },
    );

    if (!result.ok) {
      if ("countsAsFailure" in result && result.countsAsFailure) {
        recordFailure(throttle);
      }
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    clearAccountFailures(throttle);

    const token = await encrypt({
      userId: result.user.id,
      schemaName: org.schemaName,
      companyName: org.name,
      email: result.user.email,
      username: result.user.username,
      orgRole: result.orgRole,
      jobRoles: result.jobRoles,
      permissions: result.permissions,
    });

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    await rememberCompanyLink(
      result.user.email,
      org.schemaName,
      result.user.id,
    );

    return NextResponse.json(
      {
        message: "Login successful",
        redirect: "/dashboard",
        user: {
          isDashboardUser: result.user.isDashboardUser,
          isSalesAppUser: result.user.isSalesAppUser,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
