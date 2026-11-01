import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { platformMeta, platformAuditEvents } from "../../../../../drizzle/platformVNextSchema";

// BRIXTA_COMPANY_CODE_SAFE_V2: editable login alias; immutable tenant schema.
const KEY = "company.profile.v1";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const err = (message: string, status=422) => NextResponse.json({success:false,error:message},{status});
const logoRe = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export const GET = withTenantDb(async (request:NextRequest, db, session) => {
  // Optional-column read: this endpoint works before the additive migration.
  const registry = await db.execute(sql`SELECT coalesce(to_jsonb(o)->>'login_code',o.schema_name) AS code
    FROM public.organizations o WHERE o.schema_name = ${session.schemaName} LIMIT 1`);
  if (!registry.rows.length) return err("Company registry entry not found.",404);
  const currentCode = String(registry.rows[0].code);
  const readyRows = await db.execute(sql`SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organizations' AND column_name='login_code' LIMIT 1`);
  const codeReady = readyRows.rows.length > 0;
  const checkCode = request.nextUrl.searchParams.get("checkCode");
  if (checkCode !== null) {
    if (!session.permissions.includes("ALL_ACCESS")) return err("Administrator access required.",403);
    const code = checkCode.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(code)) return err("Use 1–63 lowercase letters, numbers or underscores, starting with a letter.",400);
    const duplicate = await db.execute(sql`SELECT 1 FROM public.organizations o
      WHERE lower(coalesce(to_jsonb(o)->>'login_code',o.schema_name)) = ${code}
        AND o.schema_name <> ${session.schemaName} LIMIT 1`);
    return NextResponse.json({success:true,available:codeReady && duplicate.rows.length===0,
      codeReady,currentCode},{headers:{"Cache-Control":"private, no-store"}});
  }
  const [row] = await db.select({value:platformMeta.value}).from(platformMeta).where(eq(platformMeta.key,KEY)).limit(1);
  const saved = object(row?.value);
  return NextResponse.json({success:true,profile:{
    displayName: typeof saved.displayName === "string" && saved.displayName ? saved.displayName : session.companyName,
    companyCode: currentCode,
    logoDataUrl: typeof saved.logoDataUrl === "string" ? saved.logoDataUrl : null,
  },canEdit:session.permissions.includes("ALL_ACCESS"),codeReady},{headers:{"Cache-Control":"private, no-store"}});
});

export const POST = withTenantDb(async (request:NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS")) return err("Only a company administrator may edit branding.",403);
  const body = object(await request.json().catch(() => null));
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (displayName.length < 2 || displayName.length > 100 || /[\x00-\x1f]/.test(displayName)) {
    return err("Company name must contain 2–100 printable characters.");
  }
  const current = await db.execute(sql`SELECT coalesce(to_jsonb(o)->>'login_code',o.schema_name) AS code
    FROM public.organizations o WHERE o.schema_name = ${session.schemaName} LIMIT 1`);
  if (!current.rows.length) return err("Company registry entry not found.",404);
  const oldCode = String(current.rows[0].code);
  const companyCode = typeof body.companyCode === "string"
    ? body.companyCode.trim().toLowerCase() : oldCode;
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(companyCode)) return err("Company code must be 1–63 lowercase letters, numbers or underscores, starting with a letter.");
  const logoDataUrl = body.logoDataUrl === null ? null : body.logoDataUrl;
  if (logoDataUrl !== null) {
    if (typeof logoDataUrl !== "string" || logoDataUrl.length > 250_000) return err("Logo too large. Choose a smaller image.");
    const m = logoRe.exec(logoDataUrl);
    if (!m) return err("Logo must be PNG, JPEG, or WebP.");
    const bytes = Buffer.from(m[1], "base64");
    if (bytes.length > 180_000 || bytes.length < 20 || bytes.toString("base64") !== m[1]) return err("Invalid or oversized logo.");
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = bytes[0] === 255 && bytes[1] === 216;
    const webp = bytes.subarray(0,4).toString("ascii") === "RIFF" && bytes.subarray(8,12).toString("ascii") === "WEBP";
    if (!(png || jpg || webp)) return err("Invalid image content.");
  }
  const next = {displayName, logoDataUrl};
  const [old] = await db.select({value:platformMeta.value}).from(platformMeta).where(eq(platformMeta.key,KEY)).limit(1).for("update");
  // Existing company-name/branding saves keep working before migration.
  // Only an actual login-code change requires the new registry column.
  const changed = companyCode !== oldCode;
  if (changed) {
    const ready = await db.execute(sql`SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='organizations' AND column_name='login_code' LIMIT 1`);
    if (!ready.rows.length) return err("Company-code migration has not been installed. The old login still works.",409);
  }
  // This statement is only parsed with login_code after migration is verified.
  const updated = changed
    ? await db.execute(sql`UPDATE public.organizations AS o
        SET name = ${displayName}, login_code = ${companyCode}
        WHERE o.schema_name = ${session.schemaName}
          AND NOT EXISTS (SELECT 1 FROM public.organizations AS candidate
            WHERE lower(coalesce(to_jsonb(candidate)->>'login_code',candidate.schema_name)) = ${companyCode}
              AND candidate.id <> o.id)
        RETURNING id`)
    : await db.execute(sql`UPDATE public.organizations SET name = ${displayName}
        WHERE schema_name = ${session.schemaName} RETURNING id`);
  if (!updated.rows.length) return err("Company code already in use, or registry entry not found.",409);
  const now = new Date();
  await db.insert(platformMeta).values({key:KEY,value:next,updatedAt:now})
    .onConflictDoUpdate({target:platformMeta.key,set:{value:next,updatedAt:now}});
  await db.insert(platformAuditEvents).values({
    actorUserId:session.userId,eventType:"company.profile_updated",subjectType:"company",
    subjectId:session.schemaName,payload:{before:{...object(old?.value),companyCode:oldCode},after:{displayName,companyCode,logoChanged:object(old?.value).logoDataUrl !== logoDataUrl}}
  });
  return NextResponse.json({success:true,profile:{...next,companyCode}},{headers:{"Cache-Control":"private, no-store"}});
});
