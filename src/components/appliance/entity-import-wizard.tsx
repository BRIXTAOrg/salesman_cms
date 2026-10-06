"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Loader2,
  MapPin,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  type DragEvent,
  useMemo,
  useState,
} from "react";

import type { PlatformEntityType } from "@/lib/platform-vnext-types";
import { cx } from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

// BRIXTA_DATA_IMPORT_V2 — Upload → Map → Check → Import

type DataType = "text" | "number" | "boolean" | "date";
type Step = "upload" | "map" | "check" | "done";

type SourceColumn = {
  key: string;
  label: string;
  dataType: DataType;
  nonEmptyCount: number;
  samples: string[];
};

type ImportPreview = {
  fileName: string;
  rowCount: number;
  suggestedTitle: string;
  suggestedDisplayKey: string;
  suggestedUniqueKey: string;
  suggestedLatitudeKey: string | null;
  suggestedLongitudeKey: string | null;
  columns: SourceColumn[];
  previewRows: Array<Record<string, string>>;
};

type MappingRow = {
  source: string;
  include: boolean;
  /** Existing field key, or NEW_FIELD to create one from `label`. */
  field: string;
  label: string;
  dataType: DataType;
  required: boolean;
};

type LocationMapping = {
  enabled: boolean;
  lat: string;
  lng: string;
  label: string;
  field: string;
  required: boolean;
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

type CheckReport = {
  summary: ImportSummary;
  issues: Array<{ row: number; column: string; message: string }>;
  issueCount: number;
  issueSummary: Array<{ column: string; message: string; count: number }>;
  duplicateKeys: string[];
};

type ImportResult = CheckReport & {
  entityType: PlatformEntityType;
};

type HistoryEntry = {
  id: string;
  at: string;
  fileName: string;
  byName?: string | null;
  total: number;
  created: number;
  updated: number;
  skippedExisting: number;
  duplicatesInFile: number;
  rejected: number;
};

const NEW_FIELD = "__new__";

const TYPE_LABELS: Array<[DataType, string]> = [
  ["text", "Text"],
  ["number", "Number"],
  ["boolean", "Yes / No"],
  ["date", "Date"],
];

const STEPS: Array<[Step, string]> = [
  ["upload", "Upload"],
  ["map", "Map columns"],
  ["check", "Check"],
  ["done", "Import"],
];

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function prettyLabel(label: string) {
  const clean = label.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean[0].toUpperCase() + clean.slice(1) : label;
}

function asDataType(value: string): DataType {
  return value === "number" || value === "boolean" || value === "date" ? value : "text";
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function postImport<T>(form: FormData): Promise<T> {
  const response = await fetch("/api/platform/data-import", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("Server returned invalid JSON.");
    }
  }
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Request failed (${response.status}).`,
    );
  }
  return body as T;
}

function rowsForNewList(preview: ImportPreview, locationColumns: string[]): MappingRow[] {
  return preview.columns.map((column) => ({
    source: column.key,
    include: !locationColumns.includes(column.key),
    field: NEW_FIELD,
    label: prettyLabel(column.label),
    dataType: column.dataType,
    required: false,
  }));
}

function rowsForExistingList(
  preview: ImportPreview,
  entity: PlatformEntityType,
  locationColumns: string[],
): MappingRow[] {
  const fields = entity.fieldDefinitions ?? [];
  return preview.columns.map((column) => {
    const match = fields.find(
      (field) =>
        field.key === column.key ||
        normalizeKey(field.label) === normalizeKey(column.label),
    );
    return {
      source: column.key,
      include: !locationColumns.includes(column.key),
      field: match?.key ?? NEW_FIELD,
      label: match?.label ?? prettyLabel(column.label),
      dataType: match ? asDataType(match.dataType) : column.dataType,
      required: Boolean(match?.required),
    };
  });
}

function StepBar({ step }: { step: Step }) {
  const current = STEPS.findIndex(([key]) => key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map(([key, label], index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-semibold",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary/30 bg-primary/10 text-primary",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cx(
                "text-[13px]",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "good" | "info" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-foreground",
    good: "text-emerald-700 dark:text-emerald-300",
    info: "text-blue-700 dark:text-blue-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-300",
  }[tone];

  return (
    <div className="brixta-soft-card px-4 py-4">
      <div className={cx("text-2xl font-semibold tracking-[-0.02em]", toneClass)}>
        {formatCount(value)}
      </div>
      <div className="mt-1 text-[13px] font-medium text-foreground">{label}</div>
      {hint && <div className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function EntityImportWizard({
  entities,
  onImported,
}: {
  entities: PlatformEntityType[];
  onImported: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState("");
  const [entityTypeId, setEntityTypeId] = useState<number | null>(null);
  const [uniqueColumn, setUniqueColumn] = useState("");
  const [displayColumn, setDisplayColumn] = useState("");
  const [onExisting, setOnExisting] = useState<"update" | "skip">("update");
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [location, setLocation] = useState<LocationMapping>({
    enabled: false,
    lat: "",
    lng: "",
    label: "Location",
    field: "location",
    required: false,
  });

  const [report, setReport] = useState<CheckReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const activeEntities = useMemo(
    () => entities.filter((entity) => entity.isActive !== false),
    [entities],
  );
  const selectedEntity = activeEntities.find((entity) => entity.id === entityTypeId) ?? null;

  const history = useMemo(() => {
    const entries: Array<HistoryEntry & { listTitle: string }> = [];
    for (const entity of entities) {
      const raw = entity.config?.["imports"];
      if (!Array.isArray(raw)) continue;
      for (const item of raw) {
        if (item && typeof item === "object" && typeof (item as HistoryEntry).at === "string") {
          entries.push({ ...(item as HistoryEntry), listTitle: entity.title });
        }
      }
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  }, [entities]);

  const locationColumns = location.enabled ? [location.lat, location.lng] : [];

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setReport(null);
    setResult(null);
    setError(null);
    setRows([]);
    setInputKey((value) => value + 1);
  }

  async function readFile(nextFile: File) {
    setError(null);
    setReport(null);
    setResult(null);
    setFile(nextFile);
    setBusy("preview");
    try {
      const form = new FormData();
      form.append("mode", "preview");
      form.append("file", nextFile);
      const body = await postImport<{ preview: ImportPreview }>(form);
      const next = body.preview;

      const lat = next.suggestedLatitudeKey;
      const lng = next.suggestedLongitudeKey;
      const hasLocation = Boolean(lat && lng);
      const nextLocationColumns = hasLocation ? [lat!, lng!] : [];

      setPreview(next);
      setTitle(next.suggestedTitle);
      setUniqueColumn(next.suggestedUniqueKey);
      setDisplayColumn(next.suggestedDisplayKey);
      setLocation({
        enabled: hasLocation,
        lat: lat ?? "",
        lng: lng ?? "",
        label: "Location",
        field: "location",
        required: false,
      });

      if (targetMode === "existing" && selectedEntity) {
        setRows(rowsForExistingList(next, selectedEntity, nextLocationColumns));
      } else {
        setRows(rowsForNewList(next, nextLocationColumns));
      }
      setStep("map");
    } catch (failure) {
      setFile(null);
      setError(failure instanceof Error ? failure.message : "Unable to read this file.");
    } finally {
      setBusy(null);
    }
  }

  function chooseTarget(mode: "new" | "existing", nextEntityId: number | null = entityTypeId) {
    setTargetMode(mode);
    setReport(null);
    if (!preview) return;
    if (mode === "existing") {
      const entity = activeEntities.find((item) => item.id === nextEntityId) ?? null;
      setEntityTypeId(entity?.id ?? null);
      if (entity) {
        setRows(rowsForExistingList(preview, entity, locationColumns));
        const locationField = (entity.fieldDefinitions ?? []).find(
          (field) => field.dataType === "location_point",
        );
        if (locationField) {
          setLocation((current) => ({
            ...current,
            field: locationField.key,
            label: locationField.label,
          }));
        }
      }
    } else {
      setRows(rowsForNewList(preview, locationColumns));
      setLocation((current) => ({ ...current, field: "location", label: "Location" }));
    }
  }

  function updateRow(source: string, patch: Partial<MappingRow>) {
    setReport(null);
    setRows((current) =>
      current.map((row) => (row.source === source ? { ...row, ...patch } : row)),
    );
  }

  function toggleLocation(enabled: boolean) {
    setReport(null);
    setLocation((current) => ({ ...current, enabled }));
    setRows((current) =>
      current.map((row) =>
        row.source === location.lat || row.source === location.lng
          ? { ...row, include: !enabled }
          : row,
      ),
    );
  }

  function fieldKeyFor(row: MappingRow) {
    return targetMode === "existing" && row.field !== NEW_FIELD
      ? row.field
      : normalizeKey(row.label) || normalizeKey(row.source);
  }

  function buildPlan() {
    const kept = rows.filter((row) => row.include && !locationColumns.includes(row.source));
    const displayRow = kept.find((row) => row.source === displayColumn) ?? null;

    return {
      target:
        targetMode === "existing"
          ? { mode: "existing", entityTypeId }
          : { mode: "new", title },
      uniqueColumn,
      displayField: displayRow ? fieldKeyFor(displayRow) : null,
      onExisting,
      columns: kept.map((row) => ({
        source: row.source,
        field: fieldKeyFor(row),
        label: row.label,
        dataType: row.dataType,
        required: row.required,
      })),
      location:
        location.enabled && location.lat && location.lng
          ? {
              lat: location.lat,
              lng: location.lng,
              field: location.field,
              label: location.label,
              required: location.required,
            }
          : null,
    };
  }

  const planProblem = (() => {
    if (!preview) return "Upload a file first.";
    if (targetMode === "new" && !title.trim()) return "Give the new list a name.";
    if (targetMode === "existing" && !selectedEntity) return "Choose the list to add to.";
    if (!uniqueColumn) return "Choose the column that identifies each record.";
    const kept = rows.filter((row) => row.include && !locationColumns.includes(row.source));
    if (kept.length === 0 && !location.enabled) return "Keep at least one column.";
    if (location.enabled && (!location.lat || !location.lng || location.lat === location.lng)) {
      return "Pick a latitude and a longitude column.";
    }
    const keys = kept.map(fieldKeyFor);
    if (location.enabled) keys.push(location.field);
    const repeated = keys.find((key, index) => keys.indexOf(key) !== index);
    if (repeated) return `Two columns are saved as "${repeated}". Rename one of them.`;
    return null;
  })();

  async function send(mode: "check" | "import") {
    if (!file || planProblem) return;
    setBusy(mode);
    setError(null);
    try {
      const form = new FormData();
      form.append("mode", mode);
      form.append("file", file);
      form.append("plan", JSON.stringify(buildPlan()));
      if (mode === "check") {
        const body = await postImport<CheckReport>(form);
        setReport(body);
        setStep("check");
      } else {
        const body = await postImport<ImportResult>(form);
        setResult(body);
        setStep("done");
        await onImported();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void readFile(dropped);
  }

  const writeCount = report ? report.summary.toCreate + report.summary.toUpdate : 0;

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-base font-semibold">Import data</div>
              <div className="mt-1 text-xs text-muted-foreground">
                CSV, Excel or JSON. Nothing is saved until you press Import.
              </div>
            </div>
          </div>
          <StepBar step={step} />
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-red-600/20 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "upload" && (
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              "mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed px-6 py-12 text-center transition",
              dragging
                ? "border-primary bg-primary/[0.08]"
                : "border-[rgba(60,60,67,0.16)] bg-[#F7F7FA] hover:bg-[#F0F0F5]",
            )}
          >
            <input
              key={inputKey}
              type="file"
              className="sr-only"
              accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void readFile(selected);
              }}
            />
            {busy === "preview" ? (
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            ) : (
              <Upload className="h-7 w-7 text-primary" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {busy === "preview"
                  ? `Reading ${file?.name ?? "file"}…`
                  : "Drop a file here, or click to choose"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Up to 20,000 rows · 15 MB · first row must be the column names
              </div>
            </div>
          </label>
        )}

        {step !== "upload" && preview && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[rgba(60,60,67,0.08)] bg-[#F7F7FA] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{preview.fileName}</div>
              <div className="text-xs text-muted-foreground">
                {formatCount(preview.rowCount)} rows · {preview.columns.length} columns
              </div>
            </div>
            {step !== "done" && (
              <SecondaryButton type="button" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                Change file
              </SecondaryButton>
            )}
          </div>
        )}

        {step === "map" && preview && (
          <div className="mt-5 space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <span className="block text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
                  Where should these records go?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => chooseTarget("new")}
                    className={cx(
                      "h-10 rounded-[12px] border px-3 text-[13px] font-medium transition",
                      targetMode === "new"
                        ? "border-primary bg-primary/[0.08] text-foreground ring-1 ring-primary/20"
                        : "hover:bg-muted/50",
                    )}
                  >
                    A new list
                  </button>
                  <button
                    type="button"
                    disabled={activeEntities.length === 0}
                    onClick={() => chooseTarget("existing", entityTypeId ?? activeEntities[0]?.id ?? null)}
                    className={cx(
                      "h-10 rounded-[12px] border px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                      targetMode === "existing"
                        ? "border-primary bg-primary/[0.08] text-foreground ring-1 ring-primary/20"
                        : "hover:bg-muted/50",
                    )}
                  >
                    An existing list
                  </button>
                </div>
                {targetMode === "new" ? (
                  <input
                    aria-label="New list name"
                    className={inputClass}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setReport(null);
                    }}
                    placeholder="e.g. Sites"
                  />
                ) : (
                  <select
                    aria-label="Existing list"
                    className={inputClass}
                    value={entityTypeId ?? ""}
                    onChange={(event) => chooseTarget("existing", Number(event.target.value))}
                  >
                    {activeEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Field
                label="Which column identifies each record?"
                hint="Used to catch repeats and to update the same records on the next import."
              >
                <select
                  className={inputClass}
                  value={uniqueColumn}
                  onChange={(event) => {
                    setUniqueColumn(event.target.value);
                    setReport(null);
                  }}
                >
                  {preview.columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                      {column.nonEmptyCount < preview.rowCount
                        ? ` (empty in ${formatCount(preview.rowCount - column.nonEmptyCount)} rows)`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="If a record is already in the list"
                hint="Updating never blanks out details your team added in the field."
              >
                <select
                  className={inputClass}
                  value={onExisting}
                  onChange={(event) => {
                    setOnExisting(event.target.value === "skip" ? "skip" : "update");
                    setReport(null);
                  }}
                >
                  <option value="update">Update it with the new values</option>
                  <option value="skip">Leave it as it is</option>
                </select>
              </Field>
            </div>

            <div className="brixta-soft-card p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={location.enabled}
                  onChange={(event) => toggleLocation(event.target.checked)}
                />
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Combine latitude and longitude into one map location</span>
              </label>
              {location.enabled && (
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Field label="Latitude column">
                    <select
                      className={inputClass}
                      value={location.lat}
                      onChange={(event) => {
                        const next = event.target.value;
                        setReport(null);
                        setRows((current) =>
                          current.map((row) =>
                            row.source === next
                              ? { ...row, include: false }
                              : row.source === location.lat
                                ? { ...row, include: true }
                                : row,
                          ),
                        );
                        setLocation((current) => ({ ...current, lat: next }));
                      }}
                    >
                      {preview.columns.map((column) => (
                        <option key={column.key} value={column.key}>{column.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Longitude column">
                    <select
                      className={inputClass}
                      value={location.lng}
                      onChange={(event) => {
                        const next = event.target.value;
                        setReport(null);
                        setRows((current) =>
                          current.map((row) =>
                            row.source === next
                              ? { ...row, include: false }
                              : row.source === location.lng
                                ? { ...row, include: true }
                                : row,
                          ),
                        );
                        setLocation((current) => ({ ...current, lng: next }));
                      }}
                    >
                      {preview.columns.map((column) => (
                        <option key={column.key} value={column.key}>{column.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Save as">
                    <input
                      className={inputClass}
                      value={location.label}
                      disabled={targetMode === "existing" && location.field !== "location"}
                      onChange={(event) => {
                        const label = event.target.value;
                        setReport(null);
                        setLocation((current) => ({
                          ...current,
                          label,
                          field:
                            targetMode === "existing" && current.field !== "location"
                              ? current.field
                              : normalizeKey(label) || "location",
                        }));
                      }}
                    />
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={location.required}
                      onChange={(event) =>
                        setLocation((current) => ({ ...current, required: event.target.checked }))
                      }
                    />
                    Reject rows without a location
                  </label>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Columns</div>
                  <div className="text-xs text-muted-foreground">
                    Untick a column to leave it out. Rename it to change how it shows in the app.
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Show records by{" "}
                  <select
                    className="brixta-input ml-1 h-8 px-2 text-[13px]"
                    value={displayColumn}
                    onChange={(event) => setDisplayColumn(event.target.value)}
                  >
                    {rows
                      .filter((row) => row.include && !locationColumns.includes(row.source))
                      .map((row) => (
                        <option key={row.source} value={row.source}>{row.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[14px] border border-[rgba(60,60,67,0.10)] bg-card">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 border-b px-3 py-2 font-medium">Keep</th>
                      <th className="border-b px-3 py-2 font-medium">Column in file</th>
                      <th className="border-b px-3 py-2 font-medium">Save as</th>
                      <th className="border-b px-3 py-2 font-medium">Type</th>
                      <th className="border-b px-3 py-2 font-medium">Required</th>
                      <th className="border-b px-3 py-2 font-medium">Filled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const column = preview.columns.find((item) => item.key === row.source)!;
                      const usedForLocation = locationColumns.includes(row.source);
                      const disabled = !row.include || usedForLocation;
                      const filled = column.nonEmptyCount;
                      return (
                        <tr
                          key={row.source}
                          className={cx("border-b last:border-0", disabled && "bg-muted/[0.15]")}
                        >
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Keep ${column.label}`}
                              className="mt-2 h-4 w-4 accent-[var(--primary)]"
                              checked={row.include && !usedForLocation}
                              disabled={usedForLocation}
                              onChange={(event) => updateRow(row.source, { include: event.target.checked })}
                            />
                          </td>
                          <td className="max-w-[260px] px-3 py-2 align-top">
                            <div className={cx("font-medium", disabled && "text-muted-foreground")}>
                              {column.label}
                              {row.source === uniqueColumn && (
                                <span className="ml-2"><Pill tone="info">ID</Pill></span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {column.samples.length ? column.samples.join(" · ") : "Empty in this file"}
                            </div>
                          </td>
                          <td className="min-w-[220px] px-3 py-2 align-top">
                            {usedForLocation ? (
                              <div className="pt-2 text-xs text-muted-foreground">
                                Part of {location.label || "Location"}
                              </div>
                            ) : targetMode === "existing" && selectedEntity ? (
                              <div className="space-y-2">
                                <select
                                  className={inputClass}
                                  value={row.field}
                                  disabled={disabled}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    const match = (selectedEntity.fieldDefinitions ?? []).find(
                                      (field) => field.key === value,
                                    );
                                    updateRow(row.source, {
                                      field: value,
                                      label: match?.label ?? prettyLabel(column.label),
                                      dataType: match ? asDataType(match.dataType) : column.dataType,
                                    });
                                  }}
                                >
                                  {(selectedEntity.fieldDefinitions ?? [])
                                    .filter((field) => field.dataType !== "location_point")
                                    .map((field) => (
                                      <option key={field.key} value={field.key}>{field.label}</option>
                                    ))}
                                  <option value={NEW_FIELD}>+ New field…</option>
                                </select>
                                {row.field === NEW_FIELD && (
                                  <input
                                    className={inputClass}
                                    value={row.label}
                                    disabled={disabled}
                                    onChange={(event) => updateRow(row.source, { label: event.target.value })}
                                  />
                                )}
                              </div>
                            ) : (
                              <input
                                className={inputClass}
                                value={row.label}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.source, { label: event.target.value })}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <select
                              className={cx(inputClass, "min-w-[120px]")}
                              value={row.dataType}
                              disabled={disabled || (targetMode === "existing" && row.field !== NEW_FIELD)}
                              onChange={(event) => updateRow(row.source, { dataType: asDataType(event.target.value) })}
                            >
                              {TYPE_LABELS.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              aria-label={`${column.label} is required`}
                              className="mt-3 h-4 w-4 accent-[var(--primary)]"
                              checked={row.required}
                              disabled={disabled}
                              onChange={(event) => updateRow(row.source, { required: event.target.checked })}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="pt-2">
                              <Pill
                                tone={
                                  filled === 0
                                    ? "neutral"
                                    : filled === preview.rowCount
                                      ? "good"
                                      : "warning"
                                }
                              >
                                {filled === preview.rowCount
                                  ? "All rows"
                                  : `${formatCount(filled)} / ${formatCount(preview.rowCount)}`}
                              </Pill>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {planProblem && <span className="text-sm text-muted-foreground">{planProblem}</span>}
              <PrimaryButton
                type="button"
                disabled={Boolean(planProblem) || busy !== null}
                onClick={() => void send("check")}
              >
                {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Check {formatCount(preview.rowCount)} rows
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === "check" && report && preview && (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryTile label="Rows in file" value={report.summary.total} />
              <SummaryTile label="New records" value={report.summary.toCreate} tone="good" />
              <SummaryTile
                label={onExisting === "skip" ? "Already in list (left as is)" : "Will be updated"}
                value={onExisting === "skip" ? report.summary.skippedExisting : report.summary.toUpdate}
                tone="info"
              />
              <SummaryTile
                label="Repeats in file"
                value={report.summary.duplicatesInFile}
                hint={report.summary.duplicatesInFile ? "First one is kept, the rest are skipped." : undefined}
                tone={report.summary.duplicatesInFile ? "warning" : "neutral"}
              />
              <SummaryTile
                label="Rejected"
                value={report.summary.rejected}
                hint={report.summary.rejected ? "Fix these in the file and import again." : undefined}
                tone={report.summary.rejected ? "danger" : "neutral"}
              />
            </div>

            {report.issueSummary.length > 0 && (
              <div className="brixta-soft-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  What's wrong with the rejected rows
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.issueSummary.map((item) => (
                    <Pill key={`${item.column}-${item.message}`} tone="warning">
                      {item.column}: {item.message} · {formatCount(item.count)}
                    </Pill>
                  ))}
                </div>
                <div className="mt-4 max-h-72 overflow-auto rounded-[12px] border border-[rgba(60,60,67,0.10)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Column</th>
                        <th className="px-3 py-2 font-medium">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.issues.slice(0, 100).map((issue, index) => (
                        <tr key={`${issue.row}-${issue.column}-${index}`} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs">{issue.row}</td>
                          <td className="px-3 py-1.5">{issue.column}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.issueCount > 100 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Showing the first 100 of {formatCount(report.issueCount)} problems.
                  </div>
                )}
              </div>
            )}

            {report.duplicateKeys.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Repeated IDs: {report.duplicateKeys.join(", ")}
                {report.summary.duplicatesInFile > report.duplicateKeys.length ? " …" : ""}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SecondaryButton type="button" onClick={() => setStep("map")}>
                <ArrowLeft className="h-4 w-4" />
                Back to mapping
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={writeCount === 0 || busy !== null}
                onClick={() => void send("import")}
              >
                {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {writeCount === 0
                  ? "Nothing to import"
                  : `Import ${formatCount(writeCount)} records`}
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-5 space-y-5">
            <div className="flex items-start gap-3 rounded-[14px] border border-emerald-600/20 bg-emerald-600/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <div>
                <div className="text-sm font-semibold">
                  Saved to “{result.entityType.title}”
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatCount(result.summary.toCreate)} added · {formatCount(result.summary.toUpdate)} updated
                  {result.summary.skippedExisting ? ` · ${formatCount(result.summary.skippedExisting)} left as is` : ""}
                  {result.summary.duplicatesInFile ? ` · ${formatCount(result.summary.duplicatesInFile)} repeats skipped` : ""}
                  {result.summary.rejected ? ` · ${formatCount(result.summary.rejected)} rejected` : ""}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <PrimaryButton type="button" onClick={reset}>
                <Upload className="h-4 w-4" />
                Import another file
              </PrimaryButton>
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4" />
          Recent imports
        </div>
        <div className="mt-4">
          {history.length === 0 ? (
            <EmptyState
              title="No imports yet"
              description="Each import is listed here with what was added, updated and rejected."
            />
          ) : (
            <div className="overflow-x-auto rounded-[14px] border border-[rgba(60,60,67,0.10)] bg-card">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/20 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">List</th>
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="px-3 py-2 text-right font-medium">Added</th>
                    <th className="px-3 py-2 text-right font-medium">Updated</th>
                    <th className="px-3 py-2 text-right font-medium">Skipped</th>
                    <th className="px-3 py-2 text-right font-medium">Rejected</th>
                    <th className="px-3 py-2 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2">{formatWhen(entry.at)}</td>
                      <td className="px-3 py-2 font-medium">{entry.listTitle}</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-muted-foreground">{entry.fileName}</td>
                      <td className="px-3 py-2 text-right">{formatCount(entry.created)}</td>
                      <td className="px-3 py-2 text-right">{formatCount(entry.updated)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCount((entry.skippedExisting ?? 0) + (entry.duplicatesInFile ?? 0))}
                      </td>
                      <td className={cx("px-3 py-2 text-right", entry.rejected > 0 && "text-red-700 dark:text-red-300")}>
                        {formatCount(entry.rejected)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.byName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
