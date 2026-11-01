import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { entityTypes, platformMeta, platformAuditEvents } from "../../../../../drizzle/platformVNextSchema";
import { users } from "../../../../../drizzle/schema";
import { readFieldAppConfig } from "@/lib/field-app-contract";

// BRIXTA_CRM_ACCESS_UX_V1: policy lives in existing tenant platform_meta; no migration.
// App Experience defines presentation. Employee Management defines access.
const keyFor = (id: number) => `field-access:v1:${id}`;
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const defaultPolicy = {
  listIds: null as number[] | null,
  recordScope: "inherit" as "inherit" | "assigned_only" | "all",
  viewOtherHistory: true,
  viewPhotos: true,
  editOtherSites: false,
};
function normalize(raw: unknown) {
  const v = obj(raw);
  const validIds = Array.isArray(v.listIds)
    ? [...new Set(v.listIds.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
    : null;
  return {
    listIds: validIds,
    recordScope: v.recordScope === "assigned_only" || v.recordScope === "all" ? v.recordScope : "inherit",
    viewOtherHistory: v.viewOtherHistory !== false,
    viewPhotos: v.viewPhotos !== false,
    editOtherSites: v.editOtherSites === true,
  };
}
const invalid = (message: string, code = 400) => NextResponse.json({ success: false, error: message }, { status: code });

export const GET = withTenantDb(async (request: NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS") && !session.permissions.includes("MANAGE_USERS")) return invalid("Employee management permission required.", 403);
  const employeeId = Number(new URL(request.url).searchParams.get("employeeId"));
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return invalid("Invalid employee.");
  const [employee] = await db.select({id: users.id}).from(users).where(eq(users.id, employeeId)).limit(1);
  if (!employee) return invalid("Employee does not exist.", 404);
  const [entry] = await db.select().from(platformMeta).where(eq(platformMeta.key, keyFor(employeeId))).limit(1);
  const candidates = await db.select().from(entityTypes).where(eq(entityTypes.isActive, true));
  const lists = candidates.filter((r) => Boolean(readFieldAppConfig(r.config, r.title)))
    .map((r) => ({id: r.id, title: r.title})).sort((a,b) => a.title.localeCompare(b.title));
  return NextResponse.json({success:true, policy: entry ? normalize(entry.value) : defaultPolicy,
    customized: Boolean(entry), lists}, {headers:{"Cache-Control":"no-store"}});
});

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  // Direct employee access grants can elevate visibility; administrator only.
  if (!session.permissions.includes("ALL_ACCESS")) return invalid("ALL_ACCESS administrator required to change CRM visibility.", 403);
  const body = obj(await request.json().catch(() => null));
  const employeeId = Number(body.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return invalid("Invalid employee.");
  const [employee] = await db.select({id: users.id}).from(users).where(eq(users.id, employeeId)).limit(1);
  if (!employee) return invalid("Employee does not exist.", 404);
  const proposal = obj(body.policy);
  if (!(["inherit", "assigned_only", "all"].includes(String(proposal.recordScope))) ||
      (proposal.listIds !== null && (!Array.isArray(proposal.listIds) || proposal.listIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0))) ||
      [proposal.viewOtherHistory,proposal.viewPhotos,proposal.editOtherSites].some((value) => typeof value !== "boolean")) {
    return invalid("Invalid CRM access policy.", 422);
  }
  const policy = normalize(proposal);
  if (policy.listIds !== null) {
    const ids = await db.select({id: entityTypes.id}).from(entityTypes).where(eq(entityTypes.isActive, true));
    if (policy.listIds.some(id => !ids.some(t => t.id === id))) return invalid("One or more CRM datasets no longer exist.", 409);
  }
  const key = keyFor(employeeId);
  const [before] = await db.select().from(platformMeta).where(eq(platformMeta.key, key)).limit(1).for("update");
  const previous = before ? normalize(before.value) : defaultPolicy;
  const now = new Date();
  await db.insert(platformMeta).values({key, value: policy, updatedAt: now})
    .onConflictDoUpdate({target:platformMeta.key,set:{value:policy,updatedAt:now}});
  await db.insert(platformAuditEvents).values({
    actorUserId:session.userId, eventType:"employee.field_access_updated",
    subjectType:"employee", subjectId:String(employeeId),
    payload:{before:previous,after:policy,byName:session.username ?? session.email ?? null},
  });
  return NextResponse.json({success:true,policy});
});
