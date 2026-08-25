"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

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

type EntityField = {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
};

type EntityType = {
  id: number;
  key: string;
  title: string;
  description?: string | null;
  fieldDefinitions: EntityField[];
  searchableFields: string[];
  isActive: boolean;
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
  return {
    key: "",
    label: "",
    dataType: "text",
    required: false,
  };
}

export default function EntitiesClient() {
  const [items, setItems] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EntityField[]>([
    { key: "name", label: "Name", dataType: "text", required: true },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ entityTypes: EntityType[] }>("/api/platform/entities");
      setItems(body.entityTypes ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load reusable data.");
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
          displayTemplate: validFields[0]?.key ? `{{${validFields[0].key}}}` : null,
        }),
      });

      setTitle("");
      setDescription("");
      setFields([{ key: "name", label: "Name", dataType: "text", required: true }]);
      setMessage("Reusable business object created. It can now be selected inside Responsibilities.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create reusable object.");
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
              Reusable Business Data
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use this only when something exists independently of a Responsibility:
              a Dealer, Site, Machine, Vehicle, Product, Customer, Asset, etc.
              You define it once, then any Responsibility can search/select/update it.
            </p>
            <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="font-medium">Example:</span> create a <b>Dealer</b> here once.
              Then a Dealer Visit Responsibility can show a searchable Dealer dropdown
              instead of asking the employee to retype the dealer every visit.
            </div>
          </div>
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        </div>
      </Panel>

      {message && <Panel className="py-3"><div className="text-sm">{message}</div></Panel>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <Panel>
          <form onSubmit={create} className="space-y-5">
            <div>
              <div className="text-base font-semibold">Create reusable thing</div>
              <div className="mt-1 text-xs text-muted-foreground">
                This does not create a new PostgreSQL table. It defines metadata in the shared entity store.
              </div>
            </div>

            <Field label="What is the thing called?">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                placeholder="Dealer, Work Site, Machine, Vehicle..."
                required
              />
            </Field>

            <Field label="What is it for?">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={textareaClass}
                rows={2}
                placeholder="Optional plain-English description"
              />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">What information does it contain?</div>
                  <div className="text-xs text-muted-foreground">Add normal fields. No key:type syntax.</div>
                </div>
                <SecondaryButton
                  type="button"
                  onClick={() => setFields((current) => [...current, newField()])}
                >
                  <Plus className="h-4 w-4" />
                  Field
                </SecondaryButton>
              </div>

              {fields.map((field, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.2fr_1fr_auto_auto]">
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(index, {
                        label: event.target.value,
                        key: normalizeKey(event.target.value),
                      })
                    }
                    className={inputClass}
                    placeholder="Field name — e.g. Dealer name"
                  />

                  <select
                    value={field.dataType}
                    onChange={(event) => updateField(index, { dataType: event.target.value })}
                    className={inputClass}
                  >
                    {FIELD_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                    />
                    Required
                  </label>

                  <button
                    type="button"
                    onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create reusable thing
            </PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <div className="text-base font-semibold">Available reusable things</div>
          <div className="mt-1 text-xs text-muted-foreground">
            These become selectable/queryable from Responsibilities.
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Nothing reusable yet"
                description="You only need this for data that lives independently of one Responsibility."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{item.title}</div>
                    <Pill tone={item.isActive ? "good" : "neutral"}>
                      {item.isActive ? "Ready" : "Disabled"}
                    </Pill>
                    <Pill tone="info">{item.fieldDefinitions.length} fields</Pill>
                  </div>
                  {item.description && (
                    <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.fieldDefinitions.map((field) => (
                      <Pill key={field.key}>{field.label}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
