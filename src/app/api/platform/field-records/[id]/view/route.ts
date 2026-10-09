import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { readFieldConfig } from "@/lib/field-records";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { entityRecords, entityTypes, platformAuditEvents } from "../../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = withTenantDb<Context>(
  async (_request: NextRequest, db, session, context) => {
    if (!canOperation(session.permissions, "OPS_FIELD_VIEW")) {
      return NextResponse.json({ success: false, error: "Permission denied." }, { status: 403 });
    }
    await ensureTenantPlatformVNext(db);
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ success: false, error: "Invalid record." }, { status: 400 });
    }
    const [record] = await db.select({ id: entityRecords.id, entityTypeId: entityRecords.entityTypeId })
      .from(entityRecords).where(eq(entityRecords.id, id)).limit(1);
    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }
    const [entity] = await db.select().from(entityTypes)
      .where(eq(entityTypes.id, record.entityTypeId)).limit(1);
    if (!entity || !readFieldConfig(entity.config, entity.title)) {
      return NextResponse.json({ success: false, error: "Field list not found." }, { status: 404 });
    }
    const byName = session.username || session.email || `User ${session.userId}`;
    const [event] = await db.insert(platformAuditEvents).values({
      actorUserId: session.userId,
      eventType: "field.record_viewed",
      subjectType: "entity_record",
      subjectId: record.id,
      payload: { title: "Viewed in Data input", byName, via: "cms.data_input" },
    }).returning();
    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        at: event.createdAt.toISOString(),
        kind: event.eventType,
        title: "Viewed in Data input",
        detail: "Record opened by a dashboard user",
        by: byName,
      },
    });
  }
);
