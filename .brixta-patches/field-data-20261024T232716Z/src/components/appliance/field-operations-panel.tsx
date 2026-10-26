"use client";

// BRIXTA_FIELD_OPS_V1: exports are read-only; distribution is opt-in.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "./client";
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";
import FieldPublishedPixelLogic from "./field-published-pixel-logic";

type Lead = { id: string; key: string | null; title: string; subtitle: string[]; stage: string; stageLabel: string;
  priority: number | null; assignee: { userId: number; name: string } | null; values: Record<string, string>;
  location: { lat: number; lng: number } | null };
type Person = { id: number; name: string; area: string | null };
type Presence = { cmsViewers: number; cmsWorking: number; mobileRecentlyConnectedTenantWide: number;
  scope: string; people: Array<{ name: string; mode: string }> };
type Props = { listId: number; listName: string; filters: { q: string; stage: string; lens: string; sort: string; assignee: string };
  people: Person[]; onChanged: () => Promise<void> };

function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  // Excel/LibreOffice CSV formula injection defense: even after whitespace.
  const safe = /^[\s\u0000-\u001F]*[=+@\-\t\r]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
function saveCsv(name: string, text: string) {
  const blob = new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2500);
}
function partition(items: Lead[], assignees: Person[]) {
  const groups = assignees.map(person => ({ person, ids: [] as string[] }));
  const base = Math.floor(items.length / groups.length);
  let offset = 0;
  groups.forEach((group, index) => {
    const size = base + (index < items.length % groups.length ? 1 : 0);
    group.ids = items.slice(offset, offset + size).map(item => item.id);
    offset += size;
  });
  return groups;
}

export default function FieldOperationsPanel({ listId, listName, filters, people, onChanged }: Props) {
  const [published, setPublished] = useState<PixelLogicProgram | null>(null);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [from, setFrom] = useState("1");
  const [count, setCount] = useState("100");
  const [preview, setPreview] = useState<Array<{ person: Person; ids: string[] }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ruleMessage, setRuleMessage] = useState("");
  const tab = useRef("");
  const [working, setWorking] = useState(false);
  if (!tab.current && typeof window !== "undefined") tab.current = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,16)}`;

  useEffect(() => {
    let cancelled = false;
    setPublished(null); setPublishedVersion(0);
    apiJson<{ published: { version: number; pixelLogic?: PixelLogicProgram | null } | null }>(`/api/platform/field-apps/${listId}`)
      .then(result => { if (!cancelled) { setPublished(result.published?.pixelLogic ?? null); setPublishedVersion(result.published?.version ?? 0); setRuleMessage(""); } })
      .catch(e => { if (!cancelled) setRuleMessage(e instanceof Error ? e.message : "Could not read live rule"); });
    return () => { cancelled = true; };
  }, [listId]);

  useEffect(() => { setPreview(null); }, [listId, filters.q, filters.stage, filters.lens, filters.sort, filters.assignee, selectedPeople, from, count]);

  useEffect(() => {
    let disposed = false;
    const pulse = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await apiJson("/api/platform/field-records/presence", { method: "POST", body: JSON.stringify({ listId, tab: tab.current, mode: working ? "working" : "viewing" }) });
        const state = await apiJson<Presence>(`/api/platform/field-records/presence?list=${listId}`);
        if (!disposed) setPresence(state);
      } catch { if (!disposed) setPresence(null); }
    };
    void pulse();
    const timer = window.setInterval(() => void pulse(), 30_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [listId, working]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ list: String(listId), export: "1", sort: filters.sort });
    if (filters.q) params.set("q", filters.q);
    if (filters.stage) params.set("stage", filters.stage);
    if (filters.lens) params.set("lens", filters.lens);
    if (filters.assignee) params.set("assignee", filters.assignee);
    return params.toString();
  }, [listId, filters.q, filters.stage, filters.lens, filters.sort, filters.assignee]);

  const fetchRows = useCallback(async (unassignedOnly: boolean): Promise<{ rows: Lead[]; total: number; list: { tableFields: Array<{ key: string; label: string }> } }> => {
    const qs = new URLSearchParams(queryString);
    if (unassignedOnly) qs.set("assignee", "none");
    return apiJson(`/api/platform/field-records?${qs.toString()}`);
  }, [queryString]);

  async function exportLeads() {
    setBusy(true); setStatus(""); setWorking(true);
    try {
      const result = await fetchRows(false);
      if (!result.rows.length) throw new Error("No records match these filters.");
      const custom = result.list.tableFields;
      const headers = ["Lead ID", "Reference", "Name", "Subtitle", "Stage", "Assigned to", "Priority", "Latitude", "Longitude", ...custom.map(x => x.label)];
      const content = [headers.map(csvEscape).join(","), ...result.rows.map(row => [
        row.id, row.key, row.title, row.subtitle.join(" / "), row.stageLabel, row.assignee?.name ?? "", row.priority,
        row.location?.lat ?? "", row.location?.lng ?? "", ...custom.map(c => row.values[c.key] ?? ""),
      ].map(csvEscape).join(","))].join("\r\n");
      saveCsv(`brixta-${listName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0,35)}-${new Date().toISOString().slice(0,10)}.csv`, content);
      setStatus(`Exported ${result.rows.length.toLocaleString("en-IN")} filtered lead summaries. No CRM records changed.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not export."); }
    finally { setBusy(false); setWorking(false); }
  }

  async function planDistribution() {
    setBusy(true); setStatus(""); setWorking(true);
    try {
      if (!selectedPeople.length) throw new Error("Choose at least one employee.");
      const start = Number(from), limit = Number(count);
      if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
        throw new Error("Enter a valid starting position and 1–5,000 leads.");
      }
      const result = await fetchRows(true);
      if (start > result.rows.length) throw new Error("Starting position exceeds the unassigned lead count.");
      const slice = result.rows.slice(start - 1, start - 1 + limit);
      const members = selectedPeople.map(id => people.find(p => p.id === id)).filter((p): p is Person => !!p);
      if (!members.length) throw new Error("Choose a valid field employee.");
      setPreview(partition(slice, members));
      setStatus(`Preview only. ${slice.length} currently unassigned leads from your filters. Nothing assigned yet.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not prepare allocation."); }
    finally { setBusy(false); setWorking(false); }
  }

  async function applyDistribution() {
    if (!preview) return;
    const intended = preview.reduce((sum, g) => sum + g.ids.length, 0);
    if (!window.confirm(`Assign up to ${intended} currently unassigned ${listName} leads to ${preview.length} employees?\n\nOnly records still unassigned will be updated. This is a REAL change to the current tenant. Continue?`)) return;
    setBusy(true); setWorking(true); setStatus("");
    let changed = 0; let skipped = 0;
    try {
      // Detect a stale preview before the first write. Individual records
      // remain conditionally protected by the server if another admin assigns.
      const fresh = await fetchRows(true);
      const start = Number(from) - 1;
      const planned = new Set(preview.flatMap(group => group.ids));
      const current = fresh.rows.slice(start, start + intended);
      if (current.length !== intended || current.some(row => !planned.has(row.id))) {
        throw new Error("Preview is stale: the unassigned list changed. Preview again before confirming.");
      }
      for (const group of preview) {
        for (let i = 0; i < group.ids.length; i += 200) {
          const ids = group.ids.slice(i, i + 200);
          const response = await apiJson<{ updated: number }>("/api/platform/field-records/assign", {
            method: "POST", body: JSON.stringify({ ids, userId: group.person.id, expectedTypeId: listId, onlyIfUnassigned: true }),
          });
          changed += response.updated; skipped += ids.length - response.updated;
        }
      }
      setStatus(`Assigned ${changed}; ${skipped} skipped because they were already assigned/changed. Every successful assignment is audited.`);
    } catch (e) {
      setStatus(`${changed ? "Partial operation" : "No assignments applied"}: ${changed} assigned, ${skipped} skipped. STOPPED due to: ${e instanceof Error ? e.message : "unknown error"}. Preview again before retrying.`);
    } finally {
      setPreview(null); setBusy(false); setWorking(false); await onChanged();
    }
  }

  return (
    <div className="space-y-4">
      <FieldPublishedPixelLogic value={published} version={publishedVersion} title="Current live Pixel Logic for this CRM list" />
      {ruleMessage && <p role="alert" className="text-xs text-red-700">{ruleMessage}</p>}
      <section className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-sm">Who is here right now?</h3>
          <span className="text-xs text-muted-foreground">Refreshes every 30 seconds</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border p-3"><strong>{presence?.cmsViewers ?? "—"}</strong><p className="text-xs text-muted-foreground">CMS viewers · this list</p></div>
          <div className="rounded-lg border p-3"><strong>{presence?.cmsWorking ?? "—"}</strong><p className="text-xs text-muted-foreground">CMS users allocating/exporting</p></div>
          <div className="rounded-lg border p-3"><strong>{presence?.mobileRecentlyConnectedTenantWide ?? "—"}</strong><p className="text-xs text-muted-foreground">Mobile employees active in last 10 min · entire tenant</p></div>
        </div>
        <p className="text-xs text-muted-foreground">CMS presence covers this server process only (90-second timeout); other servers are not included. Mobile count comes from existing device activity and does not mean phones are viewing this specific list.</p>
        {!!presence?.people.length && <p className="text-xs text-muted-foreground">CMS: {presence.people.map(p => `${p.name} (${p.mode})`).join(", ")}</p>}
      </section>
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Export & divide CRM leads</h3>
          <p className="text-xs text-muted-foreground mt-1">The current search, stage, lens and assignee filters apply to downloads. Distribution always targets unassigned leads within the other filters. Export and distribution require ALL_ACCESS.</p>
        </div>
        <button type="button" disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" onClick={() => void exportLeads()}>Download filtered leads (.csv)</button>
        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-medium">Allocate a segment of unassigned leads</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">From position (priority-sorted)<input className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" type="number" min={1} value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label className="text-xs">Number of leads<input className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" type="number" min={1} max={5000} value={count} onChange={e => setCount(e.target.value)} /></label>
          </div>
          <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
            {people.map(p => <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" key={p.id}>
              <input type="checkbox" checked={selectedPeople.includes(p.id)} onChange={e => setSelectedPeople(v => e.target.checked ? [...v, p.id] : v.filter(id => id !== p.id))} />
              <span>{p.name}{p.area ? ` · ${p.area}` : ""}</span>
            </label>)}
          </div>
          <button disabled={busy || !selectedPeople.length} type="button" className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" onClick={() => void planDistribution()}>Preview distribution — no changes</button>
          {preview && <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
            <strong>Proposed allocation, still uncommitted</strong>
            {preview.map(g => <p key={g.person.id}>{g.person.name}: {g.ids.length} leads</p>)}
            <button disabled={busy} type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" onClick={() => void applyDistribution()}>Confirm & assign to employees</button>
          </div>}
        </div>
        {status && <p role="status" className="rounded-lg border p-3 text-xs">{status}</p>}
      </section>
    </div>
  );
}
