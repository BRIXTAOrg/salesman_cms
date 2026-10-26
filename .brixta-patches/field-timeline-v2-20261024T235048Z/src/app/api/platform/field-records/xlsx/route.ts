// BRIXTA_DATA_INPUT_REFUEL_20261025
// Read-only XLSX export. Reuses Data input's authoritative filtered list endpoint,
// then fetches saved per-record JSON in the SAME authorized tenant schema.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { withTenantDb } from "@/lib/auth";
import { entityRecords } from "../../../../../../drizzle/platformVNextSchema";
import { GET as getFilteredFieldRecords } from "../route";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_EXPORT_RECORDS = 2500;
const MAX_EMBEDDED_IMAGES = 250;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAFE_CELL_SIZE = 30000;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i;

type FilteredRecord = {
  id: string; key: string | null; title: string; subtitle: string[];
  stageLabel: string; priority: number | null; updatedAt: string | null;
  assignee: { name: string } | null;
};

function textCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value :
    typeof value === "object" ? JSON.stringify(value) : String(value);
  // Spreadsheet formula injection must be blocked even when whitespace precedes a formula.
  const safe = /^[\s\u0000-\u001f]*[=+@\-\t\r]/u.test(raw) ? `'${raw}` : raw;
  return safe.length > SAFE_CELL_SIZE ? `${safe.slice(0, SAFE_CELL_SIZE - 40)}… (full value in Saved state sheet)` : safe;
}

function mediaCandidates(value: unknown, key: string, depth = 0): Array<{ key: string; url: string }> {
  if (depth > 5) return [];
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) && (IMAGE_RE.test(value) || value.includes("/storage/v1/object/"))
      ? [{ key, url: value }] : [];
  }
  if (Array.isArray(value)) return value.flatMap(item => mediaCandidates(item, key, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([child, item]) =>
      mediaCandidates(item, `${key}.${child}`, depth + 1));
  }
  return [];
}

// Reject SSRF: only a public object in this deployment's configured Supabase bucket.
function approvedImage(url: string): boolean {
  try {
    const base = process.env.SUPABASE_URL;
    const bucket = process.env.SUPABASE_BUCKET_NAME;
    if (!base || !bucket) return false;
    const requested = new URL(url);
    const host = new URL(base);
    return requested.origin === host.origin &&
      requested.pathname.startsWith(`/storage/v1/object/public/${encodeURIComponent(bucket)}/`) &&
      !requested.username && !requested.password;
  } catch { return false; }
}

async function imageBytes(url: string): Promise<{ bytes: Buffer; extension: "png" | "jpeg" } | null> {
  if (!approvedImage(url)) return null;
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok || !response.body) return null;
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
    if (mime !== "image/jpeg" && mime !== "image/png") { await response.body.cancel(); return null; }
    const bytes: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) { await reader.cancel(); return null; }
      bytes.push(value);
    }
    return { bytes: Buffer.concat(bytes.map(chunk => Buffer.from(chunk))), extension: mime === "image/png" ? "png" : "jpeg" };
  } catch { return null; }
}

// Read filtered IDs first, then open a separate authorized tenant DB transaction.
// Avoid nested tenant-schema transactions (which can exhaust a small DB pool).
export const GET = async (request: NextRequest) => {
  // Run exactly the same filters/sorting and cap protections as the existing CSV.
  const endpoint = new URL(request.url);
  endpoint.pathname = "/api/platform/field-records";
  endpoint.searchParams.set("export", "1");
  const filteredResponse = await getFilteredFieldRecords(new NextRequest(endpoint, { headers: request.headers }), undefined);
  if (!filteredResponse.ok) return filteredResponse;
  const filtered = await filteredResponse.json() as {
    list: { id: number; title: string } | null; rows: FilteredRecord[];
  };
  if (!filtered.list) return NextResponse.json({ success: false, error: "No CRM list available." }, { status: 404 });
  if (!filtered.rows.length) return NextResponse.json({ success: false, error: "No records match these filters." }, { status: 404 });
  if (filtered.rows.length > MAX_EXPORT_RECORDS) {
    return NextResponse.json({ success: false, error: `Select at most ${MAX_EXPORT_RECORDS} records for an image-rich XLSX. Narrow your filters. Nothing was changed.` }, { status: 413 });
  }
  return withTenantDb(async (_request: NextRequest, db, session) => {
  if (!session.permissions.includes("ALL_ACCESS")) {
    return NextResponse.json({ success: false, error: "XLSX download requires ALL_ACCESS." }, { status: 403 });
  }
  const ids = filtered.rows.map(row => row.id);
  const saved = new Map<string, { data: Record<string, unknown>; updatedAt: Date | null }>();
  for (let i = 0; i < ids.length; i += 350) {
    const rows = await db.select({ id: entityRecords.id, data: entityRecords.data, updatedAt: entityRecords.updatedAt })
      .from(entityRecords)
      .where(and(eq(entityRecords.entityTypeId, filtered.list.id), eq(entityRecords.status, "active"), inArray(entityRecords.id, ids.slice(i, i + 350))));
    for (const row of rows) saved.set(row.id, { data: (row.data ?? {}) as Record<string, unknown>, updatedAt: row.updatedAt });
  }
  if (saved.size !== ids.length) {
    return NextResponse.json({ success: false, error: "CRM records changed during export. Refresh and retry to avoid an incomplete XLSX." }, { status: 409 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BRIXTA CRM";
  workbook.created = new Date();
  const leads = workbook.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });
  const media = workbook.addWorksheet("Photo evidence", { views: [{ state: "frozen", ySplit: 1 }] });
  const state = workbook.addWorksheet("Saved state", { views: [{ state: "frozen", ySplit: 1 }] });
  const notes = workbook.addWorksheet("Export notes");
  // Include all persisted *visible* field keys, even if the latest experience hides them.
  const fieldKeys = [...new Set(filtered.rows.flatMap(row => Object.keys(saved.get(row.id)!.data).filter(key => !key.startsWith("__"))))].sort();
  const columns = ["Record ID", "Reference", "Lead name", "Stage", "Assigned to", "Priority", "Last saved", ...fieldKeys];
  leads.addRow(columns);
  leads.getRow(1).font = { bold: true };
  leads.getRow(1).height = 24;
  leads.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];
  for (const row of filtered.rows) {
    const entry = saved.get(row.id)!;
    leads.addRow([
      textCell(row.id), textCell(row.key), textCell(row.title), textCell(row.stageLabel), textCell(row.assignee?.name),
      row.priority, entry.updatedAt?.toISOString() ?? "", ...fieldKeys.map(key => textCell(entry.data[key])),
    ]);
  }
  leads.columns.forEach((col, i) => { col.width = i < 7 ? 22 : 28; });
  leads.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  state.addRow(["Record ID", "Chunk", "Exact saved JSON (all keys incl. __field, import provenance and progress)"]);
  state.getRow(1).font = { bold: true };
  state.getColumn(1).width = 39; state.getColumn(2).width = 10; state.getColumn(3).width = 110;
  for (const row of filtered.rows) {
    const json = JSON.stringify(saved.get(row.id)!.data);
    for (let pos = 0, chunk = 1; pos < json.length || (pos === 0 && !json.length); pos += SAFE_CELL_SIZE, chunk++) {
      state.addRow([row.id, chunk, json.slice(pos, pos + SAFE_CELL_SIZE)]);
    }
  }

  media.addRow(["Record ID", "Saved field", "Original photograph", "Image preview", "Embedding result"]);
  media.getRow(1).font = { bold: true };
  media.getColumn(1).width = 39; media.getColumn(2).width = 30; media.getColumn(3).width = 35;
  media.getColumn(4).width = 22; media.getColumn(5).width = 32;
  const allMedia = filtered.rows.flatMap(row => {
    const d = saved.get(row.id)!.data;
    return Object.entries(d).filter(([key]) => !key.startsWith("__"))
      .flatMap(([key, value]) => mediaCandidates(value, key)).map(photo => ({ ...photo, recordId: row.id }));
  });
  // All photo URLs are present in the workbook. Only supported, trusted PNG/JPEG
  // images can be embedded, and the number is capped to protect production RAM.
  let embedded = 0;
  let linkedOnly = 0;
  const imageResults = new Map<number, Awaited<ReturnType<typeof imageBytes>>>();
  const embedQueue = allMedia.slice(0, MAX_EMBEDDED_IMAGES);
  // Batch with bounded concurrency: avoid 250 sequential remote requests.
  for (let offset = 0; offset < embedQueue.length; offset += 10) {
    const batch = embedQueue.slice(offset, offset + 10);
    const results = await Promise.all(batch.map(photo => imageBytes(photo.url)));
    results.forEach((result, index) => imageResults.set(offset + index, result));
  }
  for (let i = 0; i < allMedia.length; i++) {
    const photo = allMedia[i];
    const line = media.addRow([photo.recordId, photo.key, { text: "Open original", hyperlink: photo.url }, "", "Link retained"]);
    line.height = 68;
    const bytes = imageResults.get(i);
    if (!bytes) {
      linkedOnly++;
      line.getCell(5).value = i >= MAX_EMBEDDED_IMAGES
        ? "Link only · embed limit reached" : "Link only · not accessible/supported";
      continue;
    }
    const id = workbook.addImage({ buffer: bytes.bytes, extension: bytes.extension });
    media.addImage(id, { tl: { col: 3.08, row: line.number - 0.95 }, ext: { width: 120, height: 78 } });
    line.getCell(5).value = "Embedded + original link";
    embedded++;
  }
  notes.addRows([
    ["BRIXTA export", "Read-only snapshot from CURRENT persisted CRM state"],
    ["CRM list", filtered.list.title], ["Exported at (UTC)", new Date().toISOString()],
    ["Records", filtered.rows.length], ["Photo references", allMedia.length],
    ["Photos embedded", embedded], ["Photos linked only", linkedOnly],
    ["Embed policy", `Only configured Supabase public bucket PNG/JPEG, max ${MAX_EMBEDDED_IMAGES} images, ${MAX_IMAGE_BYTES / 1048576} MB each`],
    ["Saved state", "Every record's complete current persisted JSON, chunked to fit Excel cells"],
    ["Restore limits", "This is NOT an older revision backup; overwritten historical values require an existing snapshot/DB backup."],
    ["Database changes", "None"],
  ]);
  notes.getColumn(1).width = 32; notes.getColumn(2).width = 110;
  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = filtered.list.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  return new NextResponse(Buffer.from(buffer) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="brixta-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
  })(request, undefined);
};
