// BRIXTA_LINKED_EXPERIENCE_V1: snapshot membership; no CRM record copy or move.
import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { readFieldAppConfig, readFieldState, matchesFieldLens } from "@/lib/field-app-contract";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { entityTypes, entityRecords, platformAuditEvents, platformMeta } from "../../../../../../drizzle/platformVNextSchema";

const MAX_SOURCE = 20_000;
const MAX_SNAPSHOT = 1_000;
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const err = (message: string, status = 422) =>
  NextResponse.json({ success: false, error: message }, { status });
const isVerified = (data: Record<string, unknown>, keys: string[]) => {
  const sections = object(object(data.__field).sections);
  return keys.some(key => Boolean(object(sections[key]).completedAt));
};

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS")) return err("Administrator access required.", 403);
  await ensureTenantPlatformVNext(db);
  const body = object(await request.json().catch(() => null));
  const sourceListId = Number(body.sourceListId);
  const mode = String(body.mode ?? "preview");
  const title = String(body.title ?? "").trim();
  const filters = object(body.filters);
  if (!Number.isSafeInteger(sourceListId) || sourceListId < 1 || !["preview", "create"].includes(mode))
    return err("Invalid source or operation.");
  if (!title || title.length > 160 || /[\u0000-\u001f]/.test(title)) return err("Enter a module name (1–160 characters).");

  // Only a real source CRM dataset may be cloned; don't build nested snapshots.
  await db.execute(sql`SELECT pg_advisory_xact_lock(20261102, ${sourceListId})`);
  const [source] = await db.select().from(entityTypes)
    .where(and(eq(entityTypes.id, sourceListId), eq(entityTypes.isActive, true))).limit(1).for("update");
  if (!source || object(source.config).fieldSource) return err("Select an original CRM dataset.", 409);
  const config = readFieldAppConfig(source.config, source.title);
  if (!config) return err("Publish the source App Experience first.", 409);

  const enabledFilters = Boolean(filters.verified || filters.worked || filters.recent ||
    filters.stage || filters.lens || filters.assignee || filters.q);
  if (!enabledFilters) return err("Apply at least one filter before creating a module.");
  for (const name of ["verified", "worked", "recent"]) {
    if (filters[name] !== undefined && typeof filters[name] !== "boolean") return err(`Invalid ${name} filter.`);
  }
  const stage = String(filters.stage ?? "").trim();
  const lens = String(filters.lens ?? "").trim();
  const assigned = String(filters.assignee ?? "").trim();
  const q = String(filters.q ?? "").trim().toLowerCase().slice(0, 80);
  if (stage && !config.stages.some(s => s.key === stage)) return err("Unknown stage; refresh filters.", 409);
  const matchedLens = lens ? config.experience.list.lenses.find(l => l.key === lens) : null;
  if (lens && !matchedLens) return err("Unknown filter; refresh filters.", 409);
  if (assigned && assigned !== "none" && !/^[1-9]\d*$/.test(assigned)) return err("Invalid assignee filter.");
  const verificationKeys = config.sections.filter(s =>
    /^(verify|verification)(_|$)/i.test(s.key) || /^verify\b/i.test(s.title)).map(s => s.key);
  if (filters.verified && !verificationKeys.length) return err("No Verify site step is configured.");

  const allTypes = await db.select({id:entityTypes.id,config:entityTypes.config,isActive:entityTypes.isActive})
    .from(entityTypes).where(eq(entityTypes.isActive,true));
  const claimed = new Set<string>();
  for (const type of allTypes) {
    const fs = object(object(type.config).fieldSource);
    // Both published and pending draft modules reserve their exact source records.
    if (Number(fs.sourceListId) !== sourceListId) continue;
    for (const id of Array.isArray(fs.recordIds) ? fs.recordIds : []) claimed.add(String(id).toLowerCase());
  }
  const records = await db.select().from(entityRecords)
    .where(and(eq(entityRecords.entityTypeId, sourceListId), eq(entityRecords.status,"active")))
    .limit(MAX_SOURCE + 1);
  if (records.length > MAX_SOURCE) return err("Dataset exceeds the 20,000-record snapshot limit.", 413);
  const since = Date.now() - 7 * 86400000;
  const selected = records.filter(r => {
    if (claimed.has(r.id.toLowerCase())) return false;
    const data = object(r.data), state = readFieldState(data);
    const worked = Boolean(state.lastVisitAt || state.assignee ||
      Object.values(state.sections).some(s => Boolean(s?.completedAt)));
    if (filters.verified && !isVerified(data, verificationKeys)) return false;
    if (filters.worked && !worked) return false;
    if (filters.recent && (!worked || !r.updatedAt || new Date(r.updatedAt).getTime() < since)) return false;
    if (stage && state.stage !== stage) return false;
    if (matchedLens && !matchesFieldLens(config, matchedLens, state, data, null)) return false;
    if (assigned === "none" && state.assignee) return false;
    if (assigned && assigned !== "none" && String(state.assignee?.userId ?? "") !== assigned) return false;
    if (q) {
      const titleValue = String(data[config.titleField ?? ""] ?? r.externalKey ?? "");
      const parts = [r.externalKey ?? "", titleValue, ...config.subtitleFields.map(k => String(data[k] ?? "")), state.assignee?.name ?? ""];
      if (!parts.join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  if (!selected.length) return err("No available records match these filters.", 409);
  if (selected.length > MAX_SNAPSHOT) return err("Create modules in batches of up to 1,000 records.", 413);
  const ids = selected.map(r => r.id.toLowerCase()).sort();
  // Existing active PJPs must not start pointing at inaccessible source-module sites.
  const plans = await db.select({key:platformMeta.key,value:platformMeta.value}).from(platformMeta)
    .where(like(platformMeta.key,"pjp:v1:%"));
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const selectedIds = new Set(ids);
  const blocked = new Set<string>();
  for (const entry of plans) {
    // Historical plans stay in the audit trail but do not block future module creation.
    const planDate = entry.key.slice(-10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate) || planDate < today) continue;
    const value=object(entry.value);
    if (value.cancelled === true || !Array.isArray(value.stops)) continue;
    for (const stop of value.stops) {
      const key=String(object(stop).id ?? "").toLowerCase();
      if (key.startsWith("site:") && selectedIds.has(key.slice(5))) blocked.add(key.slice(5));
    }
  }
  const digest = createHash("sha256").update(JSON.stringify({sourceListId, filters, ids})).digest("hex");
  const preview = { success:true, count:ids.length, digest, activePjpConflicts:blocked.size,
    examples:selected.slice(0,5).map(r => r.externalKey ?? r.id),
    note:"Records and histories stay in the original CRM dataset. The new module has no employee access until explicitly granted." };
  if (mode === "preview") return NextResponse.json(preview);
  if (blocked.size) return err(`${blocked.size} selected sites are in existing PJP plans. Reassign or cancel those plans before creating the linked module.`,409);
  if (body.confirmation !== "CREATE MODULE" || body.expectedDigest !== digest)
    return err("Preview the same selection again before creating. No data changed.", 409);

  const now = new Date();
  const key = `linked_${source.key.slice(0, 110)}_${randomBytes(5).toString("hex")}`;
  const draftConfig = {
    ...config,
    title,
    version:0,
    publishedAt:null,
    publishedBy:null,
    experience:{...config.experience,list:{...config.experience.list,
      preferNotVisitedDefault:false,
      defaultLens:config.experience.list.lenses[0]?.key ?? "all",
    }},
    // Automation is copied for review, but must be explicitly published.
    pixelLogic:config.pixelLogic ? {...config.pixelLogic,enabled:false}:null,
  };
  const [created] = await db.insert(entityTypes).values({
    key, title,
    description:`Linked experience sourced from ${source.title}; records stay in the source CRM.`,
    fieldDefinitions:source.fieldDefinitions,
    searchableFields:source.searchableFields,
    displayTemplate:source.displayTemplate,
    config:{
      fieldSource:{sourceListId,recordIds:ids,filter:filters,sourceVersion:config.version,createdAt:now.toISOString()},
      fieldAppDraft:{config:draftConfig,revision:1,updatedAt:now.toISOString(),updatedBy:session.username ?? session.email ?? null,basedOnVersion:0},
      fieldAppHistory:[],
    },
  }).returning({id:entityTypes.id,key:entityTypes.key});
  await db.insert(platformAuditEvents).values({actorUserId:session.userId,
    eventType:"field_app.linked_module_created",subjectType:"entity_type",subjectId:String(created.id),
    payload:{sourceListId,count:ids.length,digest,title,key,sourceVersion:config.version}});
  return NextResponse.json({success:true, moduleId:created.id,moduleKey:created.key,count:ids.length}, {status:201});
});
