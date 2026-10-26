import { readFieldAppConfig } from "@/lib/field-app-contract";
// BRIXTA_SITE_ADMIN_V5
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
  // BRIXTA_FIELD_TIMELINE_FILTER_V2: filter from durable field progress, never inferred from mere imports.
  const verifiedOnly = params.get("verified") === "1";
  const workedOnly = params.get("worked") === "1";
  const recentOnly = params.get("recent") === "7";
  const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
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
  let verifiedCount = 0;
  let workedCount = 0;
  let recentlyWorkedCount = 0;
  const verificationSection = config.sections.find(section =>
    /^(verify|verification)(_|$)/i.test(section.key) || /^verify\b/i.test(section.title));

  const rows = [];
  for (const record of records) {
    const data = (record.data ?? {}) as Record<string, unknown>;
    const state = fieldStateOf(data);
    const rawMeta = data.__field && typeof data.__field === "object" && !Array.isArray(data.__field)
      ? data.__field as Record<string,unknown> : {};
    const siteName = typeof rawMeta.siteName === "string" ? rawMeta.siteName : "";
    const stage = stageView(config, state.stage);
    // Verification is a completed Verify step, NOT any arbitrary change/import.
    const verifyStep = verificationSection ? state.sections[verificationSection.key] : undefined;
    const verifiedAt = verifyStep?.completedAt ?? null;
    const verified = Boolean(verifiedAt);
    // A worked-on lead has actual field activity, assignment, or progress.
    // Imported-but-untouched records must never be reported as recent edits.
    const workedOn = Boolean(state.lastVisitAt || state.assignee ||
      Object.values(state.sections).some(step => Boolean(step?.completedAt)));
    const lastSavedAt = record.updatedAt ? new Date(record.updatedAt).toISOString() : null;
    const recentlyWorked = workedOn && Boolean(lastSavedAt &&
      Date.parse(lastSavedAt) >= recentSince);
    if (verified) verifiedCount++;
    if (workedOn) workedCount++;
    if (recentlyWorked) recentlyWorkedCount++;
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
    if (verifiedOnly && !verified) continue;
    if (workedOnly && !workedOn) continue;
    if (recentOnly && !recentlyWorked) continue;
    if (assignee === "none" && state.assignee) continue;
    if (assignee && assignee !== "none" && String(state.assignee?.userId ?? "") !== assignee) continue;

    const title = siteName ||
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
      verified,
      verifiedAt,
      verifiedBy: verifyStep?.byName ?? null,
      workedOn,
      recentlyWorked,
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
      appVersion: (readFieldAppConfig(type.config, type.title)?.version ?? 0),
      journeyRules: (readFieldAppConfig(type.config, type.title)?.journeyRules ?? null),
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
    verifiedCount,
    workedCount,
    recentlyWorkedCount,
    activityFilter: { verifiedOnly, workedOnly, recentOnly },
    unassigned,
  });
});
