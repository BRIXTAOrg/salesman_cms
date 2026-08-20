import "server-only";

import {
  eq,
} from "drizzle-orm";

import {
  hasPermission,
  verifySession,
  type Session,
} from "@/lib/auth";
import {
  withTenantSchema,
} from "@/lib/drizzle";
import {
  roles,
  userRoles,
  users,
} from "../../drizzle/schema";

const rawBackendUrl = process.env.SALESAPP_BACKEND_URL;
const adminSecret =
  process.env.ADMIN_SERVICE_SECRET ??
  process.env.FLOW1_ADMIN_SECRET;

/**
 * Resolve dashboard authorization from the tenant database on every BFF
 * request. The JWT identifies the user + tenant; it is not the authority for
 * current status/roles/permissions.
 */
export async function requireApplianceSession(
  write = false,
) {
  const tokenSession = await verifySession();

  if (!tokenSession?.userId) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  if (!tokenSession.schemaName) {
    return {
      ok: false as const,
      status: 401,
      error: "Session expired. Please sign in again.",
    };
  }

  const fresh = await withTenantSchema(
    tokenSession.schemaName,
    async (db) => {
      const [user] = await db
        .select({
          id: users.id,
          status: users.status,
          isDashboardUser: users.isDashboardUser,
          username: users.username,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, tokenSession.userId))
        .limit(1);

      if (!user) {
        return null;
      }

      const roleRows = await db
        .select({
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
          grantedPerms: roles.grantedPerms,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, tokenSession.userId));

      return {
        user,
        roleRows,
      };
    },
  );

  if (!fresh?.user || !fresh.user.isDashboardUser) {
    return {
      ok: false as const,
      status: 403,
      error: "Dashboard access is not enabled for this account.",
    };
  }

  if (fresh.user.status !== "active") {
    return {
      ok: false as const,
      status: 403,
      error: "This dashboard account is not active.",
    };
  }

  const permissions = Array.from(
    new Set(
      fresh.roleRows.flatMap((row) =>
        Array.isArray(row.grantedPerms)
          ? row.grantedPerms
          : [],
      ),
    ),
  );

  const orgRole =
    fresh.roleRows
      .map((row) => row.orgRole)
      .find((value): value is string => Boolean(value)) ??
    "";

  const jobRoles = Array.from(
    new Set(
      fresh.roleRows
        .map((row) => row.jobRole)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const required = write
    ? ["WRITE", "UPDATE", "ALL_ACCESS"]
    : ["READ", "WRITE", "UPDATE", "ALL_ACCESS"];

  if (!hasPermission(permissions, required)) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden: insufficient permissions",
    };
  }

  const session: Session = {
    ...tokenSession,
    username:
      fresh.user.username ??
      tokenSession.username,
    email:
      fresh.user.email ??
      tokenSession.email,
    orgRole,
    jobRoles,
    permissions,
  };

  return {
    ok: true as const,
    session,
  };
}

export async function applianceBackendFetch(
  path: string,
  session: {
    userId: number;
    username?: string;
    schemaName: string;
  },
  init: RequestInit = {},
) {
  if (!rawBackendUrl) {
    throw new Error(
      "SALESAPP_BACKEND_URL is not configured.",
    );
  }

  if (!adminSecret) {
    throw new Error(
      "ADMIN_SERVICE_SECRET or FLOW1_ADMIN_SECRET is not configured.",
    );
  }

  const backendUrl = rawBackendUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const headers = new Headers(init.headers);
  headers.set("x-admin-service-secret", adminSecret);
  headers.set("x-admin-user-id", String(session.userId));
  headers.set("x-tenant-schema", session.schemaName);

  if (session.username) {
    headers.set("x-admin-username", session.username);
  }

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${backendUrl}${normalizedPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function forwardBackendJson(
  response: Response,
) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: "Backend returned an invalid JSON response.",
      raw: text,
    };
  }
}
