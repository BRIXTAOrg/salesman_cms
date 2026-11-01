import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { platformAuditEvents, entityRecords } from "../../../../../../../drizzle/platformVNextSchema";
import { users } from "../../../../../../../drizzle/schema";

type Context = { params: Promise<{ id:string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Count all retained row-level change events, not merely the latest timeline page.
export const GET = withTenantDb<Context>(async (_request:NextRequest,db,session,context)=>{
  if (!canOperation(session.permissions,"OPS_FIELD_VIEW"))
    return NextResponse.json({success:false,error:"CRM read permission required."},{status:403});
  const {id}=await context.params;
  if(!uuid.test(id))return NextResponse.json({success:false,error:"Invalid site ID."},{status:400});
  const [record]=await db.select({id:entityRecords.id}).from(entityRecords).where(eq(entityRecords.id,id)).limit(1);
  if(!record)return NextResponse.json({success:false,error:"CRM site not found."},{status:404});
  const events = await db.select({actorUserId:platformAuditEvents.actorUserId,
      eventType:platformAuditEvents.eventType,total:sql<number>`count(*)::int`,
      lastAt:sql<string>`max(${platformAuditEvents.createdAt})::text`})
    .from(platformAuditEvents)
    .where(and(eq(platformAuditEvents.subjectType,"entity_record"),
      eq(platformAuditEvents.subjectId,id),
      inArray(platformAuditEvents.eventType,["field.section_saved","field.site_named","field.admin_corrected","field.progress_restarted"])))
    .groupBy(platformAuditEvents.actorUserId,platformAuditEvents.eventType);
  const ids=[...new Set(events.map(e=>e.actorUserId).filter((id):id is number=>id!==null))];
  const people=ids.length?await db.select({id:users.id,displayName:users.displayName,username:users.username})
    .from(users).where(inArray(users.id,ids)):[];
  const names=new Map(people.map(u=>[u.id,u.displayName??u.username??`Employee ${u.id}`]));
  const byActor=new Map<string,{userId:number|null;name:string;count:number;lastAt:string|null}>();
  let total=0;
  for(const row of events){
    const count=Number(row.total)||0;total+=count;
    const key=String(row.actorUserId??"unattributed");
    const item=byActor.get(key)??{userId:row.actorUserId,name:row.actorUserId===null?"Unknown actor":names.get(row.actorUserId)??`Employee ${row.actorUserId}`,
      count:0,lastAt:null};
    item.count+=count;
    if(!item.lastAt || (row.lastAt&&row.lastAt>item.lastAt))item.lastAt=row.lastAt;
    byActor.set(key,item);
  }
  return NextResponse.json({success:true,totalEdits:total,
    byActor:[...byActor.values()].sort((a,b)=>b.count-a.count)},
    {headers:{"Cache-Control":"no-store"}});
});
