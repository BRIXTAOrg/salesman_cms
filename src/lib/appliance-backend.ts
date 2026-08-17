import "server-only";

import { hasPermission, verifySession } from "@/lib/auth";

const rawBackendUrl = process.env.SALESAPP_BACKEND_URL;
const adminSecret =
  process.env.ADMIN_SERVICE_SECRET ??
  process.env.FLOW1_ADMIN_SECRET;

export async function requireApplianceSession(
  write = false,
) {
  const session = await verifySession();

  if (!session?.userId) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  if (!session.schemaName) {
    // Session predates schemaName being part of the JWT -- force a clean
    // re-login rather than forwarding x-tenant-schema: "undefined",
    // which the backend would just reject with a confusing 403 instead.
    return {
      ok: false as const,
      status: 401,
      error: "Session expired. Please sign in again.",
    };
  }

  const required = write
    ? ["WRITE", "UPDATE", "ALL_ACCESS"]
    : ["READ", "WRITE", "UPDATE", "ALL_ACCESS"];

  if (!hasPermission(session.permissions, required)) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden: insufficient permissions",
    };
  }

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