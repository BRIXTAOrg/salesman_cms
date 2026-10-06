"use client";

import {
  Boxes,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
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
import EntityImportWizard from "./entity-import-wizard";
import FieldAppSettings, { hasFieldAppDraft, isInFieldApp } from "./field-app-settings";
import AssignListWork from "./assign-list-work";
import EntityRecordsBrowser from "./entity-records-browser";
import {
  EmptyState,
  Field,
  inputClass,
  Notice,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";

// BRIXTA_ENTITIES_IMPORT_V2 (import lives in entity-import-wizard.tsx)

type EntityField = {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
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

function lastImport(entity: PlatformEntityType) {
  const imports = entity.config?.["imports"];
  if (Array.isArray(imports) && imports.length > 0) {
    const latest = imports[0] as Record<string, unknown>;
    const at = new Date(String(latest.at ?? ""));
    return {
      when: Number.isNaN(at.getTime())
        ? null
        : at.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      added: Number(latest.created ?? 0),
    };
  }
  // Lists created by the first importer kept only a row count.
  const legacy = entity.config?.["import"];
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const rows = Number((legacy as Record<string, unknown>)["rowCount"]);
    return Number.isFinite(rows) ? { when: null, added: rows } : null;
  }
  return null;
}

export default function EntitiesClient({
  standalone = false,
}: {
  /** true on /dashboard/lists, where this is the whole page */
  standalone?: boolean;
} = {}) {
  const [items, setItems] = useState<PlatformEntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldEntity, setFieldEntity] = useState<PlatformEntityType | null>(null);
  const [assignEntity, setAssignEntity] = useState<PlatformEntityType | null>(null);
  const [browseEntity, setBrowseEntity] = useState<PlatformEntityType | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EntityField[]>([
    { key: "name", label: "Name", dataType: "text", required: true },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ entityTypes: PlatformEntityType[] }>(
        "/api/platform/entities",
      );
      setItems(body.entityTypes ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load your lists.",
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
      setMessage("Add at least one column.");
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
      setMessage(`"${title}" was created. Import CRM rows into it or configure its employee input.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the list.");
    } finally {
      setSaving(false);
    }
  }

  function updateField(index: number, patch: Partial<EntityField>) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  const listPanel = (
    <Panel className="p-0 md:p-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <div className="text-[15px] font-semibold">Your lists</div>
          <div className="text-[13px] text-muted-foreground">
            {items.length === 0 ? "Nothing here yet." : `${items.length} list${items.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <SecondaryButton type="button" className="h-9" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </SecondaryButton>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No lists yet"
            description="Import a spreadsheet below, or create a list by hand."
          />
        </div>
      ) : (
        <div className="divide-y">
          {items.map((item) => {
            const imported = lastImport(item);
            const inApp = isInFieldApp(item);
            const shown = item.fieldDefinitions.slice(0, 6);
            const more = item.fieldDefinitions.length - shown.length;
            return (
              <div key={item.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{item.title}</span>
                    {!item.isActive && <Pill>Disabled</Pill>}
                    {inApp && <Pill tone="good">Data input live</Pill>}
                    {hasFieldAppDraft(item) && <Pill tone="warning">Unpublished changes</Pill>}
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {item.fieldDefinitions.length} columns
                    {imported
                      ? ` · last import ${imported.when || ""} added ${imported.added.toLocaleString("en-IN")}`
                      : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {shown.map((field) => (
                      <Pill key={field.key}>{field.label}</Pill>
                    ))}
                    {more > 0 && <Pill>+{more} more</Pill>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => setBrowseEntity(item)}
                  >
                    View records
                  </SecondaryButton>

                  <SecondaryButton
                    type="button"
                    onClick={() => setAssignEntity(item)}
                  >
                    Assign work
                  </SecondaryButton>

                  {inApp ? (
                    <SecondaryButton type="button" onClick={() => setFieldEntity(item)}>
                      <Smartphone className="h-4 w-4" />
                      Data input settings
                    </SecondaryButton>
                  ) : (
                    <PrimaryButton type="button" onClick={() => setFieldEntity(item)}>
                      <Smartphone className="h-4 w-4" />
                      Use for data input
                    </PrimaryButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );

  return (
    <div className="min-w-0 space-y-6">
      {standalone ? (
        <PageIntro
          title="CRM & inputs"
          description="Your CRM lists live here. Imported Dealers, Sites, Products and other records automatically become searchable data sources for Responsibilities. Separately configure what new information field users must enter."
        />
      ) : (
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <Boxes className="h-5 w-5" />
          Lists
        </div>
      )}

      {message && (
        <Notice tone="info" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}

      {listPanel}

      <EntityImportWizard entities={items} onImported={load} />

      <details className="group rounded-[14px] border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold">
          Create a list by hand
          <Plus className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-45" />
        </summary>
        <div className="border-t px-5 py-5">
          <form onSubmit={create} className="space-y-5">
            <Field label="What is the list called?">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Dealers, Work sites, Machines…" required />
            </Field>

            <Field label="What is it for?" hint="Optional.">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} rows={2} />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-medium">Columns</div>
                <SecondaryButton type="button" className="h-9" onClick={() => setFields((current) => [...current, newField()])}>
                  <Plus className="h-4 w-4" />Add column
                </SecondaryButton>
              </div>

              {fields.map((field, index) => (
                <div key={index} className="grid gap-3 rounded-[12px] border p-3 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
                  <input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value, key: normalizeKey(e.target.value) })}
                    className={inputClass}
                    placeholder="Column name"
                    aria-label="Column name"
                  />
                  <select value={field.dataType} onChange={(e) => updateField(index, { dataType: e.target.value })} className={inputClass} aria-label="Column type">
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
                    aria-label="Remove column"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create list
            </PrimaryButton>
          </form>
        </div>
      </details>

      {fieldEntity && (
        <FieldAppSettings
          entity={fieldEntity}
          onClose={() => setFieldEntity(null)}
          onSaved={async () => {
            setMessage(`"${fieldEntity.title}" data input settings saved.`);
            await load();
          }}
        />
      )}

      {assignEntity && (
        <AssignListWork
          entity={assignEntity}
          onClose={() => setAssignEntity(null)}
        />
      )}

      {browseEntity && (
        <EntityRecordsBrowser
          entity={browseEntity}
          onClose={() => setBrowseEntity(null)}
        />
      )}
    </div>
  );
}
