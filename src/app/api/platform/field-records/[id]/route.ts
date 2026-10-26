// BRIXTA_SITE_ADMIN_V5
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { answerText, readFieldAppConfig } from "@/lib/field-app-contract";
import {
  displayOf,
  fieldStateOf,
  pointOf,
  readFieldConfig,
  stageView,
} from "@/lib/field-records";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { users } from "../../../../../../drizzle/schema";
import { workItems } from "../../../../../../drizzle/applianceSchema";
import {
  entityRecords,
  entityTypes,
  platformAuditEvents,
  recordLinks,
} from "../../../../../../drizzle/platformVNextSchema";

/* BRIXTA_FIELD_APP_V1 — one field record: answers, import data, history. */

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withTenantDb<Context>(async (_request: NextRequest, db, session, context) => {
  if (!canOperation(session.permissions, "OPS_FIELD_VIEW")) {
    return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
  }
  await ensureTenantPlatformVNext(db);

  const { id } = await context.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
  }

  const [record] = await db.select().from(entityRecords).where(eq(entityRecords.id, id)).limit(1);
  if (!record) {
    return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
  }
  const [type] = await db.select().from(entityTypes).where(eq(entityTypes.id, record.entityTypeId)).limit(1);
  const config = type ? readFieldConfig(type.config, type.title) : null;
  if (!type || !config) {
    return NextResponse.json({ success: false, error: "This list is not in the field app." }, { status: 404 });
  }

  const data = (record.data ?? {}) as Record<string, unknown>;
  const state = fieldStateOf(data);
  // BRIXTA_SITE_ADMIN_V5: alias is metadata; original externalKey never changes.
  const meta = data.__field && typeof data.__field === "object" && !Array.isArray(data.__field)
    ? data.__field as Record<string, unknown> : {};
  const siteName = typeof meta.siteName === "string" ? meta.siteName : "";
  const appInputs = new Map(config.sections.flatMap(section =>
    section.fields.map(field => [field.key, field] as const)));
  const editableFields = (type.fieldDefinitions ?? [])
    .filter(field => !field.key.startsWith("__") && field.key !== config.locationField)
    .flatMap(field => {
      const input = appInputs.get(field.key);
      if (input && ["photos", "signature", "gps", "calculated", "note", "multi_choice"].includes(input.type)) return [];
      const value = data[field.key];
      if (value !== undefined && value !== null && !["string", "number", "boolean"].includes(typeof value)) return [];
      const dataType = field.dataType === "number" ? "number" : field.dataType === "boolean" ? "boolean"
        : field.dataType === "date" ? "date" : "text";
      return [{key: field.key, label: field.label, type: dataType, value: value ?? null}];
    }).slice(0, 180);
  const canEditRecord = session.permissions.includes("ALL_ACCESS");
  // BRIXTA_DATA_INPUT_REFUEL_20261025: expose the exact CURRENT durable state.
  // No writes, schema migration, or destructive re-import occurs here.
  const savedPhotos: Array<{ key: string; url: string }> = [];
  const isPhoto = (url: string) => /^https?:\/\//i.test(url) &&
    (/\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(url) || /\/storage\/v1\/object\//i.test(url));
  function walkSavedMedia(value: unknown, key: string, depth = 0) {
    if (depth > 5 || savedPhotos.length >= 250) return;
    if (typeof value === "string") {
      if (isPhoto(value)) savedPhotos.push({ key, url: value });
    } else if (Array.isArray(value)) {
      value.forEach((child) => walkSavedMedia(child, key, depth + 1));
    } else if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([sub, child]) =>
        walkSavedMedia(child, key.startsWith("__") ? key : `${key}.${sub}`, depth + 1));
    }
  }
  Object.entries(data).filter(([key]) => !key.startsWith("__")).forEach(([key, value]) => walkSavedMedia(value, key));
  const stage = stageView(config, state.stage);
  // BRIXTA_FIELD_TIMELINE_FILTER_V2: saved-time and verification are read-only.
  const verificationSection = config.sections.find(section =>
    /^(verify|verification)(_|$)/i.test(section.key) || /^verify\b/i.test(section.title));
  const verifiedStep = verificationSection ? state.sections[verificationSection.key] : undefined;
  const verifiedAt = verifiedStep?.completedAt ?? null;
  const lastSavedAt = record.updatedAt ? new Date(record.updatedAt).toISOString() : null;
  const lastWorkedAt = state.lastVisitAt ?? state.assignee?.at ?? null;
  const inSections = new Set(config.sections.flatMap((section) => section.fields.map((field) => field.key)));

  const steps = config.sections.map((section) => {
    const done = state.sections[section.key];
    return {
      key: section.key,
      title: section.title,
      done: done?.completedAt ? { at: done.completedAt, by: done.byName ?? null } : null,
      answers: section.fields
        .map((field) => {
          const value = data[field.key];
          const media =
            field.type === "photos" && Array.isArray(value)
              ? value.map(String)
              : field.type === "signature" && typeof value === "string"
                ? [value]
                : [];
          return {
            key: field.key,
            label: field.label,
            type: field.type,
            value: answerText(field, value),
            photos: media.filter((url) => /^https?:\/\//.test(url)),
          };
        })
        .filter((answer) => answer.value !== ""),
    };
  });

  const info = (type.fieldDefinitions ?? [])
    .filter((field) => !inSections.has(field.key) && field.key !== config.locationField && !field.key.startsWith("__"))
    .map((field) => ({ label: field.label, value: displayOf(data[field.key]) }))
    .filter((item) => item.value !== "");

  const events = await db
    .select()
    .from(platformAuditEvents)
    .where(and(eq(platformAuditEvents.subjectType, "entity_record"), eq(platformAuditEvents.subjectId, record.id)))
    .orderBy(desc(platformAuditEvents.createdAt))
    .limit(200);

  const actorIds = [...new Set(events.map((event) => event.actorUserId).filter((value): value is number => value !== null))];
  const actors = actorIds.length
    ? await db
        .select({ id: users.id, username: users.username, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, actorIds))
    : [];
  const nameOf = new Map(actors.map((actor) => [actor.id, actor.displayName ?? actor.username ?? `User ${actor.id}`]));

  const timeline = events.map((event) => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const changes = Array.isArray(payload.changes) ? (payload.changes as Array<Record<string, unknown>>) : [];
    const stageChanged = payload.stageFrom !== payload.stageTo && payload.stageLabel;
    return {
      id: event.id,
      at: new Date(event.createdAt).toISOString(),
      kind: event.eventType,
      title:
        event.eventType === "field.section_saved"
          ? `${String(payload.sectionTitle ?? "Update")} saved`
          : String(payload.title ?? event.eventType),
      detail: [
        stageChanged ? `Now: ${String(payload.stageLabel)}` : "",
        event.eventType === "field.responsibility_handed_over"
          ? `From employee ${String(payload.previousAssigneeUserId ?? "?")} to ${String(payload.assigneeName ?? payload.assigneeUserId ?? "?")}. Reason: ${String(payload.reason ?? "not supplied")}`
          : "",
        ...changes.slice(0, 8).map((change) =>
          `${String(change.label ?? change.field ?? "Field")}: ${String(change.from ?? "(empty)")} → ${String(change.to ?? "(empty)")}`),
      ]
        .filter(Boolean)
        .join(" · "),
      by: (event.actorUserId !== null ? nameOf.get(event.actorUserId) : null) ?? (typeof payload.byName === "string" ? payload.byName : null),
    };
  });

  const trace = data.__brixta_trace;
  if (trace && typeof trace === "object") {
    const t = trace as Record<string, unknown>;
    if (typeof t.importedAt === "string") {
      timeline.push({
        id: `import-${record.id}`,
        at: t.importedAt,
        kind: "import",
        title: "Imported",
        detail: [t.fileName ? String(t.fileName) : "", t.rowNumber ? `row ${String(t.rowNumber)}` : ""].filter(Boolean).join(" · "),
        by: null,
      });
    }
  }

  // Preserve the exact last save timestamp even when no matching audit entry exists.
  if (lastSavedAt && !timeline.some(event =>
    Math.abs(Date.parse(event.at) - Date.parse(lastSavedAt)) < 2000)) {
    timeline.push({
      id: `last-saved-${record.id}`, at: lastSavedAt,
      kind: "record.saved", title: "Last persisted record update",
      detail: "Saved CRM record timestamp; see other events for known field-level changes.",
      by: null,
    });
  }
  timeline.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // BRIXTA_LINKED_RESPONSIBILITY_DETAIL_V1
  // Record links reference the original CRM record, not a duplicate copy.
  const linkedRows = await db
    .select()
    .from(recordLinks)
    .where(and(
      eq(recordLinks.fromRecordId, record.id),
      eq(recordLinks.relationKey, "responsibility_record"),
    ))
    .orderBy(desc(recordLinks.createdAt))
    .limit(50);

  const linkedWorkItemIds = linkedRows
    .map((link) => (link.metadata as Record<string, unknown> | null)?.workItemId)
    .filter((id): id is string => typeof id === "string" && UUID.test(id));
  const currentWorkItems = linkedWorkItemIds.length
    ? await db.select({
        id: workItems.id,
        status: workItems.status,
        assigneeUserId: workItems.assigneeUserId,
      }).from(workItems).where(inArray(workItems.id, linkedWorkItemIds))
    : [];
  const workById = new Map(currentWorkItems.map((work) => [work.id, work]));

  const linkedResponsibilities = linkedRows.map((link) => {
    const metadata = (link.metadata ?? {}) as Record<string, unknown>;
    return {
      id: link.id,
      responsibilityKey: link.targetSourceKey.startsWith("responsibility:")
        ? link.targetSourceKey.slice("responsibility:".length)
        : link.targetSourceKey,
      recordId: link.targetRecordId,
      workItemId: typeof metadata.workItemId === "string" ? metadata.workItemId : null,
      assigneeUserId: typeof metadata.workItemId === "string"
        ? workById.get(metadata.workItemId)?.assigneeUserId ?? null
        : null,
      status: typeof metadata.workItemId === "string"
        ? workById.get(metadata.workItemId)?.status ?? "unavailable"
        : "unavailable",
      createdAt: new Date(link.createdAt).toISOString(),
    };
  });

  const location = config.locationField ? pointOf(data[config.locationField]) : null;

  return NextResponse.json({
    success: true,
    record: {
      id: record.id,
      key: record.externalKey,
      listTitle: config.title,
      siteName,
      originalKey: record.externalKey,
      canEditRecord,
      editableFields,
      // Stale admin edits are rejected against this authoritative timestamp.
      editVersion: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
      fieldAppVersion: readFieldAppConfig(type.config, type.title)?.version ?? 0,
      completedStepKeys: Object.keys(state.sections).sort(),
      entityTypeKey: type.key,
      title: siteName || (config.titleField ? displayOf(data[config.titleField]) : "") || record.externalKey || "Untitled",
      subtitle: config.subtitleFields.map((field) => displayOf(data[field])).filter(Boolean),
      stage: stage.key,
      stageLabel: stage.label,
      stageTone: stage.tone,
      verification: {
        verified: Boolean(verifiedAt),
        verifiedAt,
        verifiedBy: verifiedStep?.byName ?? null,
        stepKey: verificationSection?.key ?? null,
      },
      lastSavedAt,
      lastWorkedAt,
      assignee: state.assignee,
      followUpAt: state.followUpAt,
      location,
      mapUrl: location
        ? `https://www.google.com/maps/search/?api=1&query=${location.lat.toFixed(6)},${location.lng.toFixed(6)}`
        : null,
      steps,
      info,
      timeline,
      linkedResponsibilities,
      savedState: { updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null, data },
      savedPhotos: [...new Map(savedPhotos.map(p => [`${p.key}:${p.url}`, p])).values()],
    },
  });
});


// BRIXTA_SITE_ADMIN_V5: exact, audited correction of a SINGLE CRM record.
// Photos, GPS, imported trace, verification flags and assignments are untouched.
export const PATCH = withTenantDb<Context>(async (request: NextRequest, db, session, context) => {
  if (!session.permissions.includes("ALL_ACCESS") || !canOperation(session.permissions, "OPS_FIELD_VIEW")) {
    return NextResponse.json({success:false,error:"ALL_ACCESS required for CRM corrections."},{status:403});
  }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({success:false,error:"Invalid record."},{status:400});
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 8 || reason.length > 300) return NextResponse.json({success:false,error:"Give a correction reason of 8–300 characters."},{status:422});
  if (typeof body?.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return NextResponse.json({success:false,error:"Reload this record before correcting it."},{status:428});
  }
  const edits: Record<string, unknown> = body.edits && typeof body.edits === "object" && !Array.isArray(body.edits) ? body.edits : {};
  if (Object.keys(edits).length > 180) return NextResponse.json({success:false,error:"Too many fields."},{status:422});
  const [record] = await db.select().from(entityRecords).where(eq(entityRecords.id,id)).limit(1).for("update");
  if (!record || record.status !== "active") return NextResponse.json({success:false,error:"Record unavailable."},{status:404});
  const actualVersion = new Date(record.updatedAt).toISOString();
  if (actualVersion !== body.expectedUpdatedAt) return NextResponse.json({success:false,error:"Someone changed this site while you were editing. Refuel and review before retrying.",code:"RECORD_CHANGED"},{status:409});
  const [type] = await db.select().from(entityTypes).where(eq(entityTypes.id,record.entityTypeId)).limit(1);
  const config = type ? readFieldConfig(type.config,type.title) : null;
  if (!config || !type) return NextResponse.json({success:false,error:"CRM list unavailable."},{status:404});
  const inputTypes = new Map(config.sections.flatMap(s => s.fields.map(f => [f.key, f.type] as const)));
  const definitions = new Map((type.fieldDefinitions ?? []).map(field => [field.key, field]));
  const before = (record.data ?? {}) as Record<string,unknown>;
  const next = {...before};
  const changes: Array<{key:string;label:string;from:unknown;to:unknown}> = [];
  for (const [key,value] of Object.entries(edits)) {
    const def = definitions.get(key);
    const inputType = inputTypes.get(key);
    if (!def || key.startsWith("__") || key === config.locationField ||
        (inputType && ["photos","signature","gps","calculated","note","multi_choice"].includes(inputType)) ||
        (before[key] != null && typeof before[key] === "object")) {
      return NextResponse.json({success:false,error:`${key} cannot be changed in the correction form.`},{status:422});
    }
    if (!["number","boolean","date","text"].includes(def.dataType)) {
      return NextResponse.json({success:false,error:`${key} is not a supported editable type.`},{status:422});
    }
    let normalized: unknown;
    if (value === null || value === "") normalized = null;
    else if (def.dataType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return NextResponse.json({success:false,error:`${key} must be a number.`},{status:422});
      normalized = value;
    } else if (def.dataType === "boolean") {
      if (typeof value !== "boolean") return NextResponse.json({success:false,error:`${key} must be true or false.`},{status:422});
      normalized = value;
    } else {
      if (typeof value !== "string" || value.length > 2000 || /[\u0000-\u0008]/.test(value)) return NextResponse.json({success:false,error:`${key} must be text up to 2,000 characters.`},{status:422});
      if (def.dataType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NextResponse.json({success:false,error:`${key} needs YYYY-MM-DD.`},{status:422});
      normalized = value;
    }
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(normalized)) {
      changes.push({key,label:def.label,from:before[key] ?? null,to:normalized});
      next[key] = normalized;
    }
  }
  if (body.siteName !== undefined) {
    if (typeof body.siteName !== "string" || body.siteName.trim().length > 100 || /[\u0000-\u001f]/.test(body.siteName)) {
      return NextResponse.json({success:false,error:"Site name must be text under 100 characters."},{status:422});
    }
    const previousField = before.__field && typeof before.__field === "object" && !Array.isArray(before.__field)
      ? before.__field as Record<string,unknown> : {};
    const previous = typeof previousField.siteName === "string" ? previousField.siteName : "";
    const siteName = body.siteName.trim();
    if (previous !== siteName) {
      next.__field = {...previousField,siteName};
      changes.push({key:"siteName",label:"Site display name",from:previous,to:siteName});
    }
  }
  if (!changes.length) return NextResponse.json({success:true,unchanged:true});
  const now = new Date();
  const [updated] = await db.update(entityRecords)
    .set({data:next,updatedAt:now,updatedByUserId:session.userId})
    .where(eq(entityRecords.id,id)).returning({id:entityRecords.id,updatedAt:entityRecords.updatedAt});
  // Existing withTenantDb is transactional: audit failure rolls back the edit.
  await db.insert(platformAuditEvents).values({
    actorUserId:session.userId,eventType:"field.admin_corrected",subjectType:"entity_record",subjectId:id,
    payload:{title:"Administrator corrected CRM record",reason,changes,fromVersion:actualVersion,
      toVersion:updated.updatedAt.toISOString(),beforeData:before,afterData:next,byName:session.username || session.email}
  });
  return NextResponse.json({success:true,updatedAt:updated.updatedAt.toISOString(),changeCount:changes.length});
});
