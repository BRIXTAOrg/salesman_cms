import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { readFieldAppConfig, readFieldState, pointFrom, distanceMeters } from "@/lib/field-app-contract";
import { entityRecords, entityTypes, platformAuditEvents, platformMeta } from "../../../../../drizzle/platformVNextSchema";

/* BRIXTA_PJP_DISPATCH_V1 — tenant-scoped, versioned employee itinerary.
 * Does not modify entity_records, verification state, assignments or photos.
 * Platform meta stores the published schedule, audit stores whole snapshots.
 */
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sitePattern = /^site:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const taskPattern = /^task:[0-9a-z_-]{8,80}$/i;
const asObj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const validLoc = (v: unknown) => {
  if (v == null) return true;
  const p = asObj(v);
  return typeof p.lat === "number" && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
};
const error = (status: number, message: string) => NextResponse.json({ success: false, error: message }, { status });
const metaKey = (employeeId: number, date: string) => `pjp:v1:${employeeId}:${date}`;

export const GET = withTenantDb(async (request: NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS")) return error(403, "PJP management requires ALL_ACCESS.");
  const url = new URL(request.url);
  const employeeId = Number(url.searchParams.get("employeeId"));
  const date = url.searchParams.get("date") ?? "";
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !datePattern.test(date)) return error(400, "Choose an employee and date.");
  const [entry] = await db.select().from(platformMeta).where(eq(platformMeta.key, metaKey(employeeId, date))).limit(1);
  return NextResponse.json({ success: true, revision: Number(asObj(entry?.value).revision ?? 0), plan: entry?.value ?? null }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS")) return error(403, "PJP publication requires ALL_ACCESS.");
  const body = asObj(await request.json().catch(() => null));
  const employeeId = Number(body.employeeId);
  const date = String(body.date ?? "");
  const listId = Number(body.listId);
  const expectedRevision = Number(body.expectedRevision);
  const origin = body.origin;
  const rawStops = body.stops;
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !datePattern.test(date) ||
      !Number.isSafeInteger(listId) || listId < 1 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      (!origin || !validLoc(origin)) || !Array.isArray(rawStops) || !rawStops.length || rawStops.length > 30) {
    return error(422, "Choose a valid employee, date, CRM list, start point and 1–30 stops.");
  }
  const stopIds = new Set<string>();
  const stops: Array<{ id: string; type: string; title: string; note: string; externalKey: string | null; location: unknown; doneAt: string | null }> = [];
  const siteUuids: string[] = [];
  for (const rawStop of rawStops) {
    const item = asObj(rawStop);
    const id = String(item.id ?? "");
    const kind = String(item.type ?? "");
    const siteMatch = id.match(sitePattern);
    if (stopIds.has(id) || (kind === "site" ? !siteMatch : kind !== "task" || !taskPattern.test(id)) ||
        !validLoc(item.location) || String(item.title ?? "").trim().length < 1) return error(422, "Invalid, duplicate, or incomplete PJP stop.");
    stopIds.add(id);
    if (siteMatch) siteUuids.push(siteMatch[1]);
    stops.push({
      id, type: kind, title: String(item.title).trim().slice(0, 160),
      note: String(item.note ?? "").slice(0, 600), externalKey: item.externalKey == null ? null : String(item.externalKey).slice(0, 255),
      location: item.location ?? null, doneAt: null,
    });
  }
  const [person] = await db.execute(sql`SELECT id FROM users WHERE id = ${employeeId} AND status = 'active' AND is_sales_app_user = true LIMIT 1`).then(x => x.rows);
  if (!person) return error(422, "Employee is not an active Field App user.");
  const [list] = await db.select().from(entityTypes).where(and(eq(entityTypes.id, listId), eq(entityTypes.isActive, true))).limit(1);
  const appConfig = list ? readFieldAppConfig(list.config, list.title) : null;
  if (!appConfig) return error(422, "CRM list is not published to the Field App.");
  if (Number(body.appVersion) !== appConfig.version) return error(409, "App Experience/Pixel Logic was republished. Refresh the PJP planner and review its current rules.");
  const journeyRules = appConfig.journeyRules;
  if (journeyRules?.enabled && stops.filter(s => s.type === "site").length > journeyRules.maxSiteStops) {
    return error(422, `Journey Rules permit at most ${journeyRules.maxSiteStops} CRM site stops.`);
  }
  if (siteUuids.length) {
    const valid = await db.select({ id: entityRecords.id, data: entityRecords.data }).from(entityRecords).where(and(
      eq(entityRecords.entityTypeId, listId), eq(entityRecords.status, "active"), inArray(entityRecords.id, siteUuids),
    ));
    if (valid.length !== siteUuids.length) return error(409, "Some CRM sites are no longer in the published list. Refresh and regenerate.");
    if (journeyRules?.enabled) {
      if (journeyRules.allowedStages.length > 0) {
        const invalid = valid.find(row => !journeyRules.allowedStages.includes(readFieldState(row.data).stage));
        if (invalid) return error(409, "A selected CRM site no longer satisfies published journey stage rules. Refresh and regenerate.");
      }
      const homePoint = pointFrom(origin);
      const tooFar = valid.find(row => {
        const site = appConfig.locationField ? pointFrom(row.data[appConfig.locationField]) : null;
        return !homePoint || !site || distanceMeters(homePoint, site) > journeyRules.radiusKm * 1000;
      });
      if (tooFar) return error(409, "A CRM site is missing GPS or exceeds the published Journey Rules radius. Refresh the route.");
    }
  }

  const key = metaKey(employeeId, date);
  // Insert an empty key first, then lock its row so simultaneous publishes cannot race.
  await db.insert(platformMeta).values({ key, value: { revision: 0 } }).onConflictDoNothing();
  const [entry] = await db.select().from(platformMeta).where(eq(platformMeta.key, key)).limit(1).for("update");
  const previous = asObj(entry?.value);
  const currentRevision = Number(previous.revision ?? 0);
  if (expectedRevision !== currentRevision) return error(409, "The published itinerary changed. Refresh the published plan before publishing again.");
  // Preserve prior completion for unchanged task IDs when republishing a plan.
  const previousTasks = new Map(
    (Array.isArray(previous.stops) ? previous.stops : [])
      .map(asObj)
      .filter((item) => item.type === "task" && typeof item.id === "string")
      .map((item) => [String(item.id), typeof item.doneAt === "string" ? item.doneAt : null] as const),
  );
  for (const stop of stops) if (stop.type === "task") stop.doneAt = previousTasks.get(stop.id) ?? null;
  const revision = currentRevision + 1;
  const now = new Date();
  const plan = { revision, employeeId, date, listId, origin, stops,
    appExperienceVersion: appConfig.version,
    journeyPolicySnapshot: journeyRules ?? null,
    homeTitle: journeyRules?.homeTitle ?? "Today's journey",
    taskLabel: journeyRules?.taskLabel ?? "Tasks",
    homeShowRouteButton: journeyRules?.homeShowRouteButton ?? true,
    homeGreetingEnabled: journeyRules?.homeGreetingEnabled ?? true,
    homeGreetingStyle: journeyRules?.homeGreetingStyle ?? "time_of_day",
    workTasksEnabled: journeyRules?.workTasksEnabled ?? true,
    workTasksTitle: journeyRules?.workTasksTitle ?? "Your scheduled tasks",
    homeHeroStyle: journeyRules?.homeHeroStyle ?? "aurora",
    homeHeroEyebrow: journeyRules?.homeHeroEyebrow ?? "YOUR DAY, YOUR ROUTE",
    homeHeroSubline: journeyRules?.homeHeroSubline ?? "A good day starts with a clear plan.",
    homeShowNextStop: journeyRules?.homeShowNextStop ?? true,
    publishedAt: now.toISOString(), publishedBy: session.userId };
  await db.update(platformMeta).set({ value: plan, updatedAt: now }).where(eq(platformMeta.key, key));
  await db.insert(platformAuditEvents).values({
    actorUserId: session.userId, eventType: "pjp.published", subjectType: "pjp", subjectId: key,
    payload: { revision, previousRevision: currentRevision, completePlan: plan, previousPlan: currentRevision ? previous : null },
  });
  return NextResponse.json({ success: true, revision, plan }, { headers: { "Cache-Control": "no-store" } });
});
