import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { withTenantDb, type AppDatabase, type Session } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import {
  FIELD_APP_CONTRACT_VERSION,
  checkFieldApp,
  normalizeFieldApp,
  type FieldAppConfig,
} from "@/lib/field-app-contract";
import {
  HISTORY_LIMIT,
  mergeFieldDefinitions,
  readFieldAppStore,
  summaryOf,
  typeClashes,
  type FieldAppDraft,
  type FieldAppHistoryEntry,
} from "@/lib/field-app-store";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  entityTypes,
  platformAuditEvents,
} from "../../../../../../drizzle/platformVNextSchema";

/*
 * BRIXTA_FIELD_APP_PUBLISH_V1
 *
 *   GET   /api/platform/field-apps/:id     published + draft + versions + problems
 *   PUT   /api/platform/field-apps/:id     save the draft   { config, revision }
 *   POST  /api/platform/field-apps/:id     { action: "publish", revision?, config?, note? }
 *                                          { action: "discard" }
 *                                          { action: "restore", version }
 *
 * Phones only ever see what was published. Every publish is kept as a
 * version that can be restored. A revision number on the draft stops two
 * admins from silently overwriting each other.
 */

type Context = { params: Promise<{ id: string }> };
type EntityRow = typeof entityTypes.$inferSelect;

/* Operation permissions are enforced via canOperation with live tenant grants. */

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

function actorOf(session: Session) {
  return session.username || session.email || `User ${session.userId}`;
}

async function loadRow(db: AppDatabase, id: number, lock: boolean): Promise<EntityRow | null> {
  const query = db.select().from(entityTypes).where(eq(entityTypes.id, id)).limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

function view(row: EntityRow) {
  const store = readFieldAppStore(row.config, row.title);
  const working = store.draft?.config ?? store.published ?? null;
  const fieldDefinitions = (row.fieldDefinitions ?? []) as Array<{
    key: string;
    label: string;
    dataType: string;
  }>;
  return {
    success: true,
    entity: {
      id: row.id,
      key: row.key,
      title: row.title,
      fieldDefinitions: fieldDefinitions.map((field) => ({
        key: field.key,
        label: field.label,
        dataType: field.dataType,
      })),
    },
    published: store.published,
    publishedSummary: summaryOf(store.published),
    draft: store.draft,
    draftSummary: summaryOf(store.draft?.config ?? null),
    history: store.history.map((entry) => ({
      version: entry.version,
      publishedAt: entry.publishedAt,
      publishedBy: entry.publishedBy,
      note: entry.note,
      enabled: entry.config.enabled,
      summary: summaryOf(entry.config),
    })),
    problems: working && working.enabled ? checkFieldApp(working) : [],
    clashes: working ? typeClashes(fieldDefinitions, working) : [],
  };
}

function entityId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nextDraft(
  config: FieldAppConfig,
  previous: FieldAppDraft | null,
  publishedVersion: number,
  session: Session,
): FieldAppDraft {
  return {
    config: { ...config, version: 0, publishedAt: null, publishedBy: null },
    revision: (previous?.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorOf(session),
    basedOnVersion: publishedVersion,
  };
}

function withoutDraft(config: Record<string, unknown>) {
  const next = { ...config };
  delete next.fieldAppDraft;
  return next;
}

export const GET = withTenantDb<Context>(async (_request: NextRequest, db, session, context) => {
  if (!canOperation(session.permissions, "OPS_EXPERIENCE_VIEW")) return fail(403, "Permission denied.");
  await ensureTenantPlatformVNext(db);
  const id = entityId((await context.params).id);
  if (!id) return fail(400, "Invalid list id.");
  const row = await loadRow(db, id, false);
  if (!row) return fail(404, "List not found.");
  return NextResponse.json(view(row));
});

export const PUT = withTenantDb<Context>(async (request: NextRequest, db, session, context) => {
  if (!canOperation(session.permissions, "OPS_EXPERIENCE_EDIT")) return fail(403, "Permission denied.");
  await ensureTenantPlatformVNext(db);
  const id = entityId((await context.params).id);
  if (!id) return fail(400, "Invalid list id.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body.config !== "object" || body.config === null) {
    return fail(400, "Send the draft as { config }.");
  }

  const row = await loadRow(db, id, true);
  if (!row) return fail(404, "List not found.");
  const store = readFieldAppStore(row.config, row.title);

  if (store.draft && Number(body.revision) !== store.draft.revision) {
    return fail(
      409,
      `${store.draft.updatedBy ?? "Someone"} changed this draft meanwhile. Reload to see their changes.`,
      { code: "DRAFT_CHANGED" },
    );
  }

  const draft = nextDraft(
    normalizeFieldApp(body.config, row.title),
    store.draft,
    store.published?.version ?? 0,
    session,
  );

  const [updated] = await db
    .update(entityTypes)
    .set({
      config: { ...((row.config ?? {}) as Record<string, unknown>), fieldAppDraft: draft },
      updatedAt: new Date(),
    })
    .where(eq(entityTypes.id, id))
    .returning();

  return NextResponse.json(view(updated ?? row));
});

export const POST = withTenantDb<Context>(async (request: NextRequest, db, session, context) => {
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const requiredOperation = action === "publish" ? "OPS_EXPERIENCE_PUBLISH" : "OPS_EXPERIENCE_EDIT";
  if (!canOperation(session.permissions, requiredOperation)) return fail(403, "Permission denied for this App Experience action.");
  await ensureTenantPlatformVNext(db);
  const id = entityId((await context.params).id);
  if (!id) return fail(400, "Invalid list id.");

  const row = await loadRow(db, id, true);
  if (!row) return fail(404, "List not found.");
  const stored = (row.config ?? {}) as Record<string, unknown>;
  const store = readFieldAppStore(stored, row.title);
  const now = new Date();

  if (action === "discard") {
    if (!store.draft) return NextResponse.json(view(row));
    const [updated] = await db
      .update(entityTypes)
      .set({ config: withoutDraft(stored), updatedAt: now })
      .where(eq(entityTypes.id, id))
      .returning();
    return NextResponse.json(view(updated ?? row));
  }

  if (action === "restore") {
    const version = Number(body?.version);
    const entry = store.history.find((item) => item.version === version);
    if (!entry) return fail(404, "That version is no longer kept.");
    const draft = nextDraft(entry.config, store.draft, store.published?.version ?? 0, session);
    const [updated] = await db
      .update(entityTypes)
      .set({ config: { ...stored, fieldAppDraft: draft }, updatedAt: now })
      .where(eq(entityTypes.id, id))
      .returning();
    await db.insert(platformAuditEvents).values({
      actorUserId: session.userId,
      eventType: "field_app.restored_as_draft",
      subjectType: "entity_type",
      subjectId: String(id),
      payload: {
        title: `Version ${version} restored as draft`,
        version,
        liveVersion: store.published?.version ?? null,
        byName: actorOf(session),
        progressPolicy: "preserve",
      },
    });
    return NextResponse.json(view(updated ?? row));
  }

  if (action !== "publish") return fail(400, "Unknown action.");

  // BRIXTA_EXPERIENCE_GOVERNANCE_V1: no silent progress or assignment reset.
  if (body?.progressPolicy !== "preserve" || body?.assignmentPolicy !== "retain") {
    return fail(422,
      "Confirm preserving existing employee progress and assignments before publishing.",
      { code: "EXPERIENCE_PRESERVATION_REQUIRED" });
  }

  // Publish either the stored draft or a config sent with the request.
  let source: FieldAppConfig | null = null;
  if (body?.config && typeof body.config === "object") {
    if (store.draft && body.revision !== undefined && Number(body.revision) !== store.draft.revision) {
      return fail(
        409,
        `${store.draft.updatedBy ?? "Someone"} changed this draft meanwhile. Reload to see their changes.`,
        { code: "DRAFT_CHANGED" },
      );
    }
    source = normalizeFieldApp(body.config, row.title);
  } else if (store.draft) {
    if (body?.revision !== undefined && Number(body.revision) !== store.draft.revision) {
      return fail(409, "The draft changed meanwhile. Reload and publish again.", { code: "DRAFT_CHANGED" });
    }
    source = store.draft.config;
  }
  if (!source) return fail(400, "There is nothing to publish.");

  const problems = source.enabled ? checkFieldApp(source) : [];
  if (problems.length > 0) {
    return fail(422, problems[0].message, { code: "FIELD_APP_INVALID", problems });
  }

  const latest = Math.max(
    store.published?.version ?? 0,
    ...store.history.map((entry) => entry.version),
  );
  const version = latest + 1;
  const actor = actorOf(session);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;

  const published: FieldAppConfig = {
    ...source,
    version,
    publishedAt: now.toISOString(),
    publishedBy: actor,
    contractVersion: FIELD_APP_CONTRACT_VERSION,
  };

  const history: FieldAppHistoryEntry[] = [
    { version, publishedAt: published.publishedAt, publishedBy: actor, note, config: published },
    ...store.history,
  ];
  // The setup that was live before versions existed stays restorable.
  if (store.published && !store.history.some((entry) => entry.version === store.published!.version)) {
    history.splice(1, 0, {
      version: store.published.version,
      publishedAt: store.published.publishedAt,
      publishedBy: store.published.publishedBy,
      note: store.published.version === 0 ? "Setup before versions" : null,
      config: store.published,
    });
  }

  const merged = mergeFieldDefinitions(
    (row.fieldDefinitions ?? []) as Parameters<typeof mergeFieldDefinitions>[0],
    published,
  );

  const [updated] = await db
    .update(entityTypes)
    .set({
      config: {
        ...withoutDraft(stored),
        fieldApp: published,
        fieldAppHistory: history.slice(0, HISTORY_LIMIT),
      },
      fieldDefinitions: merged.definitions as EntityRow["fieldDefinitions"],
      updatedAt: now,
    })
    .where(eq(entityTypes.id, id))
    .returning();

  const summary = summaryOf(published);
  await db.insert(platformAuditEvents).values({
    actorUserId: session.userId,
    eventType: "field_app.published",
    subjectType: "entity_type",
    subjectId: String(id),
    payload: {
      title: published.enabled
        ? `Field app v${version} published`
        : `Field app v${version} published (hidden from phones)`,
      version,
      previousVersion: store.published?.version ?? null,
      progressPolicy: "preserve",
      assignmentPolicy: "retain",
      note,
      enabled: published.enabled,
      steps: summary?.steps ?? 0,
      questions: summary?.questions ?? 0,
      addedColumns: merged.added,
      byName: actor,
    },
  });

  return NextResponse.json({ ...view(updated ?? row), publishedVersion: version });
});
