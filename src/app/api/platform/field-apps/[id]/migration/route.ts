// BRIXTA_FIELD_PROGRESS_MIGRATION_V1 — read-only tenant impact preview.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { readFieldAppStore } from "@/lib/field-app-store";
import { entityRecords, entityTypes } from "../../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };

export const GET = withTenantDb<Context>(async (_request: NextRequest, db, session, context) => {
  if (!canOperation(session.permissions, "OPS_EXPERIENCE_VIEW")) {
    return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
  }
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ success: false, error: "Invalid CRM list." }, { status: 400 });
  }
  const [entity] = await db.select({
    id: entityTypes.id, title: entityTypes.title, config: entityTypes.config,
  }).from(entityTypes).where(eq(entityTypes.id, id)).limit(1);
  if (!entity) return NextResponse.json({ success: false, error: "CRM list not found." }, { status: 404 });

  const store = readFieldAppStore(entity.config, entity.title);
  const published = store.published;
  const next = store.draft?.config ?? store.published;
  const earlierSections = new Set(published?.sections.map((s) => s.key) ?? []);
  const nextSections = new Set(next?.sections.map((s) => s.key) ?? []);
  const earlierFields = new Set(published?.sections.flatMap((s) => s.fields.map((f) => f.key)) ?? []);
  const nextFields = new Set(next?.sections.flatMap((s) => s.fields.map((f) => f.key)) ?? []);

  const [counts] = await db.select({
    records: sql<number>`count(*)::int`,
    progressed: sql<number>`count(*) FILTER (WHERE (
      (${entityRecords.data} #> '{__field,sections}') IS NOT NULL
      AND (${entityRecords.data} #> '{__field,sections}') <> '{}'::jsonb
    ) OR COALESCE((${entityRecords.data} #>> '{__field,stage}'), 'new') <> 'new')::int`,
    assigned: sql<number>`count(*) FILTER (WHERE (${entityRecords.data} #>> '{__field,assignee,userId}') IS NOT NULL)::int`,
  }).from(entityRecords).where(and(eq(entityRecords.entityTypeId, id), ne(entityRecords.status, "deleted")));

  return NextResponse.json({
    success: true,
    entityTypeId: id,
    publishedVersion: published?.version ?? 0,
    candidateVersion: store.draft ? "draft" : (published?.version ?? 0),
    draftRevision: store.draft?.revision ?? null,
    records: Number(counts?.records ?? 0),
    recordsWithProgress: Number(counts?.progressed ?? 0),
    assignedRecords: Number(counts?.assigned ?? 0),
    removedSteps: [...earlierSections].filter((key) => !nextSections.has(key)),
    removedQuestions: [...earlierFields].filter((key) => !nextFields.has(key)),
    policy: "preserve_all",
    note: "Impact is an estimate based on stored progress. Publishing still preserves answers and assignments. No reset is performed by this endpoint.",
  });
});
