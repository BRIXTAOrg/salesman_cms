import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { users } from "../../../../../../drizzle/schema";
import { platformAuditEvents } from "../../../../../../drizzle/platformVNextSchema";

/*
 * BRIXTA_FIELD_APP_V1 — assign field records to a field executive.
 *
 * Only data.__field.assignee is touched (jsonb_set), so nothing the field
 * team saved is overwritten, even if they save at the same moment.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 1_000;

export const POST = withTenantDb(async (request: NextRequest, db, session) => {
  if (!hasPermission(session.permissions, ["WRITE", "UPDATE", "ALL_ACCESS"])) {
    return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
  }
  await ensureTenantPlatformVNext(db);

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set<string>(body.ids.map(String))].filter((id) => UUID.test(id))
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: "Pick at least one record." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { success: false, error: `Assign up to ${MAX_IDS.toLocaleString()} records at a time.` },
      { status: 400 },
    );
  }

  const userId = body?.userId === null || body?.userId === undefined ? null : Number(body.userId);
  let assignee: { userId: number; name: string; at: string; byName: string | null } | null = null;

  if (userId !== null) {
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: "Pick a field executive." }, { status: 400 });
    }
    const [person] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        status: users.status,
        isSalesAppUser: users.isSalesAppUser,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!person || person.status !== "active" || !person.isSalesAppUser) {
      return NextResponse.json(
        { success: false, error: "That person can't use the field app." },
        { status: 400 },
      );
    }
    assignee = {
      userId: person.id,
      name: person.displayName ?? person.username ?? `Employee ${person.id}`,
      at: new Date().toISOString(),
      byName: session.username || session.email || null,
    };
  }

  const fieldExpr = assignee
    ? sql`coalesce(data -> '__field', '{}'::jsonb) || jsonb_build_object('assignee', ${JSON.stringify(assignee)}::jsonb)`
    : sql`coalesce(data -> '__field', '{}'::jsonb) - 'assignee'`;

  const updated = await db.execute<{ id: string }>(sql`
    UPDATE entity_records
       SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{__field}', ${fieldExpr}, true),
           updated_at = now(),
           updated_by_user_id = ${session.userId}
     WHERE id = ANY(${ids}::uuid[])
       AND status = 'active'
    RETURNING id
  `);

  const updatedIds = updated.rows.map((row) => String(row.id));
  if (updatedIds.length > 0) {
    await db.insert(platformAuditEvents).values(
      updatedIds.map((id) => ({
        actorUserId: session.userId,
        eventType: "field.assigned",
        subjectType: "entity_record",
        subjectId: id,
        payload: {
          title: assignee ? `Assigned to ${assignee.name}` : "Unassigned",
          assigneeUserId: assignee?.userId ?? null,
          assigneeName: assignee?.name ?? null,
          byName: session.username || session.email || null,
        },
      })),
    );
  }

  return NextResponse.json({ success: true, updated: updatedIds.length, assignee });
});
