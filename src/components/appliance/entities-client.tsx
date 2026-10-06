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

export default function EntitiesClient() {
  const [items, setItems] = useState<PlatformEntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldEntity, setFieldEntity] = useState<PlatformEntityType | null>(null);

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
              Entities are reusable business things: Sites, Dealers, Products,
              Machines and Customers. Import a CSV, Excel or JSON file into a new
              or existing list, or create one manually below.
            </p>
          </div>
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        </div>
      </Panel>

      {message && <Panel className="py-3"><div className="text-sm">{message}</div></Panel>}

      <EntityImportWizard entities={items} onImported={load} />

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
                const imported = lastImport(item);
                return (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{item.title}</div>
                      <Pill tone={item.isActive ? "good" : "neutral"}>{item.isActive ? "Ready" : "Disabled"}</Pill>
                      {isInFieldApp(item) && <Pill tone="info">In field app</Pill>}
                      {hasFieldAppDraft(item) && <Pill tone="warning">Unpublished changes</Pill>}
                      <SecondaryButton
                        type="button"
                        className="ml-auto h-8 px-3 text-[12px]"
                        onClick={() => setFieldEntity(item)}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        {isInFieldApp(item) ? "Field app settings" : "Send to field app"}
                      </SecondaryButton>
                      <Pill tone="info">{item.fieldDefinitions.length} fields</Pill>
                      {imported && (
                        <Pill>
                          Last import{imported.when ? ` ${imported.when}` : ""} · {imported.added.toLocaleString("en-IN")} added
                        </Pill>
                      )}
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

      {fieldEntity && (
        <FieldAppSettings
          entity={fieldEntity}
          onClose={() => setFieldEntity(null)}
          onSaved={async () => {
            setMessage(`"${fieldEntity.title}" field app settings saved.`);
            await load();
          }}
        />
      )}
    </div>
  );
}
