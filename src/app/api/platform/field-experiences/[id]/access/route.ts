// BRIXTA_LINKED_MODULE_ACCESS_V2: grant access to a module, never to CRM rows.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { users } from "../../../../../../../drizzle/schema";
import { entityTypes, platformAuditEvents } from "../../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };
const deny = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const obj = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const idsOf = (raw: unknown) => Array.isArray(raw)
  ? [...new Set(raw.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].sort((a,b) => a-b)
  : [];

export const GET = withTenantDb<Context>(async (_request: NextRequest, db, session, context) => {
  if (!session.permissions.includes("ALL_ACCESS")) return deny("Administrator access required.", 403);
  await ensureTenantPlatformVNext(db);
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return deny("Invalid module.");
  const [module] = await db.select().from(entityTypes).where(eq(entityTypes.id, id)).limit(1);
  // BRIXTA_MAIN_EXPERIENCE_EMPLOYEE_ACCESS_V1_20261102
  // Main AND linked App Experiences use the same roster API. No data is moved.
  if (!module || !module.isActive || !(obj(module.config).fieldSource || obj(module.config).fieldApp || obj(module.config).fieldAppDraft))
    return deny("App Experience not found.", 404);
  const people = await db.select({ id:users.id, displayName:users.displayName, username:users.username })
    .from(users).where(and(eq(users.status,"active"),eq(users.isSalesAppUser,true)));
  const policy = obj(obj(module.config).fieldModuleAccess);
  const linked = Boolean(obj(module.config).fieldSource);
  // Legacy Main remains untouched until an admin chooses Selected-only.
  const accessMode = linked || policy.mode === "selected" ? "selected" : "legacy";
  const employeeIds = idsOf(policy.employeeIds);
  return NextResponse.json({success:true,moduleId:id,title:module.title,employeeIds,linked,accessMode,
    employees: people.map(person => ({ id:person.id,name:person.displayName || person.username || `Employee ${person.id}` }))
      .sort((a,b) => a.name.localeCompare(b.name)) },
    {headers:{"Cache-Control":"no-store"}});
});

export const POST = withTenantDb<Context>(async (request:NextRequest,db,session,context) => {
  if (!session.permissions.includes("ALL_ACCESS")) return deny("Administrator access required.",403);
  await ensureTenantPlatformVNext(db);
  const id=Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return deny("Invalid module.");
  const body=obj(await request.json().catch(() => null));
  if (!Array.isArray(body.employeeIds) || body.employeeIds.length>200 ||
      body.employeeIds.some(v => !Number.isSafeInteger(v) || Number(v)<1))
    return deny("Select up to 200 valid employees.",422);
  const employeeIds=idsOf(body.employeeIds);
  const [module]=await db.select().from(entityTypes).where(eq(entityTypes.id,id)).limit(1).for("update");
  if (!module || !module.isActive || !(obj(module.config).fieldSource || obj(module.config).fieldApp || obj(module.config).fieldAppDraft))
    return deny("App Experience not found.",404);
  const linked = Boolean(obj(module.config).fieldSource);
  // Existing linked clients may omit accessMode; linked is always selected-only.
  // Main clients MUST explicitly choose the access mode to avoid lockouts.
  const accessMode = linked ? "selected" : body.accessMode;
  if (linked && body.accessMode !== undefined && body.accessMode !== "selected")
    return deny("A linked App Experience must use selected employees.",422);
  if (accessMode !== "legacy" && accessMode !== "selected")
    return deny("Choose Existing access or Selected employees only.",422);
  if (employeeIds.length) {
    const people=await db.select({id:users.id}).from(users)
      .where(and(inArray(users.id,employeeIds),eq(users.status,"active"),eq(users.isSalesAppUser,true)));
    if (people.length!==employeeIds.length) return deny("An employee is inactive or cannot use Field.",409);
  }
  const config=obj(module.config);
  const previous=idsOf(obj(config.fieldModuleAccess).employeeIds);
  // Preserve published/draft configs and all source CRM references unchanged.
  await db.update(entityTypes).set({config:{...config,fieldModuleAccess:{...obj(config.fieldModuleAccess),employeeIds,mode:accessMode,updatedAt:new Date().toISOString()}},updatedAt:new Date()})
    .where(eq(entityTypes.id,id));
  await db.insert(platformAuditEvents).values({actorUserId:session.userId,
    eventType:"field_module.access_updated",subjectType:"entity_type",subjectId:String(id),
    payload:{before:previous,after:employeeIds,previousMode:obj(config.fieldModuleAccess).mode ?? "legacy",
      accessMode,linked,sourceListId:obj(config.fieldSource).sourceListId ?? id}});
  return NextResponse.json({success:true,employeeIds});
});
