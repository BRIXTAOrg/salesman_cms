"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ClipboardList, Download, MapPin, Plus, RefreshCw,
  Route, Save, Search, Trash2, Users,
} from "lucide-react";
import { pjpKm, pjpNearest, pjpValidPoint, type PjpPosition } from "@/lib/pjp-geometry";
import { PageIntro, Panel, Pill, PrimaryButton, SecondaryButton, inputClass } from "./primitives";

const PjpMap = dynamic(() => import("./pjp-map"), { ssr: false });

type Person = { id: number; name: string; code?: string | null; area?: string | null };
type ListItem = { id: number; title: string; key: string };
type Site = {
  id: string;
  key: string | null;
  title: string;
  stage: string;
  stageLabel: string;
  priority: number | null;
  location: PjpPosition | null;
  assignee: { userId: number; name: string } | null;
};
type CRMResponse = {
  success: boolean;
  error?: string;
  lists: ListItem[];
  list: ListItem | null;
  rows: Site[];
  total: number;
};
type PjpStop = {
  id: string;
  type: "site" | "task";
  title: string;
  location: PjpPosition | null;
  note?: string;
  externalKey?: string | null;
};
type BrowserDraft = { origin: PjpPosition | null; stops: PjpStop[]; updatedAt: string };

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function safeCsv(value: unknown): string {
  const str = String(value ?? "");
  const safe = /^[\s]*[=+@\-\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}

function openRoadRoute(origin: PjpPosition, stops: PjpStop[]) {
  const coords = stops.map((s) => s.location).filter(pjpValidPoint).slice(0, 8);
  if (!coords.length) return;
  const from = `${origin.lat},${origin.lng}`;
  const last = coords[coords.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: from,
    destination: `${last.lat},${last.lng}`,
    travelmode: "driving",
  });
  if (coords.length > 1) {
    params.set("waypoints", coords.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join("|"));
  }
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

export default function PjpPlanner({ home = false }: { home?: boolean }) {
  const [employees, setEmployees] = useState<Person[]>([]);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [listId, setListId] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState<PjpPosition | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [pickStart, setPickStart] = useState(false);
  const [radius, setRadius] = useState(15);
  const [maxStops, setMaxStops] = useState(8);
  const [stageFilter, setStageFilter] = useState("new");
  const [search, setSearch] = useState("");
  const [stops, setStops] = useState<PjpStop[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [taskLat, setTaskLat] = useState("");
  const [taskLng, setTaskLng] = useState("");
  const [draftLoaded, setDraftLoaded] = useState("");
  const [publishedRevision, setPublishedRevision] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const loadPeople = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/field-records/people", { cache: "no-store" });
      const data = await response.json() as { people?: Person[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Cannot load field employees.");
      setEmployees(data.people ?? []);
      setEmployeeId((previous) => previous || String(data.people?.[0]?.id ?? ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load employees.");
    }
  }, []);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ export: "1", sort: "priority" });
      if (listId) params.set("list", listId);
      const response = await fetch(`/api/platform/field-records?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as CRMResponse;
      if (!response.ok || !data.success) throw new Error(data.error ?? "Unable to read CRM records.");
      setLists(data.lists ?? []);
      setSites(data.rows ?? []);
      setListId((current) => current || String(data.list?.id ?? ""));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cannot load published CRM lists.");
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { void loadPeople(); }, [loadPeople]);
  useEffect(() => { void loadSites(); }, [loadSites]);

  // Browser-only drafts are NOT team assignments. This key isolates the user/date/list.
  const draftKey = employeeId && listId && date ? `brixta:pjp-draft:v1:${employeeId}:${listId}:${date}` : "";
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      const parsed = raw ? JSON.parse(raw) as BrowserDraft : null;
      const next = parsed?.origin && pjpValidPoint(parsed.origin) ? parsed.origin : null;
      setOrigin(next);
      setLat(next ? String(next.lat) : "");
      setLng(next ? String(next.lng) : "");
      setStops(Array.isArray(parsed?.stops) ? parsed.stops.filter((stop) => stop.type === "site" || stop.type === "task").slice(0, 30) : []);
    } catch {
      setOrigin(null); setLat(""); setLng(""); setStops([]);
    }
    setDraftLoaded(draftKey);
  }, [draftKey]);

  // Server source of truth: browser draft is never a published assignment.
  useEffect(() => {
    if (!employeeId || !date) return;
    let cancelled = false;
    const params = new URLSearchParams({ employeeId, date });
    void fetch(`/api/platform/pjp?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { success: boolean; error?: string; revision: number; plan?: { publishedAt?: string } };
        if (!response.ok) throw new Error(body.error || "Cannot retrieve published PJP.");
        if (cancelled) return;
        setPublishedRevision(body.revision ?? 0);
        setPublishedAt(body.plan?.publishedAt ?? null);
      })
      .catch((err) => { if (!cancelled) setMessage(err instanceof Error ? err.message : "Failed to check published PJP."); });
    return () => { cancelled = true; };
  }, [employeeId, date]);

  async function publishPlan() {
    if (!origin || !employeeId || !listId || !stops.length || publishing || draftLoaded !== draftKey) {
      setMessage("Choose an employee, CRM list, start point and at least one stop."); return;
    }
    if (!window.confirm(`Publish this ${date} itinerary to ${selectedEmployee?.name ?? "the employee"}'s mobile Home?\n\n${stops.length} stops (sites and tasks). This replaces the previously published itinerary for that day, but never changes CRM records or their assignments.`)) return;
    setPublishing(true);
    try {
      const response = await fetch("/api/platform/pjp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: Number(employeeId), date, listId: Number(listId), origin, stops, expectedRevision: publishedRevision }),
      });
      const body = await response.json() as { success: boolean; error?: string; revision?: number; plan?: { publishedAt?: string } };
      if (!response.ok || !body.success) throw new Error(body.error ?? "PJP publication failed.");
      setPublishedRevision(body.revision ?? 0);
      setPublishedAt(body.plan?.publishedAt ?? null);
      setMessage(`Published PJP v${body.revision} to ${selectedEmployee?.name ?? "employee"}. It will appear on Home after a mobile refresh.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish PJP.");
    } finally { setPublishing(false); }
  }

  const chooseStart = useCallback((point: PjpPosition) => {
    if (!pjpValidPoint(point)) return;
    setOrigin(point);
    setLat(point.lat.toFixed(6));
    setLng(point.lng.toFixed(6));
    setPickStart(false);
  }, []);

  const mapSites = useMemo(() => sites.filter((site) => pjpValidPoint(site.location)), [sites]);
  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return mapSites.filter((site) => {
      if (stageFilter !== "all" && site.stage !== stageFilter) return false;
      if (origin && site.location && pjpKm(origin, site.location) > radius) return false;
      if (needle && !`${site.title} ${site.key ?? ""} ${site.stageLabel}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => {
      if (origin && a.location && b.location) return pjpKm(origin, a.location) - pjpKm(origin, b.location);
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }, [mapSites, origin, radius, stageFilter, search]);

  const routeStops = useMemo(() => stops.filter((stop) => pjpValidPoint(stop.location)), [stops]);
  const selectedEmployee = employees.find((person) => String(person.id) === employeeId);
  const chosenList = lists.find((list) => String(list.id) === listId);
  const invalidLocations = sites.length - mapSites.length;

  function addSite(site: Site) {
    if (!pjpValidPoint(site.location)) return;
    const id = `site:${site.id}`;
    setStops((current) => current.some((item) => item.id === id) || current.length >= 30
      ? current : [...current, { id, type: "site", title: site.title, externalKey: site.key, location: site.location }]);
  }

  function generate() {
    if (!origin) { setMessage("Choose a starting location first."); return; }
    const candidates = filtered.filter((site): site is Site & { location: PjpPosition } => pjpValidPoint(site.location));
    const ordered = pjpNearest(origin, candidates.slice(0, 80)).slice(0, maxStops);
    setStops((current) => [
      ...ordered.map((site) => ({ id: `site:${site.id}`, type: "site" as const, title: site.title, externalKey: site.key, location: site.location })),
      ...current.filter((stop) => stop.type === "task"),
    ].slice(0, 30));
    setMessage(`Draft route contains ${ordered.length} CRM sites plus your tasks. Nothing has been assigned to employees.`);
  }

  function addTask() {
    const title = taskTitle.trim();
    if (!title) { setMessage("Enter a task description first."); return; }
    if (stops.length >= 30) { setMessage("This draft supports at most 30 items."); return; }
    const location = taskLat.trim() || taskLng.trim()
      ? { lat: Number(taskLat), lng: Number(taskLng) } : null;
    if (location && !pjpValidPoint(location)) { setMessage("Task coordinates are invalid. Use both latitude and longitude."); return; }
    setStops((current) => [...current, { id: `task:${crypto.randomUUID()}`, type: "task", title, note: taskNote.trim(), location }]);
    setTaskTitle(""); setTaskNote(""); setTaskLat(""); setTaskLng(""); setMessage("");
  }

  function move(index: number, delta: number) {
    setStops((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function saveDraft() {
    if (!draftKey || draftLoaded !== draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ origin, stops, updatedAt: new Date().toISOString() } satisfies BrowserDraft));
      setMessage("Browser draft saved on this device. NOT dispatched to the employee or synchronized to the server.");
    } catch {
      setMessage("Browser storage is unavailable. Download the itinerary before leaving.");
    }
  }

  function downloadCsv() {
    const rows = [
      ["BRIXTA PJP DRAFT", "not dispatched"],
      ["Employee", selectedEmployee?.name ?? ""], ["Date", date], ["CRM list", chosenList?.title ?? ""],
      ["Start latitude", origin?.lat ?? ""], ["Start longitude", origin?.lng ?? ""], [],
      ["Order", "Type", "Title", "CRM reference", "Latitude", "Longitude", "Notes"],
      ...stops.map((stop, i) => [i + 1, stop.type, stop.title, stop.externalKey ?? "", stop.location?.lat ?? "", stop.location?.lng ?? "", stop.note ?? ""]),
    ];
    const csv = rows.map((row) => row.map(safeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `BRIXTA_PJP_DRAFT_${date}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6">
      <PageIntro
        title={home ? "Home · Journey planning" : "PJP · Journey planner"}
        description="Plan an employee's day from published CRM sites and other tasks. Preview stop order before dispatch."
        action={<SecondaryButton type="button" onClick={() => { void loadSites(); void loadPeople(); }}><RefreshCw className="h-4 w-4" />Refresh CRM</SecondaryButton>}
      />
      <Panel className="flex flex-wrap items-center gap-3 py-3 text-xs">
        <Pill tone="info">{publishedRevision ? `Published v${publishedRevision}` : "Planning draft"}</Pill>
        <span className="text-muted-foreground">CRM data is read-only here. Use Publish PJP to send this itinerary to the employee's Home. Browser drafts remain device-local.</span>
        {home && <Link href="/dashboard/workspace/assignments" className="ml-auto font-semibold text-primary">Open full planner</Link>}
      </Panel>
      {message && <Panel className="border-primary/20 py-3 text-sm">{message}</Panel>}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel className="space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />Plan for</div>
            <label className="block text-xs text-muted-foreground">Employee</label>
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {!employees.length && <option value="">No mobile employees available</option>}
              {employees.map((item) => <option key={item.id} value={item.id}>{item.name}{item.area ? ` · ${item.area}` : ""}</option>)}
            </select>
            <label className="block text-xs text-muted-foreground">Journey date</label>
            <input aria-label="PJP date" className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="block text-xs text-muted-foreground">Published CRM list</label>
            <select className={inputClass} value={listId} onChange={(e) => { setListId(e.target.value); setStops([]); }}>
              {!lists.length && <option value="">No published CRM lists</option>}
              {lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
            </select>
            <div className="text-xs text-muted-foreground">{loading ? "Loading…" : `${sites.length.toLocaleString()} live CRM records · ${mapSites.length.toLocaleString()} mapped · ${invalidLocations} missing coordinates`}</div>
          </Panel>
          <Panel className="space-y-3">
            <div className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" />Starting location</div>
            <p className="text-xs text-muted-foreground">Choose a home/office point manually or click the map. No employee's actual location is tracked.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Latitude<input className={`${inputClass} mt-1`} type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="26.14" /></label>
              <label className="text-xs">Longitude<input className={`${inputClass} mt-1`} type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="91.73" /></label>
            </div>
            <div className="flex gap-2">
              <SecondaryButton type="button" onClick={() => {const p={lat:Number(lat),lng:Number(lng)}; if (lat.trim() && lng.trim() && pjpValidPoint(p)) chooseStart(p); else setMessage("Enter valid latitude and longitude.");}}>Set starting point</SecondaryButton>
              <SecondaryButton type="button" onClick={() => setPickStart((prev) => !prev)}>{pickStart ? "Cancel map pick" : "Pick on map"}</SecondaryButton>
            </div>
          </Panel>
          <Panel className="space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Route className="h-4 w-4" />Plan site visits</div>
            <label className="text-xs">Current stage</label>
            <select className={inputClass} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="new">Not visited</option><option value="verified">Verified stage</option><option value="all">All stages</option>
            </select>
            <label className="text-xs">Radius: {radius} km (straight-line)</label>
            <input aria-label="Site radius" className="w-full accent-primary" type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            <label className="text-xs">Maximum CRM stops</label>
            <input aria-label="Maximum stops" type="number" min={1} max={20} className={inputClass} value={maxStops} onChange={(e) => setMaxStops(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
            <PrimaryButton type="button" onClick={generate} disabled={!origin || loading}><Route className="h-4 w-4" />Generate draft route</PrimaryButton>
            <p className="text-xs text-muted-foreground">Prioritizes nearby sites by straight-line distance, not live traffic. You can add and reorder stops manually.</p>
          </Panel>
        </div>
        <div className="space-y-4 min-w-0">
          <PjpMap origin={origin} stops={routeStops.map((stop) => ({ id: stop.id, title: stop.title, type: stop.type, location: stop.location! }))} pickStart={pickStart} onPickStart={chooseStart} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel className="space-y-3">
              <div className="flex items-center gap-2 font-semibold"><Search className="h-4 w-4" />Nearby CRM sites ({filtered.length})</div>
              <input className={inputClass} aria-label="Search CRM sites" placeholder="Find a site ID or name" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-[310px] space-y-2 overflow-y-auto">
                {filtered.slice(0, 60).map((site) => (
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-2" key={site.id}>
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{site.title}</div><div className="truncate text-xs text-muted-foreground">{site.stageLabel}{origin && site.location ? ` · ${pjpKm(origin, site.location).toFixed(1)} km air` : ""}</div></div>
                    <button type="button" aria-label={`Add ${site.title} to draft`} disabled={stops.some((stop) => stop.id === `site:${site.id}`) || stops.length >= 30} className="rounded-lg border p-2 disabled:opacity-40" onClick={() => addSite(site)}><Plus className="h-4 w-4" /></button>
                  </div>
                ))}
                {!filtered.length && <p className="text-sm text-muted-foreground">No sites match this stage, search and radius. Widen the radius or select all stages.</p>}
              </div>
            </Panel>
            <Panel className="space-y-3">
              <div className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" />Add a task</div>
              <p className="text-xs text-muted-foreground">For meetings, collections, follow-ups or office work. Tasks without coordinates remain in the checklist, not on the map.</p>
              <input className={inputClass} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Meet dealer at Six Mile" aria-label="Task title" maxLength={120} />
              <textarea className={`${inputClass} min-h-20`} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} placeholder="Optional instructions" aria-label="Task instructions" maxLength={600} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} type="number" step="any" value={taskLat} onChange={(e) => setTaskLat(e.target.value)} placeholder="Latitude (optional)" aria-label="Task latitude" />
                <input className={inputClass} type="number" step="any" value={taskLng} onChange={(e) => setTaskLng(e.target.value)} placeholder="Longitude (optional)" aria-label="Task longitude" />
              </div>
              <SecondaryButton type="button" onClick={addTask}><Plus className="h-4 w-4" />Add task to plan</SecondaryButton>
            </Panel>
          </div>
        </div>
      </div>

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-lg font-semibold">Journey itinerary · {date}</div><div className="text-xs text-muted-foreground">{publishedAt ? `Latest published: ${new Date(publishedAt).toLocaleString("en-IN")}` : "Not published to mobile yet"}</div><div className="text-xs text-muted-foreground">{stops.filter((s) => s.type === "site").length} site stops · {stops.filter((s) => s.type === "task").length} tasks · {routeStops.length} mappable stops</div></div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={saveDraft} disabled={!draftKey || draftLoaded !== draftKey}><Save className="h-4 w-4" />Save browser draft</SecondaryButton>
            <PrimaryButton type="button" onClick={() => void publishPlan()} disabled={publishing || !employeeId || !origin || !stops.length || draftLoaded !== draftKey}>{publishing ? "Publishing..." : "Publish PJP to mobile Home"}</PrimaryButton>
            <SecondaryButton type="button" onClick={downloadCsv} disabled={!stops.length}><Download className="h-4 w-4" />Export itinerary CSV</SecondaryButton>
            <PrimaryButton type="button" disabled={!origin || routeStops.length === 0} onClick={() => origin && openRoadRoute(origin, routeStops)}><MapPin className="h-4 w-4" />Open road directions</PrimaryButton>
          </div>
        </div>
        {routeStops.length > 8 && <p className="text-xs text-amber-700">Google Maps opens the first 8 mapped stops only. Export CSV for the complete itinerary.</p>}
        {!stops.length ? <p className="rounded-lg bg-muted/30 p-5 text-sm text-muted-foreground">Choose a start point and generate a route, add individual CRM sites, or create standalone tasks.</p> : (
          <div className="divide-y rounded-xl border">
            {stops.map((stop, index) => (
              <div key={stop.id} className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{index + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{stop.title}</div><div className="text-xs text-muted-foreground">{stop.type === "site" ? `CRM site · ${stop.externalKey ?? ""}` : `Task${stop.note ? ` · ${stop.note}` : ""}`}{!stop.location ? " · No map location" : ""}</div></div>
                <div className="flex gap-1">
                  <button type="button" aria-label="Move stop up" className="rounded-md border p-2 disabled:opacity-30" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Move stop down" className="rounded-md border p-2 disabled:opacity-30" onClick={() => move(index, 1)} disabled={index === stops.length - 1}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label="Remove stop" className="rounded-md border p-2" onClick={() => setStops((current) => current.filter((s) => s.id !== stop.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">PJP publication sends this itinerary to the selected employee’s Home. Site verification, CRM assignments and historical answers remain untouched. Task completion is audited separately. The displayed route order uses air distance, not traffic-aware road optimization.</p>
      </Panel>
    </div>
  );
}
