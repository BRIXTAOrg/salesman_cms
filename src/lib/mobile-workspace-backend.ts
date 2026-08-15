import "server-only";

import { hasPermission, verifySession } from "@/lib/auth";

const rawBackendUrl = process.env.SALESAPP_BACKEND_URL;
const adminSecret = process.env.FLOW1_ADMIN_SECRET;

export async function requireMobileWorkspaceAdmin() {
  const session = await verifySession();

  if (!session?.userId) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
    };
  }

  if (
    !hasPermission(session.permissions, [
      "WRITE",
      "UPDATE",
      "ALL_ACCESS",
    ])
  ) {
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

export async function mobileWorkspaceBackendFetch(
  path: string,
  init: RequestInit = {},
) {
  if (!rawBackendUrl) {
    throw new Error(
      "SALESAPP_BACKEND_URL is not configured.",
    );
  }

  if (!adminSecret) {
    throw new Error(
      "FLOW1_ADMIN_SECRET is not configured.",
    );
  }

  const backendUrl = rawBackendUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const headers = new Headers(init.headers);
  headers.set("x-flow1-admin-secret", adminSecret);

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
