import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { withTenantDb } from "@/lib/auth";
import { canOperation } from "@/lib/operations-permissions";
import { readFieldConfig, fieldStateOf, stageView } from "@/lib/field-records";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import { entityRecords, entityTypes } from "../../../../../../drizzle/platformVNextSchema";


export const maxDuration = 300;
const MAX_RECORDS = 20000;
const MAX_MEDIA = 1500;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 180 * 1024 * 1024;

type Media = { id: string; field: string; index: number; url: string; filename: string; result: string };
const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
const safeText = (value: unknown) => {
  const v = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[\s\u0000-\u001f]*[=+@\-]/.test(v) ? `'${v}` : v.slice(0, 32000);
};
function privateIP(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
  }
  const x = ip.split(".").map(Number);
  return x.length !== 4 || x[0] === 0 || x[0] === 10 || x[0] === 127 || x[0] >= 224 ||
    (x[0] === 169 && x[1] === 254) || (x[0] === 172 && x[1] >= 16 && x[1] <= 31) ||
    (x[0] === 192 && x[1] === 168) || (x[0] === 100 && x[1] >= 64 && x[1] <= 127) ||
    (x[0] === 192 && x[1] === 0) || (x[0] === 198 && x[1] >= 18 && x[1] <= 19);
}
async function fetchMedia(url: string): Promise<{ bytes: Buffer; ext: "png" | "jpg" | "gif" | "webp" }> {
  const allowed = (process.env.MEDIA_EXPORT_ALLOWED_HOSTS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !allowed.includes(parsed.hostname.toLowerCase())) {
    throw new Error("Host not in MEDIA_EXPORT_ALLOWED_HOSTS HTTPS allowlist");
  }
  // DNS safety check is defense-in-depth; configure allowlist to trusted, non-user-controlled storage domains only.
  const addresses = await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some(a => privateIP(a.address))) throw new Error("Unsafe media destination");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_IMAGE_BYTES) throw new Error("Image exceeds 10 MB");
  const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : null;
  if (!ext) throw new Error("Unsupported media type");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty image response");
  let total = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error("Image exceeds 10 MB"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return { bytes: Buffer.concat(chunks), ext };
}

export const GET = withTenantDb(async (request: NextRequest, db, session) => {
  if (!canOperation(session.permissions, "OPS_FIELD_VIEW") || !session.permissions.includes("ALL_ACCESS")) {
    return NextResponse.json({ error: "Export requires ALL_ACCESS." }, { status: 403 });
  }
  await ensureTenantPlatformVNext(db);
  const listId = Number(request.nextUrl.searchParams.get("list"));
  if (!Number.isSafeInteger(listId) || listId <= 0) return NextResponse.json({ error: "Choose a valid list." }, { status: 400 });
  const [entity] = await db.select().from(entityTypes).where(and(eq(entityTypes.id, listId), eq(entityTypes.isActive, true))).limit(1);
  const config = entity && readFieldConfig(entity.config, entity.title);
  if (!entity || !config) return NextResponse.json({ error: "Field list not found." }, { status: 404 });

  // Keyset pagination: no results disappear because the UI is page-limited.
  const records: Array<typeof entityRecords.$inferSelect> = [];
  let cursor = "";
  while (records.length <= MAX_RECORDS) {
    const batch = await db.select().from(entityRecords)
      .where(and(eq(entityRecords.entityTypeId, listId), eq(entityRecords.status, "active"), cursor ? gt(entityRecords.id, cursor) : undefined))
      .orderBy(asc(entityRecords.id)).limit(501);
    if (!batch.length) break;
    records.push(...batch); cursor = batch[batch.length - 1].id;
    if (batch.length < 501) break;
  }
  if (records.length > MAX_RECORDS) return NextResponse.json({ error: "More than 20,000 records: split the export before downloading." }, { status: 413 });

  const defined = new Map<string, string>();
  for (const f of entity.fieldDefinitions || []) defined.set(f.key, f.label);
  for (const section of config.sections) for (const f of section.fields) defined.set(f.key, f.label);
  const keys = Array.from(new Set([...defined.keys(), ...records.flatMap(r => Object.keys((r.data || {}) as Record<string, unknown>))]));
  const photos = new Set(config.sections.flatMap(section => section.fields.filter(f => f.type === "photos" || f.type === "signature").map(f => f.key)));
  const headers = ["Record ID", "Reference", "Stage", "Assigned to", "Last visit", "Follow-up", "Created at", "Updated at", ...keys.map(k => `${defined.get(k) || k} [${k}]`)];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BRIXTA CMS";
  const recordsSheet = workbook.addWorksheet("Complete records", { views: [{ state: "frozen", ySplit: 1 }] });
  recordsSheet.addRow(headers);
  const mediaSheet = workbook.addWorksheet("Media", { views: [{ state: "frozen", ySplit: 1 }] });
  mediaSheet.addRow(["Record ID", "Field", "Photo", "Original URL", "ZIP file", "Download status", "Google Sheets image formula"]);
  const linksSheet = workbook.addWorksheet("Instructions");
  linksSheet.addRow(["BRIXTA complete data export"]);
  linksSheet.addRow(["Import Complete records and Media from this XLSX into Google Sheets."]);
  linksSheet.addRow(["Photos are also preserved as files in the images/ directory in this ZIP."]);
  linksSheet.addRow(["Sheets IMAGE() only displays images reachable publicly over HTTPS; private images may not render."]);
  linksSheet.addRow(["Original URLs and individual download outcomes are listed on the Media sheet."]);
  linksSheet.addRow(["JSON original-records.json holds the unmodified database JSON values for every record."]);
  linksSheet.addRow(["For photo archival, prefer the ZIP files, not only the Google Sheets import."]);

  const items: Media[] = [];
  const jsonRecords = records.map(r => ({
    id: r.id, externalKey: r.externalKey, status: r.status, entityTypeId: r.entityTypeId,
    createdAt: r.createdAt, updatedAt: r.updatedAt, createdByUserId: r.createdByUserId,
    updatedByUserId: r.updatedByUserId, data: r.data,
  }));
  for (const record of records) {
    const data = (record.data || {}) as Record<string, unknown>;
    const state = fieldStateOf(data);
    recordsSheet.addRow([record.id, safeText(record.externalKey), stageView(config, state.stage).label,
      safeText(state.assignee?.name), state.lastVisitAt || "", state.followUpAt || "",
      record.createdAt?.toISOString() || "", record.updatedAt?.toISOString() || "",
      ...keys.map(key => safeText(data[key]))]);
    for (const key of photos) {
      strings(data[key]).forEach((url, index) => {
        if (/^https:\/\//i.test(url)) items.push({ id: record.id, field: key, index, url, filename: "", result: "pending" });
      });
    }
  }
  if (items.length > MAX_MEDIA) return NextResponse.json({ error: `Export has ${items.length} photos; maximum per archive is ${MAX_MEDIA}. Contact admin to batch.` }, { status: 413 });

  const zip = new JSZip();
  zip.file("original-records.json", JSON.stringify({ list: { id: entity.id, title: entity.title, key: entity.key }, exportedAt: new Date().toISOString(), records: jsonRecords }, null, 2));
  let used = 0; let failed = 0;
  for (const item of items) {
    try {
      const media = await fetchMedia(item.url);
      used += media.bytes.length;
      if (used > MAX_TOTAL_BYTES) throw new Error("Archive media budget exceeded");
      item.filename = `images/${item.id}/${item.field.replace(/[^a-zA-Z0-9_-]/g, "_")}_${item.index + 1}.${media.ext}`;
      zip.file(item.filename, media.bytes);
      // ExcelJS embeds only PNG/JPEG/GIF, and Google Sheets import may not preserve those embedded images.
      if (media.ext !== "webp" && mediaSheet.rowCount < 250) {
        const imageId = workbook.addImage({ base64: media.bytes.toString("base64"), extension: media.ext === "jpg" ? "jpeg" : media.ext });
        mediaSheet.addImage(imageId, { tl: { col: 7, row: mediaSheet.rowCount }, ext: { width: 110, height: 85 } });
      }
      item.result = "downloaded";
    } catch (error) {
      failed += 1;
      item.result = error instanceof Error ? error.message : "download failed";
    }
    const safeUrl = /^https:\/\//.test(item.url) ? item.url.replaceAll('"', '""') : "";
    mediaSheet.addRow([item.id, item.field, item.index + 1, safeText(item.url), item.filename, item.result,
      safeUrl ? { formula: `IMAGE("${safeUrl}")`, result: "" } : ""]);
  }
  for (const sheet of [recordsSheet, mediaSheet]) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF235C51" } };
    sheet.getRow(1).height = 24;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
    sheet.columns.forEach(column => { column.width = 23; });
  }
  mediaSheet.getColumn(4).width = 55;
  mediaSheet.getColumn(5).width = 60;
  mediaSheet.getColumn(6).width = 35;
  mediaSheet.getColumn(7).width = 45;
  mediaSheet.getColumn(8).width = 20;
  const workbookBytes = await workbook.xlsx.writeBuffer();
  zip.file("BRIXTA_complete_data.xlsx", workbookBytes);
  zip.file("media-manifest.json", JSON.stringify({ total: items.length, downloaded: items.length - failed, failed, media: items }, null, 2));
  zip.file("READ_ME.txt", `BRIXTA Data Input complete export\nRecords: ${records.length}\nPhotos found: ${items.length}\nPhotos downloaded: ${items.length - failed}\nPhotos unavailable: ${failed}\n\nOpen BRIXTA_complete_data.xlsx in Google Sheets. Imported embedded images are not guaranteed to survive Google Sheets conversion. For intact originals, use images/ inside this ZIP. See media-manifest.json for any missing image and its reason.\n`);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 3 } });
  const name = `brixta-complete-${listId}-${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(new Uint8Array(bytes), { headers: {
    "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
});
