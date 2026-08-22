"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Search,
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
} from "./primitives";
import type { PlatformDataSource } from "@/lib/platform-vnext-types";

type Discovered = {
  kind: "table" | "responsibility_records" | "entity_store";
  sourceRef: string;
  title: string;
  responsibilityId?: number;
  entityTypeId?: number;
  columns: Array<{
    name: string;
    dataType: string;
    nullable: boolean;
  }>;
};

export default function DataSourcesClient() {
  const [sources, setSources] = useState<PlatformDataSource[]>([]);
  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Discovered | null>(null);
  const [title, setTitle] = useState("");
  const [displayField, setDisplayField] = useState("");
  const [valueField, setValueField] = useState("id");
  const [searchable, setSearchable] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [sourceBody, discoveryBody] = await Promise.all([
        apiJson<{ dataSources: PlatformDataSource[] }>(
          "/api/platform/data-sources",
        ),
        apiJson<{ discovered: Discovered[] }>(
          "/api/platform/data-sources/discover",
        ),
      ]);

      setSources(sourceBody.dataSources ?? []);
      setDiscovered(discoveryBody.discovered ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Data Sources.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const registeredRefs = useMemo(
    () =>
      new Set(
        sources.map((item) => `${item.sourceType}:${item.sourceRef}`),
      ),
    [sources],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return discovered.filter((item) => {
      if (
        registeredRefs.has(`${item.kind}:${item.sourceRef}`)
      ) {
        return false;
      }

      if (!needle) return true;
      return `${item.title} ${item.sourceRef}`
        .toLowerCase()
        .includes(needle);
    });
  }, [discovered, query, registeredRefs]);

  function choose(item: Discovered) {
    setSelected(item);
    setTitle(item.title);

    const firstUseful =
      item.columns.find((column) =>
        /name|title|label|party|code/i.test(column.name),
      )?.name ??
      item.columns.find((column) => column.name !== "id")?.name ??
      "id";

    setDisplayField(
      item.kind === "responsibility_records" ? "status" : firstUseful,
    );
    setValueField("id");
    setSearchable(
      item.kind !== "responsibility_records"
        ? item.columns
            .filter((column) =>
              /name|title|label|code|phone|area|zone/i.test(column.name),
            )
            .slice(0, 4)
            .map((column) => column.name)
        : [],
    );
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setSaving(true);
    setMessage(null);

    try {
      await apiJson("/api/platform/data-sources", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          key: title.trim(),
          sourceType: selected.kind,
          sourceRef: selected.sourceRef,
          displayField: displayField || null,
          valueField: valueField || null,
          searchableFields: searchable,
          allowedFields: selected.columns.map((column) => column.name),
          offlinePolicy: {
            enabled: false,
            maxRows: 500,
          },
          config: {
            discovered: true,
          },
        }),
      });

      setSelected(null);
      setMessage("Data Source registered.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to register Data Source.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(source: PlatformDataSource) {
    if (!window.confirm(`Remove Data Source "${source.title}"?`)) {
      return;
    }

    setSaving(true);
    try {
      await apiJson(`/api/platform/data-sources/${source.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove Data Source.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
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
              <Database className="h-5 w-5" />
              Data Sources
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Register existing tenant data or records from another Responsibility.
              Responsibilities reference these generic sources instead of niche APIs.
            </p>
          </div>

          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Rediscover
          </SecondaryButton>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="text-sm font-semibold">Registered</div>

          {sources.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No Data Sources registered"
                description="Register an existing table or another Responsibility's records."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{source.title}</div>
                      <Pill tone={source.isActive ? "good" : "neutral"}>
                        {source.sourceType}
                      </Pill>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {source.sourceRef}
                      {source.displayField
                        ? ` · displays ${source.displayField}`
                        : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void remove(source)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove Data Source"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="text-sm font-semibold">Discover tenant data</div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search existing tables or Responsibilities..."
            />
          </div>

          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {filtered.map((item) => (
              <button
                type="button"
                key={`${item.kind}:${item.sourceRef}`}
                onClick={() => choose(item)}
                className="flex w-full items-start justify-between rounded-lg border p-3 text-left hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.kind === "responsibility_records"
                      ? "Generic Responsibility records"
                      : item.kind === "entity_store"
                        ? "Generic Entity store"
                        : `${item.columns.length} columns`}
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {selected && (
        <Panel>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="text-lg font-semibold">
                Register {selected.title}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                This creates metadata only. It does not copy or recreate the underlying data.
              </div>
            </div>

            <Field label="Data Source name">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Display field">
              <select
                value={displayField}
                onChange={(event) => setDisplayField(event.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {selected.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Stored value field">
              <select
                value={valueField}
                onChange={(event) => setValueField(event.target.value)}
                className={inputClass}
              >
                <option value="id">id</option>
                {selected.columns
                  .filter((column) => column.name !== "id")
                  .map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Searchable fields">
              <div className="grid gap-2 rounded-md border p-3">
                {selected.columns.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Responsibility-record sources are searched by the runtime record engine.
                  </div>
                ) : (
                  selected.columns.map((column) => (
                    <label
                      key={column.name}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={searchable.includes(column.name)}
                        onChange={(event) =>
                          setSearchable((current) =>
                            event.target.checked
                              ? [...new Set([...current, column.name])]
                              : current.filter((value) => value !== column.name),
                          )
                        }
                      />
                      {column.name}
                    </label>
                  ))
                )}
              </div>
            </Field>

            <div className="flex justify-end gap-2 md:col-span-2">
              <SecondaryButton
                type="button"
                onClick={() => setSelected(null)}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Register
              </PrimaryButton>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
