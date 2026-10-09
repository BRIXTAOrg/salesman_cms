// BRIXTA_FIELD_OPS_PRESENCE_V1: best-effort local CMS-process heartbeats.
// No schema changes and no record writes. This is NOT cross-server presence.
import { NextRequest, NextResponse } from "next/server";
import { and, gte, isNotNull } from "drizzle-orm";
import { hasPermission, withTenantDb } from "@/lib/auth";
import { employeeRuntimeState } from "../../../../../../drizzle/applianceSchema";

const TTL_MS = 90_000;
const PHONE_WINDOW_MS = 10 * 60_000;
type Heartbeat = { userId: number; name: string; mode: "viewing" | "working"; seen: number };
const globalState = globalThis as typeof globalThis & { __brixtaFieldOpsPresence?: Map<string, Heartbeat> };
const presence = globalState.__brixtaFieldOpsPresence ?? (globalState.__brixtaFieldOpsPresence = new Map());

function key(tenant: string, list: number, tab: string) { return `${tenant}|${list}|${tab}`; }
function parseList(raw: unknown) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function sweep(now: number) {
  for (const [id, entry] of presence) if (now - entry.seen > TTL_MS) presence.delete(id);
  if (presence.size > 4_000) presence.clear(); // best-effort memory limit
}
const permission = ["READ", "WRITE", "UPDATE", "ALL_ACCESS"];

export const POST = withTenantDb(async (req: NextRequest, _db, session) => {
  if (!hasPermission(session.permissions, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const listId = parseList(body?.listId);
  const tab = typeof body?.tab === "string" ? body.tab : "";
  if (!listId || !/^[a-zA-Z0-9_-]{10,80}$/.test(tab)) {
    return NextResponse.json({ error: "Invalid heartbeat" }, { status: 400 });
  }
  const now = Date.now();
  sweep(now);
  presence.set(key(session.schemaName, listId, tab), {
    userId: session.userId,
    name: String(session.username || session.email || `Admin ${session.userId}`).slice(0, 90),
    mode: body?.mode === "working" ? "working" : "viewing",
    seen: now,
  });
  return NextResponse.json({ success: true });
});

export const GET = withTenantDb(async (req: NextRequest, db, session) => {
  if (!hasPermission(session.permissions, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const listId = parseList(req.nextUrl.searchParams.get("list"));
  if (!listId) return NextResponse.json({ error: "Choose a list" }, { status: 400 });
  const now = Date.now();
  sweep(now);
  const viewers = new Map<number, Heartbeat>();
  for (const [id, entry] of presence) {
    if (!id.startsWith(`${session.schemaName}|${listId}|`)) continue;
    const previous = viewers.get(entry.userId);
    if (!previous || entry.mode === "working" || entry.seen > previous.seen) viewers.set(entry.userId, entry);
  }
  // Mobile activity comes from EXISTING device heartbeats. It is tenant-wide
  // and does NOT establish that a device is actually looking at this list.
  const recentlyActive = await db.select({ userId: employeeRuntimeState.userId })
    .from(employeeRuntimeState)
    .where(and(isNotNull(employeeRuntimeState.lastSeenAt),
      gte(employeeRuntimeState.lastSeenAt, new Date(now - PHONE_WINDOW_MS))))
    .limit(5000);
  const active = [...viewers.values()].sort((a, b) => b.seen - a.seen);
  return NextResponse.json({
    success: true,
    scope: "this CMS process only; up to 90 seconds after last heartbeat",
    cmsViewers: active.length,
    cmsWorking: active.filter(x => x.mode === "working").length,
    people: active.map(x => ({ name: x.name, mode: x.mode })),
    mobileRecentlyConnectedTenantWide: recentlyActive.length,
    mobileWindowMinutes: 10,
    mobileListViewingAvailable: false,
  });
});
