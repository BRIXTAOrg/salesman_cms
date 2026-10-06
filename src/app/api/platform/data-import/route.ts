import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { hasPermission, withTenantDb, type AppDatabase } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  dataSources,
  entityRecords,
  entityTypes,
  platformAuditEvents,
  type EntityFieldDefinition,
} from "../../../../../drizzle/platformVNextSchema";

/*
 * BRIXTA_DATA_IMPORT_V2
 *
 * One endpoint, three modes:
 *   preview -> read the file, describe its columns. Writes nothing.
 *   check   -> apply the admin's column mapping and validate every row.
 *              Writes nothing.
 *   import  -> same as check, then writes valid rows in one transaction.
 *
 * Rules:
 *   - One bad row never blocks the good ones: it is rejected and reported.
 *   - Repeated keys inside the file: first one wins, the rest are skipped.
 *   - Rows whose key already exists in the list are updated (or skipped).
 *     Updates only overwrite values the file actually has, so information
 *     collected in the field is never wiped by a blank column.
 *   - Every import is recorded in the list's history and the audit log.
 *
 * BRIXTA_ENTITY_IMPORT_TRACEABILITY_V1 (kept from the previous importer):
 *   every created row carries immutable source provenance in
 *   data.__brixta_trace. Updated rows keep their original trace and get
 *   data.__brixta_last_import instead. Mapped field keys can never start
 *   with "__", so imports cannot overwrite either namespace.
 */

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 200;
const MAX_ISSUES_RETURNED = 300;
const MAX_TEXT_LENGTH = 5_000;
const HISTORY_LIMIT = 25;
const INSERT_CHUNK = 250;
const UPDATE_CHUNK = 200;
const LOOKUP_CHUNK = 1_000;

type CellValue = string | number | boolean | Date | null;
type DataType = "text" | "number" | "boolean" | "date";
type Mode = "preview" | "check" | "import";

type SourceColumn = {
  key: string;
  label: string;
  dataType: DataType;
  nonEmptyCount: number;
  samples: string[];
};

type ParsedUpload = {
  fileName: string;
  suggestedTitle: string;
  suggestedDisplayKey: string;
  suggestedUniqueKey: string;
  suggestedLatitudeKey: string | null;
  suggestedLongitudeKey: string | null;
  columns: SourceColumn[];
  rows: Array<Record<string, CellValue>>;
};

type PlanColumn = {
  source: string;
  field: string;
  label: string;
  dataType: DataType;
  required: boolean;
};

type PlanLocation = {
  lat: string;
  lng: string;
  field: string;
  label: string;
  required: boolean;
};

type ImportPlan = {
  target:
    | { mode: "new"; title: string }
    | { mode: "existing"; entityTypeId: number };
  uniqueColumn: string;
  displayField: string | null;
  columns: PlanColumn[];
  location: PlanLocation | null;
  onExisting: "update" | "skip";
};

type RowIssue = {
  row: number;
  column: string;
  message: string;
};

type PreparedRow = {
  rowNumber: number;
  key: string;
  data: Record<string, unknown>;
};

type ImportSummary = {
  total: number;
  valid: number;
  toCreate: number;
  toUpdate: number;
  skippedExisting: number;
  duplicatesInFile: number;
  rejected: number;
};

class ImportInputError extends Error {}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function blank(value: unknown) {
  return value === null || value === undefined || valueText(value) === "";
}

function titleFromFile(fileName: string) {
  const clean = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "Imported Data")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function asIsoDate(value: CellValue): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = valueText(value);
  if (!text) return null;

  // Day-first (Indian) dates: 05/10/2026, 5-10-2026, 05.10.2026
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date.toISOString();
    }
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) {
    return null;
  }

  const date = new Date(text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = valueText(value).replace(/[,\s₹]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: CellValue): boolean | null {
  if (typeof value === "boolean") return value;
  const text = valueText(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return null;
}

/* ------------------------------------------------------------------ */
/* File reading                                                        */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): CellValue[][] {
  const source = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function excelValue(cell: { value: unknown; text: string }): CellValue {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (
    value instanceof Date ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result = record.result;
    if (
      result instanceof Date ||
      typeof result === "string" ||
      typeof result === "number" ||
      typeof result === "boolean"
    ) {
      return result;
    }
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) =>
          part && typeof part === "object"
            ? String((part as Record<string, unknown>).text ?? "")
            : "",
        )
        .join("");
    }
  }

  return cell.text?.trim() || null;
}

function jsonRows(text: string): CellValue[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new ImportInputError("This JSON file could not be read.");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (["rows", "data", "records", "items"]
          .map((key) => (parsed as Record<string, unknown>)[key])
          .find(Array.isArray) as unknown[] | undefined)
      : undefined;

  if (!list || list.length === 0) {
    throw new ImportInputError(
      "The JSON file needs a list of records, like [{\"name\": \"…\"}].",
    );
  }

  const header: string[] = [];
  const seen = new Set<string>();
  for (const item of list.slice(0, 500)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key);
        header.push(key);
      }
    }
  }

  if (header.length === 0) {
    throw new ImportInputError("The JSON records have no fields.");
  }

  const rows: CellValue[][] = [header];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    rows.push(
      header.map((key) => {
        const value = record[key];
        if (
          value === null ||
          value === undefined ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return value ?? null;
        }
        return JSON.stringify(value);
      }),
    );
  }
  return rows;
}

async function rawRows(file: File): Promise<CellValue[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportInputError("File is too large. Maximum size is 15 MB.");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (name.endsWith(".json")) {
    return jsonRows(buffer.toString("utf8"));
  }

  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    // Runtime value is already a Node Buffer; ExcelJS and @types/node disagree
    // about Buffer's generic type, so bridge only the TS declaration.
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ImportInputError("The workbook has no worksheet.");

    const width = Math.max(sheet.columnCount, sheet.getRow(1).cellCount);
    const rows: CellValue[][] = [];
    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const current = sheet.getRow(rowNumber);
      rows.push(
        Array.from({ length: width }, (_unused, index) =>
          excelValue(current.getCell(index + 1)),
        ),
      );
    }
    return rows;
  }

  throw new ImportInputError("Upload a CSV, Excel (.xlsx) or JSON file.");
}

function inferType(label: string, values: CellValue[]): DataType {
  const usable = values.filter((value) => !blank(value));
  if (usable.length === 0) return "text";

  if (
    /\b(code|id|phone|mobile|sku|pin|zip|gst|pan|serial|reference|ref|no)\b/i.test(
      label.replace(/_/g, " "),
    ) &&
    !/\b(quantity|qty|amount|price|rate|limit|distance|duration)\b/i.test(label)
  ) {
    return "text";
  }

  if (usable.every((value) => asBoolean(value) !== null && !/^[01]$/.test(valueText(value)))) {
    return "boolean";
  }

  if (usable.every((value) => asNumber(value) !== null)) {
    return "number";
  }

  if (usable.every((value) => asIsoDate(value) !== null)) {
    return "date";
  }

  return "text";
}

function uniqueColumnKey(label: string, index: number, used: Set<string>) {
  const base = normalizeKey(label).slice(0, 140) || `column_${index + 1}`;
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

function displayScore(column: SourceColumn) {
  const label = column.label.toLowerCase();
  if (/\bname\b/.test(label)) return 100;
  if (/\btitle\b/.test(label)) return 95;
  if (/\b(address|location|site)\b/.test(label)) return 70;
  if (column.dataType === "text") return 50;
  return 10;
}

function uniqueScore(column: SourceColumn, rowCount: number) {
  const label = column.label.toLowerCase().replace(/_/g, " ");
  const filled = column.nonEmptyCount === rowCount;
  let score = 10;
  if (/\b(code|sku)\b/.test(label)) score = 100;
  else if (/(^|\s)id($|\s)/.test(label) || /_id$/.test(column.key)) score = 95;
  else if (/\b(phone|mobile|gst|pan|serial|reference|ref)\b/.test(label)) score = 80;
  else if (/\bname\b/.test(label)) score = 50;
  return filled ? score : score - 40;
}

function coordinateColumn(
  columns: SourceColumn[],
  rows: Array<Record<string, CellValue>>,
  names: string[],
  limit: number,
) {
  const match = columns.find(
    (column) =>
      names.includes(column.key) &&
      column.dataType === "number" &&
      rows.every((row) => {
        const value = row[column.key];
        if (blank(value)) return true;
        const parsed = asNumber(value);
        return parsed !== null && Math.abs(parsed) <= limit;
      }),
  );
  return match?.key ?? null;
}

async function parseUpload(file: File): Promise<ParsedUpload> {
  const rows = await rawRows(file);
  if (rows.length < 2) {
    throw new ImportInputError("The file needs a header row and at least one data row.");
  }

  const header = rows[0];
  const width = rows.reduce((max, row) => Math.max(max, row.length), header.length);
  const activeIndexes = Array.from({ length: width }, (_unused, index) => index).filter(
    (index) => !blank(header[index]) || rows.slice(1).some((row) => !blank(row[index])),
  );
  if (activeIndexes.length === 0) throw new ImportInputError("No usable columns were found.");
  if (activeIndexes.length > MAX_COLUMNS) {
    throw new ImportInputError(`A file can have up to ${MAX_COLUMNS} columns.`);
  }

  const used = new Set<string>();
  const baseColumns = activeIndexes.map((sourceIndex, index) => {
    const label = valueText(header[sourceIndex]) || `Column ${sourceIndex + 1}`;
    return { sourceIndex, key: uniqueColumnKey(label, index, used), label };
  });

  const dataRows = rows
    .slice(1)
    .filter((row) => activeIndexes.some((index) => !blank(row[index])));
  if (dataRows.length === 0) throw new ImportInputError("No data rows were found.");
  if (dataRows.length > MAX_ROWS) {
    throw new ImportInputError(
      `A single import can contain up to ${MAX_ROWS.toLocaleString()} rows.`,
    );
  }

  const mappedRows = dataRows.map((row) =>
    Object.fromEntries(
      baseColumns.map((column) => [column.key, row[column.sourceIndex] ?? null]),
    ) as Record<string, CellValue>,
  );

  const columns: SourceColumn[] = baseColumns.map((column) => {
    const values = mappedRows.map((row) => row[column.key]);
    const samples: string[] = [];
    for (const value of values) {
      if (samples.length >= 3) break;
      const text = valueText(value);
      if (text && !samples.includes(text)) samples.push(text.slice(0, 80));
    }
    return {
      key: column.key,
      label: column.label,
      dataType: inferType(column.label, values),
      nonEmptyCount: values.filter((value) => !blank(value)).length,
      samples,
    };
  });

  const displayColumn = [...columns].sort((a, b) => displayScore(b) - displayScore(a))[0];
  const uniqueColumn = [...columns].sort(
    (a, b) => uniqueScore(b, mappedRows.length) - uniqueScore(a, mappedRows.length),
  )[0];

  return {
    fileName: file.name,
    suggestedTitle: titleFromFile(file.name),
    suggestedDisplayKey: displayColumn?.key ?? columns[0].key,
    suggestedUniqueKey: uniqueColumn?.key ?? columns[0].key,
    suggestedLatitudeKey: coordinateColumn(
      columns,
      mappedRows,
      ["lat", "latitude", "gps_lat", "lat_deg", "y"],
      90,
    ),
    suggestedLongitudeKey: coordinateColumn(
      columns,
      mappedRows,
      ["lon", "lng", "long", "longitude", "gps_lng", "gps_lon", "lon_deg", "x"],
      180,
    ),
    columns,
    rows: mappedRows,
  };
}

/* ------------------------------------------------------------------ */
/* Mapping plan                                                        */
/* ------------------------------------------------------------------ */

const DATA_TYPES: DataType[] = ["text", "number", "boolean", "date"];

function parsePlan(raw: FormDataEntryValue | null, upload: ParsedUpload): ImportPlan {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new ImportInputError("Map the columns before checking the file.");
  }

  let input: any;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new ImportInputError("The column mapping could not be read.");
  }

  const sourceKeys = new Set(upload.columns.map((column) => column.key));

  let target: ImportPlan["target"];
  if (input?.target?.mode === "existing") {
    const entityTypeId = Number(input.target.entityTypeId);
    if (!Number.isInteger(entityTypeId) || entityTypeId <= 0) {
      throw new ImportInputError("Choose the list to add these records to.");
    }
    target = { mode: "existing", entityTypeId };
  } else {
    const title = String(input?.target?.title ?? "").trim();
    if (!title || !normalizeKey(title)) {
      throw new ImportInputError("Give this list a name.");
    }
    if (title.length > 220) throw new ImportInputError("List name is too long.");
    target = { mode: "new", title };
  }

  const uniqueColumn = String(input?.uniqueColumn ?? "");
  if (!sourceKeys.has(uniqueColumn)) {
    throw new ImportInputError("Choose the column that identifies each record.");
  }

  const fieldKeys = new Set<string>();
  const columns: PlanColumn[] = [];
  for (const item of Array.isArray(input?.columns) ? input.columns : []) {
    const source = String(item?.source ?? "");
    if (!sourceKeys.has(source)) continue;
    if (item?.field === null || item?.field === undefined || item?.field === "") continue;

    const field = normalizeKey(item.field).slice(0, 160);
    if (!field) continue;
    if (fieldKeys.has(field)) {
      throw new ImportInputError(`Two columns are going into the same field "${field}".`);
    }
    fieldKeys.add(field);

    const dataType = DATA_TYPES.includes(item?.dataType) ? (item.dataType as DataType) : "text";
    const sourceLabel = upload.columns.find((column) => column.key === source)?.label ?? source;
    columns.push({
      source,
      field,
      label: String(item?.label ?? sourceLabel).trim().slice(0, 160) || sourceLabel,
      dataType,
      required: item?.required === true,
    });
  }

  let location: PlanLocation | null = null;
  if (input?.location && typeof input.location === "object") {
    const lat = String(input.location.lat ?? "");
    const lng = String(input.location.lng ?? "");
    const field = normalizeKey(input.location.field ?? "location").slice(0, 160) || "location";
    if (!sourceKeys.has(lat) || !sourceKeys.has(lng)) {
      throw new ImportInputError("Choose both the latitude and the longitude column.");
    }
    if (lat === lng) {
      throw new ImportInputError("Latitude and longitude must be different columns.");
    }
    if (fieldKeys.has(field)) {
      throw new ImportInputError(`The location field "${field}" is also used by another column.`);
    }
    fieldKeys.add(field);
    location = {
      lat,
      lng,
      field,
      label: String(input.location.label ?? "Location").trim().slice(0, 160) || "Location",
      required: input.location.required === true,
    };
  }

  if (columns.length === 0 && !location) {
    throw new ImportInputError("Keep at least one column.");
  }

  const displayField = input?.displayField ? normalizeKey(input.displayField) : null;

  return {
    target,
    uniqueColumn,
    displayField: displayField && fieldKeys.has(displayField) ? displayField : null,
    columns,
    location,
    onExisting: input?.onExisting === "skip" ? "skip" : "update",
  };
}

/* ------------------------------------------------------------------ */
/* Row validation                                                      */
/* ------------------------------------------------------------------ */

function prepareRows(upload: ParsedUpload, plan: ImportPlan) {
  const labelFor = new Map(upload.columns.map((column) => [column.key, column.label]));
  const issues: RowIssue[] = [];
  const prepared: PreparedRow[] = [];
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];
  let duplicatesInFile = 0;
  let rejected = 0;

  upload.rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const rowIssues: RowIssue[] = [];
    const key = valueText(row[plan.uniqueColumn]);
    const uniqueLabel = labelFor.get(plan.uniqueColumn) ?? plan.uniqueColumn;

    if (!key) {
      rowIssues.push({ row: rowNumber, column: uniqueLabel, message: "ID is empty" });
    } else if (key.length > 255) {
      rowIssues.push({ row: rowNumber, column: uniqueLabel, message: "ID is longer than 255 characters" });
    }

    const data: Record<string, unknown> = {};

    for (const column of plan.columns) {
      const raw = row[column.source];
      const label = labelFor.get(column.source) ?? column.source;

      if (blank(raw)) {
        if (column.required) {
          rowIssues.push({ row: rowNumber, column: label, message: "Required value is empty" });
        }
        continue;
      }

      if (column.dataType === "number") {
        const value = asNumber(raw);
        if (value === null) {
          rowIssues.push({ row: rowNumber, column: label, message: "Not a number" });
        } else {
          data[column.field] = value;
        }
      } else if (column.dataType === "boolean") {
        const value = asBoolean(raw);
        if (value === null) {
          rowIssues.push({ row: rowNumber, column: label, message: "Not yes / no" });
        } else {
          data[column.field] = value;
        }
      } else if (column.dataType === "date") {
        const value = asIsoDate(raw);
        if (value === null) {
          rowIssues.push({ row: rowNumber, column: label, message: "Not a date" });
        } else {
          data[column.field] = value;
        }
      } else {
        data[column.field] = valueText(raw).slice(0, MAX_TEXT_LENGTH);
      }
    }

    if (plan.location) {
      const rawLat = row[plan.location.lat];
      const rawLng = row[plan.location.lng];
      const label = plan.location.label;

      if (blank(rawLat) && blank(rawLng)) {
        if (plan.location.required) {
          rowIssues.push({ row: rowNumber, column: label, message: "Location is empty" });
        }
      } else {
        const lat = asNumber(rawLat);
        const lng = asNumber(rawLng);
        if (lat === null || lat < -90 || lat > 90) {
          rowIssues.push({ row: rowNumber, column: label, message: "Latitude is not valid" });
        } else if (lng === null || lng < -180 || lng > 180) {
          rowIssues.push({ row: rowNumber, column: label, message: "Longitude is not valid" });
        } else {
          data[plan.location.field] = { lat, lng };
        }
      }
    }

    if (rowIssues.length > 0) {
      rejected += 1;
      issues.push(...rowIssues);
      return;
    }

    const canonical = key.toLowerCase();
    if (seen.has(canonical)) {
      duplicatesInFile += 1;
      if (duplicateKeys.length < 20) duplicateKeys.push(key);
      return;
    }
    seen.add(canonical);

    prepared.push({ rowNumber, key, data });
  });

  const summaryMap = new Map<string, { column: string; message: string; count: number }>();
  for (const issue of issues) {
    const id = `${issue.column}\u0000${issue.message}`;
    const current = summaryMap.get(id);
    if (current) current.count += 1;
    else summaryMap.set(id, { column: issue.column, message: issue.message, count: 1 });
  }

  return {
    prepared,
    issues,
    issueSummary: [...summaryMap.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    duplicatesInFile,
    duplicateKeys,
    rejected,
  };
}

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

async function existingRecordsByKey(
  db: AppDatabase,
  entityTypeId: number,
  keys: string[],
) {
  const found = new Map<string, { id: string; data: Record<string, unknown> }>();
  const lowered = [...new Set(keys.map((key) => key.toLowerCase()))];

  for (let start = 0; start < lowered.length; start += LOOKUP_CHUNK) {
    const chunk = lowered.slice(start, start + LOOKUP_CHUNK);
    const rows = await db
      .select({
        id: entityRecords.id,
        externalKey: entityRecords.externalKey,
        data: entityRecords.data,
      })
      .from(entityRecords)
      .where(
        and(
          eq(entityRecords.entityTypeId, entityTypeId),
          inArray(sql`lower(${entityRecords.externalKey})`, chunk),
        ),
      );

    for (const row of rows) {
      const key = String(row.externalKey ?? "").toLowerCase();
      if (key && !found.has(key)) {
        found.set(key, { id: row.id, data: (row.data ?? {}) as Record<string, unknown> });
      }
    }
  }

  return found;
}

function mergeFields(
  existing: EntityFieldDefinition[],
  plan: ImportPlan,
): EntityFieldDefinition[] {
  const merged = [...existing];
  const known = new Set(existing.map((field) => field.key));

  for (const column of plan.columns) {
    if (known.has(column.field)) continue;
    known.add(column.field);
    merged.push({
      key: column.field,
      label: column.label,
      dataType: column.dataType,
      required: column.required,
      config: { imported: true },
    });
  }

  if (plan.location && !known.has(plan.location.field)) {
    merged.push({
      key: plan.location.field,
      label: plan.location.label,
      dataType: "location_point",
      required: plan.location.required,
      config: { imported: true },
    });
  }

  return merged;
}

function uploadedFile(form: FormData): File | null {
  const value = form.get("file");
  return value instanceof File ? value : null;
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export const POST = withTenantDb(
  async (request: NextRequest, db, session) => {
    if (!hasPermission(session.permissions, ["WRITE", "ALL_ACCESS"])) {
      return NextResponse.json(
        { success: false, error: "Permission denied." },
        { status: 403 },
      );
    }

    await ensureTenantPlatformVNext(db);

    const form = await request.formData();
    const file = uploadedFile(form);
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Choose a CSV, Excel or JSON file." },
        { status: 400 },
      );
    }

    const modeValue = String(form.get("mode") ?? "preview").trim().toLowerCase();
    if (!["preview", "check", "import"].includes(modeValue)) {
      return NextResponse.json(
        { success: false, error: "Unknown import mode." },
        { status: 400 },
      );
    }
    const mode = modeValue as Mode;

    let upload: ParsedUpload;
    try {
      upload = await parseUpload(file);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof ImportInputError
              ? error.message
              : "Unable to read this file.",
        },
        { status: 400 },
      );
    }

    if (mode === "preview") {
      return NextResponse.json({
        success: true,
        preview: {
          fileName: upload.fileName,
          rowCount: upload.rows.length,
          suggestedTitle: upload.suggestedTitle,
          suggestedDisplayKey: upload.suggestedDisplayKey,
          suggestedUniqueKey: upload.suggestedUniqueKey,
          suggestedLatitudeKey: upload.suggestedLatitudeKey,
          suggestedLongitudeKey: upload.suggestedLongitudeKey,
          columns: upload.columns,
          previewRows: upload.rows.slice(0, 8).map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, valueText(value)]),
            ),
          ),
        },
      });
    }

    let plan: ImportPlan;
    try {
      plan = parsePlan(form.get("plan"), upload);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Invalid mapping.",
        },
        { status: 400 },
      );
    }

    // Resolve the target list.
    let entity: typeof entityTypes.$inferSelect | null = null;
    if (plan.target.mode === "existing") {
      const [row] = await db
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.id, plan.target.entityTypeId))
        .limit(1);
      if (!row || !row.isActive) {
        return NextResponse.json(
          { success: false, error: "That list no longer exists." },
          { status: 404 },
        );
      }
      entity = row;
    } else {
      const key = normalizeKey(plan.target.title).slice(0, 160);
      const [existingEntity] = await db
        .select({ id: entityTypes.id })
        .from(entityTypes)
        .where(eq(entityTypes.key, key))
        .limit(1);
      const [existingSource] = await db
        .select({ id: dataSources.id })
        .from(dataSources)
        .where(eq(dataSources.key, key))
        .limit(1);
      if (existingEntity || existingSource) {
        return NextResponse.json(
          {
            success: false,
            error: `A list named "${plan.target.title}" already exists. Choose "Add to an existing list" instead.`,
          },
          { status: 409 },
        );
      }
    }

    const checked = prepareRows(upload, plan);

    const existing = entity
      ? await existingRecordsByKey(db, entity.id, checked.prepared.map((row) => row.key))
      : new Map<string, { id: string; data: Record<string, unknown> }>();

    const toCreate = checked.prepared.filter((row) => !existing.has(row.key.toLowerCase()));
    const matched = checked.prepared.filter((row) => existing.has(row.key.toLowerCase()));
    const toUpdate = plan.onExisting === "update" ? matched : [];

    const summary: ImportSummary = {
      total: upload.rows.length,
      valid: checked.prepared.length,
      toCreate: toCreate.length,
      toUpdate: toUpdate.length,
      skippedExisting: plan.onExisting === "skip" ? matched.length : 0,
      duplicatesInFile: checked.duplicatesInFile,
      rejected: checked.rejected,
    };

    const report = {
      summary,
      issues: checked.issues.slice(0, MAX_ISSUES_RETURNED),
      issueCount: checked.issues.length,
      issueSummary: checked.issueSummary,
      duplicateKeys: checked.duplicateKeys,
    };

    if (mode === "check") {
      return NextResponse.json({ success: true, mode, ...report });
    }

    if (summary.toCreate + summary.toUpdate === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Nothing to import: every row was rejected, repeated or already in the list.",
          ...report,
        },
        { status: 400 },
      );
    }

    // ---- Write -------------------------------------------------------
    const now = new Date();
    const importRunId = randomUUID();
    const importedAt = now.toISOString();
    const fileSha256 = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");

    if (!entity) {
      const title = plan.target.mode === "new" ? plan.target.title : "Imported list";
      const key = normalizeKey(title).slice(0, 160);
      const fieldDefinitions = mergeFields([], plan);
      const displayField =
        plan.displayField ??
        fieldDefinitions.find((field) => field.dataType === "text")?.key ??
        fieldDefinitions[0]?.key ??
        null;

      const [created] = await db
        .insert(entityTypes)
        .values({
          key,
          title,
          description: `Imported from ${upload.fileName}`,
          fieldDefinitions,
          displayTemplate: displayField ? `{{${displayField}}}` : null,
          searchableFields: [
            ...new Set([
              ...(displayField ? [displayField] : []),
              ...fieldDefinitions
                .filter((field) => field.dataType === "text")
                .map((field) => field.key),
            ]),
          ].slice(0, 8),
          config: {
            createdBy: "data_import_v2",
            uniqueSourceColumn: plan.uniqueColumn,
            displayField,
            imports: [],
          },
        })
        .returning();
      if (!created) throw new Error("List creation failed.");
      entity = created;

      await db.insert(dataSources).values({
        key,
        title,
        sourceType: "entity_store",
        sourceRef: key,
        displayField,
        valueField: "id",
        searchableFields: created.searchableFields,
        allowedFields: fieldDefinitions.map((field) => field.key),
        defaultFilters: [],
        offlinePolicy: {},
        config: {
          entityTypeId: created.id,
          entityTypeKey: key,
          uniqueField: plan.uniqueColumn,
          importRunId,
          fileName: upload.fileName,
          fileSha256,
          importedAt,
          importedBy: "data_import_v2",
        },
      });
    } else {
      const fieldDefinitions = mergeFields(
        (entity.fieldDefinitions ?? []) as EntityFieldDefinition[],
        plan,
      );
      if (fieldDefinitions.length !== (entity.fieldDefinitions ?? []).length) {
        await db
          .update(entityTypes)
          .set({ fieldDefinitions, updatedAt: now })
          .where(eq(entityTypes.id, entity.id));
        entity = { ...entity, fieldDefinitions };

        const [source] = await db
          .select()
          .from(dataSources)
          .where(
            and(
              eq(dataSources.sourceType, "entity_store"),
              eq(dataSources.sourceRef, entity.key),
            ),
          )
          .limit(1);
        if (source) {
          await db
            .update(dataSources)
            .set({
              allowedFields: [
                ...new Set([
                  ...((source.allowedFields ?? []) as string[]),
                  ...fieldDefinitions.map((field) => field.key),
                ]),
              ],
              updatedAt: now,
            })
            .where(eq(dataSources.id, source.id));
        }
      }
    }

    const entityTypeId = entity.id;

    for (let start = 0; start < toCreate.length; start += INSERT_CHUNK) {
      await db.insert(entityRecords).values(
        toCreate.slice(start, start + INSERT_CHUNK).map((row) => ({
          entityTypeId,
          externalKey: row.key,
          status: "active",
          data: {
            ...row.data,
            // Reserved immutable provenance namespace.
            __brixta_trace: {
              importRunId,
              fileName: upload.fileName,
              fileSha256,
              importedAt,
              rowNumber: row.rowNumber,
              uniqueKey: row.key,
            },
          },
          createdByUserId: session.userId,
          updatedByUserId: session.userId,
        })),
      );
    }

    for (let start = 0; start < toUpdate.length; start += UPDATE_CHUNK) {
      const chunk = toUpdate.slice(start, start + UPDATE_CHUNK).map((row) => {
        const current = existing.get(row.key.toLowerCase());
        return {
          id: current!.id,
          // Only values present in the file overwrite; everything else stays,
          // including the original __brixta_trace.
          data: JSON.stringify({
            ...(current?.data ?? {}),
            ...row.data,
            __brixta_last_import: {
              importRunId,
              fileName: upload.fileName,
              fileSha256,
              importedAt,
              rowNumber: row.rowNumber,
            },
          }),
        };
      });

      await db.execute(sql`
        UPDATE entity_records AS r
           SET data = v.data::jsonb,
               updated_at = now(),
               updated_by_user_id = ${session.userId}
          FROM (VALUES ${sql.join(
            chunk.map((item) => sql`(${item.id}::uuid, ${item.data})`),
            sql`, `,
          )}) AS v(id, data)
         WHERE r.id = v.id
      `);
    }

    const historyEntry = {
      id: importRunId,
      at: importedAt,
      fileName: upload.fileName,
      fileSha256,
      byUserId: session.userId,
      byName: session.username ?? session.email ?? null,
      total: summary.total,
      created: summary.toCreate,
      updated: summary.toUpdate,
      skippedExisting: summary.skippedExisting,
      duplicatesInFile: summary.duplicatesInFile,
      rejected: summary.rejected,
    };

    const config = (entity.config ?? {}) as Record<string, unknown>;
    const previous = Array.isArray(config.imports) ? config.imports : [];
    const nextConfig = {
      ...config,
      // Latest import, same shape the previous importer used.
      import: {
        fileName: upload.fileName,
        fileSha256,
        importRunId,
        displayField: (config.displayField as string | null | undefined) ?? plan.displayField,
        uniqueField: plan.uniqueColumn,
        rowCount: summary.total,
        importedAt,
      },
      imports: [historyEntry, ...previous].slice(0, HISTORY_LIMIT),
    };

    // Merge only the import keys into the stored config, so a field-app
    // publish that happened while this file was being read is never lost
    // (BRIXTA_FIELD_APP_PUBLISH_V1).
    await db
      .update(entityTypes)
      .set({
        config: sql`coalesce(${entityTypes.config}, '{}'::jsonb) || ${JSON.stringify({
          import: nextConfig.import,
          imports: nextConfig.imports,
        })}::jsonb`,
        updatedAt: now,
      })
      .where(eq(entityTypes.id, entityTypeId));

    await db.insert(platformAuditEvents).values({
      actorUserId: session.userId,
      eventType: "entity.import",
      subjectType: "entity_type",
      subjectId: String(entityTypeId),
      payload: historyEntry,
    });

    return NextResponse.json(
      {
        success: true,
        mode,
        ...report,
        entityType: { ...entity, config: nextConfig },
        history: historyEntry,
      },
      { status: 201 },
    );
  },
);
