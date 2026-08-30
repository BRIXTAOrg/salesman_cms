"use client";

import {
  Boxes,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { PlatformEntityType } from "@/lib/platform-vnext-types";
import { apiJson } from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";

// BRIXTA_ENTITIES_IMPORT_V1

type EntityField = {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
};

type PreviewColumn = {
  key: string;
  label: string;
  dataType: "text" | "number" | "boolean" | "date";
  nonEmptyCount: number;
};

type ImportPreview = {
  fileName: string;
  rowCount: number;
  suggestedTitle: string;
  suggestedDisplayKey: string;
  suggestedUniqueKey: string;
  columns: PreviewColumn[];
  previewRows: Array<Record<string, unknown>>;
};

type PreviewResponse = { success: true; preview: ImportPreview };

type ImportResponse = {
  success: true;
  imported: { rowCount: number; displayKey: string; uniqueKey: string };
  entityType: PlatformEntityType;
};

const FIELD_TYPES = [
  ["text", "Text"],
  ["number", "Number"],
  ["boolean", "Yes / No"],
  ["date", "Date"],
  ["datetime", "Date & time"],
  ["location_point", "Location"],
  ["media", "Photo / file"],
] as const;

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newField(): EntityField {
  return { key: "", label: "", dataType: "text", required: false };
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

async function apiForm<T>(form: FormData): Promise<T> {
  const response = await fetch("/api/platform/data-import", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try { body = JSON.parse(text) as Record<string, unknown>; }
    catch { throw new Error("Server returned invalid JSON."); }
  }
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Request failed (${response.status}).`,
    );
  }
  return body as T;
}

function importedRowCount(entity: PlatformEntityType) {
  const imported = entity.config?.["import"];
  if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
    return null;
  }
  const value = Number((imported as Record<string, unknown>)["rowCount"]);
  return Number.isFinite(value) ? value : null;
}

export default function EntitiesClient() {
  const [items, setItems] = useState<PlatformEntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EntityField[]>([
    { key: "name", label: "Name", dataType: "text", required: true },
  ]);

  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importTitle, setImportTitle] = useState("");
  const [displayKey, setDisplayKey] = useState("");
  const [uniqueKey, setUniqueKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ entityTypes: PlatformEntityType[] }>(
        "/api/platform/entities",
      );
      setItems(body.entityTypes ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load Entities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const validFields = useMemo(
    () =>
      fields
        .map((field) => ({
          ...field,
          key: normalizeKey(field.key || field.label),
          label: field.label.trim(),
        }))
        .filter((field) => field.key && field.label),
    [fields],
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validFields.length) {
      setMessage("Add at least one field.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiJson("/api/platform/entities", {
        method: "POST",
        body: JSON.stringify({
          title,
          key: normalizeKey(title),
          description: description || null,
          fieldDefinitions: validFields,
          searchableFields: validFields
            .filter((field) => field.dataType === "text")
            .slice(0, 4)
            .map((field) => field.key),
          displayField: validFields[0]?.key ?? null,
          displayTemplate: validFields[0]?.key
            ? `{{${validFields[0].key}}}`
            : null,
        }),
      });
      setTitle("");
      setDescription("");
      setFields([
        { key: "name", label: "Name", dataType: "text", required: true },
      ]);
      setMessage("Entity created. It is now available in Connections.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Entity.");
    } finally {
      setSaving(false);
    }
  }

  async function previewFile(nextFile: File) {
    setFile(nextFile);
    setPreview(null);
    setMessage(null);
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append("mode", "preview");
      form.append("file", nextFile);
      const body = await apiForm<PreviewResponse>(form);
      setPreview(body.preview);
      setImportTitle(body.preview.suggestedTitle);
      setDisplayKey(body.preview.suggestedDisplayKey);
      setUniqueKey(body.preview.suggestedUniqueKey);
    } catch (error) {
      setFile(null);
      setMessage(error instanceof Error ? error.message : "Unable to preview file.");
    } finally {
      setPreviewing(false);
    }
  }

  async function importFile() {
    if (!file || !preview) return;
    setImporting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("mode", "import");
      form.append("file", file);
      form.append("title", importTitle);
      form.append("displayKey", displayKey);
      form.append("uniqueKey", uniqueKey);
      const body = await apiForm<ImportResponse>(form);
      setMessage(
        `${body.imported.rowCount.toLocaleString()} records imported. `
          + `Entity "${body.entityType.title}" was created automatically and is ready in Connections.`,
      );
      setFile(null);
      setPreview(null);
      setImportTitle("");
      setDisplayKey("");
      setUniqueKey("");
      setFileInputKey((value) => value + 1);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function updateField(index: number, patch: Partial<EntityField>) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Boxes className="h-5 w-5" />
              Entities
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Entities are reusable business things: Dealers, Products, Sites,
              Machines, Vehicles and Customers. Create one manually or upload
              CSV/XLSX and BRIXTA creates the Entity, fields, records and
              generic Data Source automatically.
            </p>
          </div>
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        </div>
      </Panel>

      {message && <Panel className="py-3"><div className="text-sm">{message}</div></Panel>}

      <Panel>
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="text-base font-semibold">Import CSV / Excel</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Fast path: upload records and BRIXTA creates the Entity automatically.
            </div>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed p-6 transition hover:bg-muted/20">
          <input
            key={fileInputKey}
            type="file"
            className="sr-only"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void previewFile(selected);
            }}
          />
          {previewing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <div>
            <div className="text-sm font-medium">
              {file ? file.name : "Choose CSV / Excel file"}
            </div>
            <div className="text-xs text-muted-foreground">
              Preview first. Nothing is written until you confirm.
            </div>
          </div>
        </label>

        {preview && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border bg-muted/[0.08] p-4">
              <div className="text-lg font-semibold">
                We found {preview.rowCount.toLocaleString()} records
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Entity name">
                <input className={inputClass} value={importTitle} onChange={(e) => setImportTitle(e.target.value)} />
              </Field>
              <Field label="Show records using">
                <select className={inputClass} value={displayKey} onChange={(e) => setDisplayKey(e.target.value)}>
                  {preview.columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                </select>
              </Field>
              <Field label="Unique record identifier">
                <select className={inputClass} value={uniqueKey} onChange={(e) => setUniqueKey(e.target.value)}>
                  {preview.columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/20 text-xs">
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap border-b px-3 py-2 font-medium">
                        {column.label}<span className="ml-2 font-normal text-muted-foreground">{column.dataType}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      {preview.columns.map((column) => (
                        <td key={column.key} className="max-w-[260px] truncate px-3 py-2">
                          {displayValue(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <PrimaryButton
                type="button"
                disabled={importing || !importTitle.trim() || !displayKey || !uniqueKey}
                onClick={() => void importFile()}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Create Entity + import {preview.rowCount.toLocaleString()}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <Panel>
          <form onSubmit={create} className="space-y-5">
            <div>
              <div className="text-base font-semibold">Create manually</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Define the Entity before records exist.
              </div>
            </div>

            <Field label="What is the thing called?">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Dealer, Work Site, Machine..." required />
            </Field>

            <Field label="What is it for?">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} rows={2} />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">What information does it contain?</div>
                  <div className="text-xs text-muted-foreground">Add normal fields.</div>
                </div>
                <SecondaryButton type="button" onClick={() => setFields((current) => [...current, newField()])}>
                  <Plus className="h-4 w-4" />Field
                </SecondaryButton>
              </div>

              {fields.map((field, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.2fr_1fr_auto_auto]">
                  <input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value, key: normalizeKey(e.target.value) })}
                    className={inputClass}
                    placeholder="Field name"
                  />
                  <select value={field.dataType} onChange={(e) => updateField(index, { dataType: e.target.value })} className={inputClass}>
                    {FIELD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateField(index, { required: e.target.checked })} />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                    className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Entity
            </PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <div className="text-base font-semibold">Available Entities</div>
          <div className="mt-1 text-xs text-muted-foreground">These become candidates inside Connections.</div>
          {loading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="mt-4"><EmptyState title="No Entities yet" description="Upload a file or create one manually." /></div>
          ) : (
            <div className="mt-4 space-y-2">
              {items.map((item) => {
                const rows = importedRowCount(item);
                return (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{item.title}</div>
                      <Pill tone={item.isActive ? "good" : "neutral"}>{item.isActive ? "Ready" : "Disabled"}</Pill>
                      <Pill tone="info">{item.fieldDefinitions.length} fields</Pill>
                      {rows !== null && <Pill>{rows.toLocaleString()} imported records</Pill>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.fieldDefinitions.map((field) => <Pill key={field.key}>{field.label}</Pill>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
