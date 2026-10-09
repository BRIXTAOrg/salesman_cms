// BRIXTA_FIELD_PROGRESS_MIGRATION_V1 — explicit one-record step restart.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { fieldStateOf } from "@/lib/field-records";
import { readFieldAppConfig } from "@/lib/field-app-contract";
import { workItems } from "../../../../../../../drizzle/applianceSchema";
import { entityRecords, entityTypes, platformAuditEvents } from "../../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const obj = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};

// Allows the client to hide destructive-operation affordances for normal roles.
export const GET = withTenantDb<Context>(async (_request: NextRequest, _db, session, context) => {
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: "Invalid CRM record." }, { status: 400 });
  return NextResponse.json({ success: true, canRestart: session.permissions.includes("ALL_ACCESS") });
});

export const POST = withTenantDb<Context>(async (request: NextRequest, db, session, context) => {
  // All-access only, even when the role has legacy WRITE or granular publish.
  if (!session.permissions.includes("ALL_ACCESS")) {
    return NextResponse.json({ success: false, error: "Only an ALL_ACCESS administrator can restart verified steps." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: "Invalid CRM record." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const expectedVersion = Number(body?.expectedVersion);
  const expectedStage = String(body?.expectedStage ?? "");
  const expectedKeys: string[] | null = Array.isArray(body?.expectedCompletedKeys) &&
    body.expectedCompletedKeys.length <= 20 && body.expectedCompletedKeys.every((key: unknown) => typeof key === "string")
    ? [...new Set<string>(body.expectedCompletedKeys as string[])].sort() : null;
  if (body?.confirmation !== "RESTART" || reason.length < 10 || reason.length > 300 ||
      !Number.isInteger(expectedVersion) || expectedVersion < 1 || !expectedStage || !expectedKeys) {
    return NextResponse.json({ success: false, error: "Confirm RESTART, current version, step state, and a 10–300 character reason." }, { status: 400 });
  }

  // Row-level lock serializes this operation with employee Field step saves.
  const [record] = await db.select().from(entityRecords).where(eq(entityRecords.id, id)).limit(1).for("update");
  if (!record || record.status !== "active") {
    return NextResponse.json({ success: false, error: "Active CRM record not found." }, { status: 404 });
  }
  const [type] = await db.select().from(entityTypes).where(eq(entityTypes.id, record.entityTypeId)).limit(1);
  const config = type ? readFieldAppConfig(type.config, type.title) : null;
  if (!type || !config || !config.enabled) {
    return NextResponse.json({ success: false, error: "There is no published Field App for this record." }, { status: 409 });
  }
  if (config.version !== expectedVersion) {
    return NextResponse.json({ success: false, code: "APP_VERSION_CHANGED", error: "The published App Experience changed. Refresh and review again." }, { status: 409 });
  }

  const data = obj(record.data);
  const field = obj(data.__field);
  const state = fieldStateOf(data);
  const completedKeys = Object.keys(state.sections).sort();
  if (state.stage !== expectedStage || JSON.stringify(completedKeys) !== JSON.stringify(expectedKeys)) {
    return NextResponse.json({ success: false, code: "PROGRESS_CHANGED", error: "Employee progress changed. Refresh before restarting." }, { status: 409 });
  }
  if (completedKeys.length === 0 && state.stage === "new") {
    return NextResponse.json({ success: false, error: "This record has no completed steps or changed stage to restart." }, { status: 409 });
  }
  // Keep Responsibility progress independent; do not invalidate a live work item.
  const [activeLinkedWork] = await db.select({ id: workItems.id }).from(workItems).where(and(
    inArray(workItems.status, ["assigned", "in_progress"]),
    sql`${workItems.payload}->>'sourceRecordId' = ${id}`,
  )).limit(1);
  if (activeLinkedWork) {
    return NextResponse.json({ success: false, code: "ACTIVE_LINKED_WORK", error: "Complete or cancel active linked Responsibilities before restarting Field steps." }, { status: 409 });
  }
  const now = new Date();
  const at = now.toISOString();
  const priorHistory = Array.isArray(field.progressResetHistory) ? field.progressResetHistory : [];
  const snapshot = {
    at, byUserId: session.userId, reason, appVersion: config.version,
    stage: state.stage, stageChangedAt: typeof field.stageChangedAt === "string" ? field.stageChangedAt : null,
    sections: state.sections, lastVisitAt: state.lastVisitAt,
    lastVisitBy: state.lastVisitBy, followUpAt: state.followUpAt,
  };
  const nextData = {
    ...data,
    __field: {
      ...field,
      stage: "new", stageChangedAt: at,
      sections: {}, lastVisitAt: null, lastVisitBy: null,
      // Keep follow-up, assignee and mutation IDs; never delete captured answers,
      // evidence, linked Responsibility records or the audit timeline.
      // BRIXTA_FIELD_SYNC_GENERATION_V1: queued pre-restart submissions must not
      // silently re-complete verification steps after the administrator restarts.
      progressEpoch: Math.max(0, Number.isSafeInteger(Number(field.progressEpoch))
        ? Number(field.progressEpoch) : (field.progressResetAt ? 1 : 0)) + 1,
      progressResetAt: at,
      progressResetHistory: [snapshot, ...priorHistory].slice(0, 3),
    },
  };
  await db.update(entityRecords).set({
    data: nextData, updatedByUserId: session.userId, updatedAt: now,
  }).where(eq(entityRecords.id, id));
  await db.insert(platformAuditEvents).values({
    actorUserId: session.userId,
    eventType: "field.progress_restarted",
    subjectType: "entity_record",
    subjectId: id,
    payload: {
      title: "Field verification steps restarted",
      byName: session.username ?? session.email ?? null,
      reason, appVersion: config.version, previousStage: state.stage,
      completedStepKeys: completedKeys,
      answersPreserved: true, assignmentsPreserved: true,
    },
  });
  return NextResponse.json({
    success: true, recordId: id, appVersion: config.version,
    archivedCompletedSteps: completedKeys.length, answersPreserved: true,
    assignmentsPreserved: true,
  });
});
