import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { hasPermission, withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  dataSources,
  entityRecords,
  entityTypes,
} from "../../../../../drizzle/platformVNextSchema";

/* BRIXTA_SIMPLE_DATA_MANAGER_V1_0_1 */

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 20_000;

type CellValue = string | number | boolean | Date | null;
type DataType = "text" | "number" | "boolean" | "date";

type ImportColumn = {
  key: string;
  label: string;
  dataType: DataType;
};

type ParsedUpload = {
  fileName: string;
  suggestedTitle: string;
  suggestedDisplayKey: string;
  suggestedUniqueKey: string;
  columns: ImportColumn[];
  rows: Array<Record<string, unknown>>;
};

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

function parseCsv(text: string): CellValue[][] {
  const source = text.replace(/^\uFEFF/, "");
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
  }

  return cell.text?.trim() || null;
}

async function rawRows(file: File): Promise<CellValue[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large. Maximum size is 15 MB.");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    // Runtime value is already a Node Buffer.
    // ExcelJS/@types-node versions disagree about Buffer's generic type,
    // so keep runtime behavior unchanged and bridge only the TS declaration.
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("The workbook has no worksheet.");

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

  throw new Error("Upload a CSV or XLSX file.");
}

function inferType(label: string, values: CellValue[]): DataType {
  const usable = values.filter((value) => !blank(value));
  if (usable.length === 0) return "text";

  if (
    /\b(code|id|phone|mobile|sku|pin|zip|gst|pan|serial|reference|ref|no)\b/i.test(
      label,
    ) &&
    !/\b(quantity|qty|amount|price|rate|limit|distance|duration)\b/i.test(label)
  ) {
    return "text";
  }

  if (
    usable.every((value) =>
      ["true", "false", "yes", "no", "y", "n"].includes(
        valueText(value).toLowerCase(),
      ),
    )
  ) {
    return "boolean";
  }

  if (
    usable.every((value) => {
      if (typeof value === "number") return Number.isFinite(value);
      const candidate = valueText(value).replace(/,/g, "");
      return candidate !== "" && Number.isFinite(Number(candidate));
    })
  ) {
    return "number";
  }

  if (
    usable.every((value) =>
      value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(valueText(value)),
    )
  ) {
    return "date";
  }

  return "text";
}

function coerce(value: CellValue | undefined, dataType: DataType): unknown {
  if (blank(value)) return null;
  if (value instanceof Date) return value.toISOString();
  if (dataType === "number") {
    const parsed = Number(valueText(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : valueText(value);
  }
  if (dataType === "boolean") {
    return ["true", "yes", "y", "1"].includes(valueText(value).toLowerCase());
  }
  if (dataType === "date") {
    const date = new Date(valueText(value));
    return Number.isNaN(date.getTime()) ? valueText(value) : date.toISOString();
  }
  return valueText(value);
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

function displayScore(column: ImportColumn) {
  const label = column.label.toLowerCase();
  if (/\bname\b/.test(label)) return 100;
  if (/\btitle\b/.test(label)) return 95;
  if (column.dataType === "text") return 50;
  return 10;
}

function uniqueScore(column: ImportColumn) {
  const label = column.label.toLowerCase();
  if (/\b(code|sku)\b/.test(label)) return 100;
  if (/(^|\s)id($|\s)/.test(label) || /_id$/.test(column.key)) return 95;
  if (/\b(phone|mobile|gst|pan|serial|reference|ref)\b/.test(label)) return 80;
  if (/\bname\b/.test(label)) return 50;
  return 10;
}

async function parseUpload(file: File): Promise<ParsedUpload> {
  const rows = await rawRows(file);
  if (rows.length < 2) {
    throw new Error("The file needs a header row and at least one data row.");
  }

  const header = rows[0];
  const width = rows.reduce((max, row) => Math.max(max, row.length), header.length);
  const activeIndexes = Array.from({ length: width }, (_unused, index) => index).filter(
    (index) => !blank(header[index]) || rows.slice(1).some((row) => !blank(row[index])),
  );
  if (activeIndexes.length === 0) throw new Error("No usable columns were found.");

  const used = new Set<string>();
  const baseColumns = activeIndexes.map((sourceIndex, index) => {
    const label = valueText(header[sourceIndex]) || `Column ${sourceIndex + 1}`;
    return {
      sourceIndex,
      key: uniqueColumnKey(label, index, used),
      label,
    };
  });

  const dataRows = rows
    .slice(1)
    .filter((row) => activeIndexes.some((index) => !blank(row[index])));
  if (dataRows.length === 0) throw new Error("No data rows were found.");
  if (dataRows.length > MAX_ROWS) {
    throw new Error(`A single import can contain up to ${MAX_ROWS.toLocaleString()} rows.`);
  }

  const columns: ImportColumn[] = baseColumns.map((column) => ({
    key: column.key,
    label: column.label,
    dataType: inferType(
      column.label,
      dataRows.map((row) => row[column.sourceIndex]),
    ),
  }));

  const mappedRows = dataRows.map((row) =>
    Object.fromEntries(
      baseColumns.map((column, index) => [
        column.key,
        coerce(row[column.sourceIndex], columns[index].dataType),
      ]),
    ),
  );

  const displayColumn = [...columns].sort((a, b) => displayScore(b) - displayScore(a))[0];
  const uniqueColumn = [...columns].sort((a, b) => uniqueScore(b) - uniqueScore(a))[0];

  return {
    fileName: file.name,
    suggestedTitle: titleFromFile(file.name),
    suggestedDisplayKey: displayColumn?.key ?? columns[0].key,
    suggestedUniqueKey: uniqueColumn?.key ?? displayColumn?.key ?? columns[0].key,
    columns,
    rows: mappedRows,
  };
}

function uploadedFile(form: FormData): File | null {
  const value = form.get("file");
  return value instanceof File ? value : null;
}

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
        { success: false, error: "Choose a CSV or XLSX file." },
        { status: 400 },
      );
    }

    let parsed: ParsedUpload;
    try {
      parsed = await parseUpload(file);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unable to read this file.",
        },
        { status: 400 },
      );
    }

    const mode = String(form.get("mode") ?? "preview").trim().toLowerCase();
    if (mode === "preview") {
      return NextResponse.json({
        success: true,
        preview: {
          fileName: parsed.fileName,
          rowCount: parsed.rows.length,
          suggestedTitle: parsed.suggestedTitle,
          suggestedDisplayKey: parsed.suggestedDisplayKey,
          suggestedUniqueKey: parsed.suggestedUniqueKey,
          columns: parsed.columns,
          previewRows: parsed.rows.slice(0, 6),
        },
      });
    }

    if (mode !== "import") {
      return NextResponse.json(
        { success: false, error: "Unknown import mode." },
        { status: 400 },
      );
    }

    const title = String(form.get("title") ?? "").trim();
    const key = normalizeKey(title).slice(0, 160);
    const displayKey = normalizeKey(form.get("displayKey"));
    const uniqueKey = normalizeKey(form.get("uniqueKey"));
    const columnKeys = new Set(parsed.columns.map((column) => column.key));

    if (!title || !key) {
      return NextResponse.json(
        { success: false, error: "Give this list a name." },
        { status: 400 },
      );
    }
    if (title.length > 220) {
      return NextResponse.json(
        { success: false, error: "List name is too long." },
        { status: 400 },
      );
    }
    if (!columnKeys.has(displayKey) || !columnKeys.has(uniqueKey)) {
      return NextResponse.json(
        { success: false, error: "Choose valid display and unique columns." },
        { status: 400 },
      );
    }

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
        { success: false, error: `A list named "${title}" already exists.` },
        { status: 409 },
      );
    }

    const seen = new Set<string>();
    const externalKeys: string[] = [];
    for (let index = 0; index < parsed.rows.length; index += 1) {
      const value = valueText(parsed.rows[index][uniqueKey]);
      if (!value) {
        return NextResponse.json(
          { success: false, error: `The unique column is blank on row ${index + 2}.` },
          { status: 400 },
        );
      }
      if (value.length > 255) {
        return NextResponse.json(
          { success: false, error: `The unique value on row ${index + 2} is too long.` },
          { status: 400 },
        );
      }
      const canonical = value.toLowerCase();
      if (seen.has(canonical)) {
        return NextResponse.json(
          { success: false, error: `Duplicate unique value found: ${value}` },
          { status: 400 },
        );
      }
      seen.add(canonical);
      externalKeys.push(value);
    }

    const searchableFields = [
      ...new Set([
        displayKey,
        uniqueKey,
        ...parsed.columns
          .filter((column) => column.dataType === "text")
          .map((column) => column.key),
      ]),
    ].slice(0, 8);

    const [entityType] = await db
      .insert(entityTypes)
      .values({
        key,
        title,
        description: `Imported from ${parsed.fileName}`,
        fieldDefinitions: parsed.columns.map((column) => ({
          key: column.key,
          label: column.label,
          dataType: column.dataType,
          required: false,
          config: { imported: true },
        })),
        displayTemplate: null,
        searchableFields,
        config: {
          createdBy: "simple_data_manager_v1_0_1",
          import: {
            fileName: parsed.fileName,
            displayField: displayKey,
            uniqueField: uniqueKey,
            rowCount: parsed.rows.length,
            importedAt: new Date().toISOString(),
          },
        },
      })
      .returning();

    if (!entityType) throw new Error("Entity Type creation failed.");

    const [dataSource] = await db
      .insert(dataSources)
      .values({
        key,
        title,
        sourceType: "entity_store",
        sourceRef: key,
        displayField: displayKey,
        valueField: "id",
        searchableFields,
        allowedFields: parsed.columns.map((column) => column.key),
        defaultFilters: [],
        offlinePolicy: {},
        config: {
          entityTypeId: entityType.id,
          entityTypeKey: key,
          uniqueField: uniqueKey,
          importedBy: "simple_data_manager_v1_0_1",
        },
      })
      .returning();

    if (!dataSource) throw new Error("Data Source creation failed.");

    const records = parsed.rows.map((row, index) => ({
      entityTypeId: entityType.id,
      externalKey: externalKeys[index],
      status: "active",
      data: row,
      createdByUserId: session.userId,
      updatedByUserId: session.userId,
    }));

    const chunkSize = 250;
    for (let start = 0; start < records.length; start += chunkSize) {
      await db.insert(entityRecords).values(records.slice(start, start + chunkSize));
    }

    return NextResponse.json(
      {
        success: true,
        imported: { rowCount: records.length, displayKey, uniqueKey },
        dataSource,
      },
      { status: 201 },
    );
  },
);
