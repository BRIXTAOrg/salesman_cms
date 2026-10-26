// BRIXTA_DATA_INPUT_REFUEL_20261025: authenticated, tenant-scoped photo download.
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { entityRecords } from "../../../../../../../drizzle/platformVNextSchema";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 20 * 1024 * 1024;

function hasUrl(value: unknown, target: string, depth = 0): boolean {
  if (depth > 7) return false;
  if (typeof value === "string") return value === target;
  if (Array.isArray(value)) return value.some(child => hasUrl(child, target, depth + 1));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>)
    .some(child => hasUrl(child, target, depth + 1));
  return false;
}

export const GET = withTenantDb<Context>(async (request: NextRequest, db, session, context) => {
  if (!canOperation(session.permissions, "OPS_FIELD_VIEW")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }
  const { id } = await context.params;
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  if (!UUID.test(id) || raw.length > 2000) return NextResponse.json({ error: "Invalid record or URL." }, { status: 400 });
  const [record] = await db.select({ data: entityRecords.data }).from(entityRecords).where(eq(entityRecords.id, id)).limit(1);
  if (!record || !hasUrl(record.data, raw)) return NextResponse.json({ error: "Photograph not stored on this record." }, { status: 404 });
  // Only fetch our configured Supabase public objects: do not proxy arbitrary URLs.
  const source = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_BUCKET_NAME;
  let target: URL;
  try {
    target = new URL(raw);
    if (!source || !bucket || target.origin !== new URL(source).origin ||
      !target.pathname.startsWith(`/storage/v1/object/public/${encodeURIComponent(bucket)}/`) ||
      target.username || target.password) throw new Error("Untrusted media host");
  } catch {
    return NextResponse.json({ error: "Only photographs stored in the configured BRIXTA media bucket can be downloaded here." }, { status: 400 });
  }
  try {
    const upstream = await fetch(target.toString(), { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Saved image is unavailable." }, { status: 502 });
    const mime = (upstream.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
    if (!mime.startsWith("image/")) return NextResponse.json({ error: "Not an image." }, { status: 415 });
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); return NextResponse.json({ error: "Image exceeds 20 MB download cap." }, { status: 413 }); }
      chunks.push(value);
    }
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "img";
    return new NextResponse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))) as unknown as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="brixta-${id.slice(0, 8)}-evidence.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not retrieve saved image." }, { status: 502 });
  }
});
