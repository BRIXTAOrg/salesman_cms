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
  const stage = stageView(config, state.stage);
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
        ...changes.slice(0, 4).map((change) => `${String(change.label)}: ${String(change.to || "cleared")}`),
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
      fieldAppVersion: readFieldAppConfig(type.config, type.title)?.version ?? 0,
      completedStepKeys: Object.keys(state.sections).sort(),
      entityTypeKey: type.key,
      title: (config.titleField ? displayOf(data[config.titleField]) : "") || record.externalKey || "Untitled",
      subtitle: config.subtitleFields.map((field) => displayOf(data[field])).filter(Boolean),
      stage: stage.key,
      stageLabel: stage.label,
      stageTone: stage.tone,
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
    },
  });
});
