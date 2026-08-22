"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Boxes,
  Loader2,
  Plus,
  RefreshCw,
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

type EntityType = {
  id: number;
  key: string;
  title: string;
  description?: string | null;
  fieldDefinitions: Array<{
    key: string;
    label: string;
    dataType: string;
    required?: boolean;
  }>;
  searchableFields: string[];
  isActive: boolean;
};

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function EntitiesClient() {
  const [items, setItems] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fieldsText, setFieldsText] = useState(
    "name:text\ncode:text\nlocation:location_point",
  );
  const [searchText, setSearchText] = useState("name\ncode");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ entityTypes: EntityType[] }>(
        "/api/platform/entities",
      );
      setItems(body.entityTypes ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Entity Types.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const fieldDefinitions = fieldsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [rawKey, rawType] = line.split(":");
        const key = normalizeKey(rawKey);
        return {
          key,
          label: rawKey
            .trim()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          dataType: (rawType ?? "text").trim(),
          required: false,
        };
      })
      .filter((field) => field.key);

    const searchableFields = searchText
      .split("\n")
      .map(normalizeKey)
      .filter(Boolean);

    try {
      await apiJson("/api/platform/entities", {
        method: "POST",
        body: JSON.stringify({
          title,
          key: title,
          description: description || null,
          fieldDefinitions,
          searchableFields,
          displayField:
            searchableFields[0] ?? fieldDefinitions[0]?.key ?? null,
          displayTemplate: searchableFields[0]
            ? `{{${searchableFields[0]}}}`
            : null,
        }),
      });

      setTitle("");
      setDescription("");
      setMessage(
        "Entity Type created. It is immediately available as a generic Data Source.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create Entity Type.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      <Panel>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Boxes className="h-5 w-5" />
              Entity Types
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Define reusable things that exist in the business. Creating an
              Entity Type creates metadata and rows in one generic entity store,
              never a new PostgreSQL table.
            </p>
          </div>

          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <form onSubmit={create} className="space-y-4">
            <div className="text-sm font-semibold">Create Entity Type</div>

            <Field label="Name">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                placeholder="Customer, Asset, Site, Product..."
                required
              />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={textareaClass}
                rows={2}
              />
            </Field>

            <Field label="Fields — one per line: key:type">
              <textarea
                value={fieldsText}
                onChange={(event) => setFieldsText(event.target.value)}
                className={textareaClass}
                rows={7}
              />
            </Field>

            <Field label="Searchable field keys — one per line">
              <textarea
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={textareaClass}
                rows={4}
              />
            </Field>

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Entity Type
            </PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <div className="text-sm font-semibold">Current Entity Types</div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No generic entities yet"
                description="Existing legacy tables can still be registered under DATA without creating Entity Types."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{item.title}</div>
                    <Pill tone={item.isActive ? "good" : "neutral"}>
                      {item.isActive ? "Active" : "Disabled"}
                    </Pill>
                    <Pill tone="info">
                      {item.fieldDefinitions.length} fields
                    </Pill>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.key}
                    {item.searchableFields.length
                      ? ` · search: ${item.searchableFields.join(", ")}`
                      : ""}
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
