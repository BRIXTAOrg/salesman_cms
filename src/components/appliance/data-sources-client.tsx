"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
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
  columns: Array<{ name: string; dataType: string; nullable: boolean }>;
};

export default function DataSourcesClient() {
  const [sources, setSources] = useState<PlatformDataSource[]>([]);
  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sourceBody, discoveryBody] = await Promise.all([
        apiJson<{ dataSources: PlatformDataSource[] }>("/api/platform/data-sources"),
        apiJson<{ discovered: Discovered[] }>("/api/platform/data-sources/discover"),
      ]);
      setSources(sourceBody.dataSources ?? []);
      setDiscovered(discoveryBody.discovered ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load available data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const registeredRefs = useMemo(
    () => new Set(sources.map((item) => `${item.sourceType}:${item.sourceRef}`)),
    [sources],
  );

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return discovered.filter((item) => {
      if (registeredRefs.has(`${item.kind}:${item.sourceRef}`)) return false;
      if (!needle) return true;
      return `${item.title} ${item.sourceRef}`.toLowerCase().includes(needle);
    });
  }, [discovered, query, registeredRefs]);

  async function connect(item: Discovered) {
    setSaving(true);
    setMessage(null);
    try {
      const firstUseful =
        item.columns.find((column) => /name|title|label|code/i.test(column.name))?.name ??
        item.columns.find((column) => column.name !== "id")?.name ??
        (item.kind === "responsibility_records" ? "status" : "id");

      await apiJson("/api/platform/data-sources", {
        method: "POST",
        body: JSON.stringify({
          title: item.title,
          key: item.title,
          sourceType: item.kind,
          sourceRef: item.sourceRef,
          displayField: firstUseful,
          valueField: "id",
          searchableFields: item.columns
            .filter((column) => /name|title|label|code|phone|area|zone/i.test(column.name))
            .slice(0, 4)
            .map((column) => column.name),
          allowedFields: item.columns.map((column) => column.name),
          offlinePolicy: { enabled: false, maxRows: 500 },
          config: { discovered: true },
        }),
      });
      setMessage(`${item.title} is now available to Responsibilities.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect data.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(source: PlatformDataSource) {
    if (!window.confirm(`Disconnect "${source.title}" from Responsibility lookups?`)) return;
    setSaving(true);
    try {
      await apiJson(`/api/platform/data-sources/${source.id}`, { method: "DELETE" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center rounded-lg border"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Database className="h-5 w-5" />
              Existing Data
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This is the bridge that lets a Responsibility reuse data that already exists.
              Example: a Leave Responsibility can search Employees; a Dealer Visit can search Dealers;
              an Inspection can reference a Machine or a previous Inspection record.
            </p>
            <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
              You normally do <b>not</b> create data here. You simply connect existing data once,
              then use it from pickers, queries, rules and context inside the Studio.
            </div>
          </div>
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Rediscover
          </SecondaryButton>
        </div>
      </Panel>

      {message && <Panel className="py-3"><div className="text-sm">{message}</div></Panel>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel>
          <div className="text-base font-semibold">Connected data</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Responsibilities can immediately query/select these sources.
          </div>

          {sources.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nothing connected yet" description="Connect something from the right when a Responsibility needs existing records." />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      <div className="font-medium">{source.title}</div>
                      <Pill>{source.sourceType}</Pill>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Available for searchable pickers and queries
                    </div>
                  </div>
                  <button type="button" onClick={() => void remove(source)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="text-base font-semibold">Connect existing data</div>
          <div className="mt-1 text-xs text-muted-foreground">
            One click registers the source with sensible defaults. Advanced tuning can come later.
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search employees, dealers, sites, previous Responsibilities..."
            />
          </div>

          <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
            {available.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nothing else needs connecting.
              </div>
            ) : (
              available.map((item) => (
                <div key={`${item.kind}:${item.sourceRef}`} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.kind === "entity_store"
                        ? "Reusable business data"
                        : item.kind === "responsibility_records"
                          ? "Records created by another Responsibility"
                          : "Existing company table"}
                    </div>
                  </div>
                  <PrimaryButton type="button" disabled={saving} onClick={() => void connect(item)}>
                    <Plus className="h-4 w-4" />
                    Connect
                  </PrimaryButton>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
