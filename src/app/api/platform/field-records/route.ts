import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { matchesFieldLens } from "@/lib/field-app-contract";
import {
  displayOf,
  fieldStateOf,
  pointOf,
  readFieldConfig,
  stageView,
} from "@/lib/field-records";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  entityRecords,
  entityTypes,
} from "../../../../../drizzle/platformVNextSchema";

/* BRIXTA_FIELD_APP_V1 — the CMS table of a field list (Sites, ...). */

const MAX_ROWS = 20_000;

export const GET = withTenantDb(async (request: NextRequest, db, session) => {
  if (!canOperation(session.permissions, "OPS_FIELD_VIEW")) {
    return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
  }

  await ensureTenantPlatformVNext(db);
  const params = request.nextUrl.searchParams;
  // BRIXTA_FIELD_OPS_V1: exporting all filtered rows is privileged.
  const exportMode = params.get("export") === "1";
  if (exportMode && !session.permissions.includes("ALL_ACCESS")) {
    return NextResponse.json({ success: false, error: "Export requires ALL_ACCESS." }, { status: 403 });
  }

  const types = await db
    .select()
    .from(entityTypes)
    .where(eq(entityTypes.isActive, true))
    .orderBy(asc(entityTypes.title));

  const lists = types
    .map((type) => ({ type, config: readFieldConfig(type.config, type.title) }))
    .filter((item) => item.config !== null);

  if (lists.length === 0) {
    return NextResponse.json({ success: true, lists: [], list: null, rows: [], total: 0 });
  }

  const requested = Number(params.get("list"));
  const current = lists.find((item) => item.type.id === requested) ?? lists[0];
  const type = current.type;
  const config = current.config!;

  const keys = [
    ...new Set(
      [
        config.titleField,
        ...config.subtitleFields,
        config.priorityField,
        config.locationField,
        ...config.tableFields.map((field) => field.key),
        config.experience.list.badgeField,
        ...config.experience.list.cardFields,
        ...config.experience.list.lenses.map((lens) => lens.field),
        "__field",
      ].filter((value): value is string => Boolean(value)),
    ),
  ];

  const records = await db
    .select({
      id: entityRecords.id,
      externalKey: entityRecords.externalKey,
      updatedAt: entityRecords.updatedAt,
      data: sql<Record<string, unknown>>`jsonb_build_object(${sql.join(
        keys.map((key) => sql`${key}::text, ${entityRecords.data} -> ${key}::text`),
        sql`, `,
      )})`,
    })
    .from(entityRecords)
    .where(and(eq(entityRecords.entityTypeId, type.id), eq(entityRecords.status, "active")))
    .limit(MAX_ROWS);

  // Never silently download incomplete exports at the server's row cap.
  if (exportMode && records.length >= MAX_ROWS) {
    return NextResponse.json({ success: false, error: "Export exceeds the 20,000-row safety limit. Narrow your filters or contact support." }, { status: 413 });
  }
  const q = (params.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const stages = new Set(
    (params.get("stage") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  const assignee = (params.get("assignee") ?? "").trim();
  const lensKey = (params.get("lens") ?? "").trim();
  const selectedLens =
    config.experience.list.lenses.find((lens) => lens.key === lensKey) ?? null;
  const sort = params.get("sort") === "updated" ? "updated" : "priority";
  const pageSize = Math.min(Math.max(Number(params.get("pageSize")) || 50, 10), 100);
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const stageCounts: Record<string, number> = {};
  const lensCounts: Record<string, number> = Object.fromEntries(
    config.experience.list.lenses.map((lens) => [lens.key, 0]),
  );
  let unassigned = 0;

  const rows = [];
  for (const record of records) {
    const data = (record.data ?? {}) as Record<string, unknown>;
    const state = fieldStateOf(data);
    const stage = stageView(config, state.stage);
    stageCounts[stage.key] = (stageCounts[stage.key] ?? 0) + 1;
    if (!state.assignee) unassigned += 1;

    for (const lens of config.experience.list.lenses) {
      if (matchesFieldLens(config, lens, state, data, null)) {
        lensCounts[lens.key] = (lensCounts[lens.key] ?? 0) + 1;
      }
    }

    if (
      selectedLens &&
      !matchesFieldLens(config, selectedLens, state, data, null)
    ) {
      continue;
    }

    if (stages.size && !stages.has(stage.key)) continue;
    if (assignee === "none" && state.assignee) continue;
    if (assignee && assignee !== "none" && String(state.assignee?.userId ?? "") !== assignee) continue;

    const title =
      (config.titleField ? displayOf(data[config.titleField]) : "") || record.externalKey || "Untitled";
    const subtitle = config.subtitleFields.map((field) => displayOf(data[field])).filter(Boolean);
    if (q) {
      const haystack = [record.externalKey ?? "", title, ...subtitle, state.assignee?.name ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    const priorityValue = config.priorityField ? Number(data[config.priorityField]) : Number.NaN;

    rows.push({
      id: record.id,
      key: record.externalKey,
      title,
      subtitle,
      priority: Number.isFinite(priorityValue) ? priorityValue : null,
      location: config.locationField ? pointOf(data[config.locationField]) : null,
      stage: stage.key,
      stageLabel: stage.label,
      stageTone: stage.tone,
      assignee: state.assignee ? { userId: state.assignee.userId, name: state.assignee.name } : null,
      values: Object.fromEntries(
        config.tableFields.map((field) => [field.key, displayOf(data[field.key])]),
      ),
      lastVisitAt: state.lastVisitAt,
      lastVisitBy: state.lastVisitBy,
      followUpAt: state.followUpAt,
      updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
    });
  }

  rows.sort((a, b) => {
    if (sort === "updated") {
      return String(b.lastVisitAt ?? b.updatedAt ?? "").localeCompare(
        String(a.lastVisitAt ?? a.updatedAt ?? ""),
      );
    }
    const pa = a.priority ?? Number.NEGATIVE_INFINITY;
    const pb = b.priority ?? Number.NEGATIVE_INFINITY;
    if (pa !== pb) return pb - pa;
    return a.title.localeCompare(b.title);
  });

  return NextResponse.json({
    success: true,
    lists: lists.map((item) => ({ id: item.type.id, key: item.type.key, title: item.config!.title })),
    list: {
      id: type.id,
      key: type.key,
      title: config.title,
      stages: config.stages,
      tableFields: config.tableFields,
      hasLocation: Boolean(config.locationField),
      hasPriority: Boolean(config.priorityField),
      summaryLenses: config.experience.management.summaryLensKeys
        .map((key) => config.experience.list.lenses.find((lens) => lens.key === key))
        .filter((lens): lens is NonNullable<typeof lens> => Boolean(lens))
        .map((lens) => ({ key: lens.key, label: lens.label })),
    },
    rows: exportMode ? rows : rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    listTotal: records.length,
    page,
    pageSize,
    stageCounts,
    lensCounts,
    unassigned,
  });
});
