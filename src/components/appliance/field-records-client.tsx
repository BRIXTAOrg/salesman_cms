"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiJson, cx } from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  inputClass,
} from "./primitives";

// BRIXTA_FIELD_APP_V1 — operations view of a field list (Sites, ...):
// lifecycle at a glance, filters, bulk assignment, and each record's story.

type Tone = "neutral" | "info" | "good" | "warning" | "danger";

type Stage = { key: string; label: string; tone: Tone; closed: boolean };

type Row = {
  id: string;
  key: string | null;
  title: string;
  subtitle: string[];
  priority: number | null;
  location: { lat: number; lng: number } | null;
  stage: string;
  stageLabel: string;
  stageTone: Tone;
  assignee: { userId: number; name: string } | null;
  values: Record<string, string>;
  lastVisitAt: string | null;
  lastVisitBy: string | null;
  followUpAt: string | null;
  updatedAt: string | null;
};

type ListResponse = {
  lists: Array<{ id: number; key: string; title: string }>;
  list: {
    id: number;
    key: string;
    title: string;
    stages: Stage[];
    tableFields: Array<{ key: string; label: string }>;
    hasLocation: boolean;
    hasPriority: boolean;
  } | null;
  rows: Row[];
  total: number;
  listTotal?: number;
  page?: number;
  pageSize?: number;
  stageCounts?: Record<string, number>;
  unassigned?: number;
};

type Person = { id: number; name: string; code: string | null; area: string | null };

type Detail = {
  id: string;
  key: string | null;
  listTitle: string;
  title: string;
  subtitle: string[];
  stage: string;
  stageLabel: string;
  stageTone: Tone;
  assignee: { userId: number; name: string; at: string; byName: string | null } | null;
  followUpAt: string | null;
  mapUrl: string | null;
  steps: Array<{
    key: string;
    title: string;
    done: { at: string; by: string | null } | null;
    answers: Array<{ key: string; label: string; type: string; value: string; photos: string[] }>;
  }>;
  info: Array<{ label: string; value: string }>;
  timeline: Array<{ id: string; at: string; kind: string; title: string; detail: string; by: string | null }>;
};

function when(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 1) return "just now";
  if (minutes >= 0 && minutes < 60) return `${minutes} min ago`;
  if (minutes >= 0 && minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function day(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function FieldRecordsClient() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [listId, setListId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sort, setSort] = useState<"priority" | "updated">("priority");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAllInfo, setShowAllInfo] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (listId) params.set("list", String(listId));
      if (search) params.set("q", search);
      if (stage) params.set("stage", stage);
      if (assignee) params.set("assignee", assignee);
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", "50");
      const body = await apiJson<ListResponse>(`/api/platform/field-records?${params.toString()}`);
      setData(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [listId, search, stage, assignee, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiJson<{ people: Person[] }>("/api/platform/field-records/people")
      .then((body) => setPeople(body.people ?? []))
      .catch(() => setPeople([]));
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setOpenId(id);
    setDetailLoading(true);
    setShowAllInfo(false);
    try {
      const body = await apiJson<{ record: Detail }>(`/api/platform/field-records/${id}`);
      setDetail(body.record);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open the record.");
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function assign(ids: string[], userId: number | null) {
    if (ids.length === 0) return;
    setAssigning(true);
    try {
      const body = await apiJson<{ updated: number }>("/api/platform/field-records/assign", {
        method: "POST",
        body: JSON.stringify({ ids, userId }),
      });
      const person = people.find((item) => item.id === userId);
      setMessage(
        userId
          ? `${body.updated.toLocaleString("en-IN")} assigned to ${person?.name ?? "the executive"}.`
          : `${body.updated.toLocaleString("en-IN")} unassigned.`,
      );
      setSelected(new Set());
      await load();
      if (openId && ids.includes(openId)) await openDetail(openId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not assign.");
    } finally {
      setAssigning(false);
    }
  }

  const rows = data?.rows ?? [];
  const list = data?.list ?? null;
  const pageSize = data?.pageSize ?? 50;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const allOnPage = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const stageStrip = useMemo(() => {
    if (!list) return [];
    return list.stages.map((item) => ({ ...item, count: data?.stageCounts?.[item.key] ?? 0 }));
  }, [list, data]);

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPage) rows.forEach((row) => next.delete(row.id));
      else rows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  if (!loading && data && !list) {
    return (
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
        <PageIntro eyebrow="Field work" title="Field work" />
        <EmptyState
          title="No list is in the field app yet"
          description="Import a file in Responsibilities → ENTITIES, then press “Send to field app” on that list."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Field work"
        title={list?.title ?? "Field work"}
        description="Everything the field team has done on this list. Tick rows to assign them to an executive."
        action={
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Panel className="flex items-center justify-between gap-3 py-3">
          <div className="text-sm">{message}</div>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </Panel>
      )}

      {data && data.lists.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.lists.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setListId(item.id);
                setStage("");
                setPage(1);
                setSelected(new Set());
              }}
              className={cx(
                "h-10 rounded-full border px-4 text-sm font-medium transition",
                item.id === list?.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted/60",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}

      {list && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setStage("");
              setPage(1);
            }}
            className={cx(
              "brixta-soft-card min-w-[120px] px-4 py-3 text-left transition",
              stage === "" && "ring-2 ring-primary",
            )}
          >
            <div className="text-2xl font-semibold tracking-[-0.02em]">
              {(data?.listTotal ?? 0).toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">All</div>
          </button>
          {stageStrip.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setStage(stage === item.key ? "" : item.key);
                setPage(1);
              }}
              className={cx(
                "brixta-soft-card min-w-[120px] px-4 py-3 text-left transition",
                stage === item.key && "ring-2 ring-primary",
                item.count === 0 && "opacity-60",
              )}
            >
              <div className="text-2xl font-semibold tracking-[-0.02em]">{item.count.toLocaleString("en-IN")}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">{item.label}</div>
            </button>
          ))}
        </div>
      )}

      <Panel className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cx(inputClass, "pl-9")}
            placeholder="Search by ID, name or executive"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Assigned to"
          className={cx(inputClass, "lg:w-56")}
          value={assignee}
          onChange={(event) => {
            setAssignee(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Everyone</option>
          <option value="none">Unassigned ({(data?.unassigned ?? 0).toLocaleString("en-IN")})</option>
          {people.map((person) => (
            <option key={person.id} value={String(person.id)}>{person.name}</option>
          ))}
        </select>
        <select
          aria-label="Sort"
          className={cx(inputClass, "lg:w-52")}
          value={sort}
          onChange={(event) => setSort(event.target.value === "updated" ? "updated" : "priority")}
        >
          <option value="priority">{list?.hasPriority ? "Highest priority" : "Name"}</option>
          <option value="updated">Recently updated</option>
        </select>
        <div className="whitespace-nowrap text-sm text-muted-foreground">
          {(data?.total ?? 0).toLocaleString("en-IN")} shown
        </div>
      </Panel>

      {selected.size > 0 && (
        <div className="brixta-soft-card sticky top-2 z-20 flex flex-wrap items-center gap-3 px-4 py-3">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{selected.size.toLocaleString("en-IN")} selected</span>
          <select
            aria-label="Assign to"
            className={cx(inputClass, "w-56")}
            value={assignTo}
            onChange={(event) => setAssignTo(event.target.value)}
          >
            <option value="">Assign to…</option>
            {people.map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.name}{person.area ? ` · ${person.area}` : ""}
              </option>
            ))}
          </select>
          <PrimaryButton
            type="button"
            disabled={!assignTo || assigning}
            onClick={() => void assign([...selected], Number(assignTo))}
          >
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Assign
          </PrimaryButton>
          <SecondaryButton type="button" disabled={assigning} onClick={() => void assign([...selected], null)}>
            Unassign
          </SecondaryButton>
          <button type="button" className="ml-auto text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <Panel className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select this page"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={allOnPage}
                    onChange={togglePage}
                  />
                </th>
                <th className="px-3 py-3 font-medium">{list?.title ?? "Record"}</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Assigned to</th>
                {list?.tableFields.map((field) => (
                  <th key={field.key} className="px-3 py-3 font-medium">{field.label}</th>
                ))}
                <th className="px-3 py-3 font-medium">Last update</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5 + (list?.tableFields.length ?? 0)} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5 + (list?.tableFields.length ?? 0)} className="px-4 py-12 text-center text-muted-foreground">
                    Nothing matches these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => void openDetail(row.id)}
                    className={cx(
                      "cursor-pointer border-b transition last:border-0 hover:bg-muted/30",
                      selected.has(row.id) && "bg-primary/[0.05]",
                      openId === row.id && "bg-primary/[0.08]",
                    )}
                  >
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.title}`}
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <div className="truncate font-medium">{row.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                        {row.priority !== null && <span className="font-mono">P{Math.round(row.priority)}</span>}
                        {row.subtitle.join(" · ")}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Pill tone={row.stageTone}>{row.stageLabel}</Pill>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.assignee ? row.assignee.name : <span className="text-muted-foreground">Unassigned</span>}
                    </td>
                    {list?.tableFields.map((field) => (
                      <td key={field.key} className="max-w-[220px] truncate px-3 py-3">
                        {field.key === "follow_up_date" && row.values[field.key]
                          ? day(row.values[field.key])
                          : row.values[field.key] || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {row.lastVisitAt ? `${when(row.lastVisitAt)}${row.lastVisitBy ? ` · ${row.lastVisitBy}` : ""}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <SecondaryButton type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </SecondaryButton>
            <SecondaryButton type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </SecondaryButton>
          </div>
        </div>
      </Panel>

      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/25"
            onClick={() => {
              setOpenId(null);
              setDetail(null);
            }}
          />
          <aside className="relative h-full w-full max-w-[500px] overflow-y-auto bg-card p-6 shadow-2xl">
            {detailLoading && !detail ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : detail ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
                      {detail.listTitle}
                    </div>
                    <h2 className="mt-1 break-words text-2xl font-bold tracking-[-0.02em]">{detail.title}</h2>
                    {detail.subtitle.length > 0 && (
                      <div className="mt-1 text-sm text-muted-foreground">{detail.subtitle.join(" · ")}</div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone={detail.stageTone}>{detail.stageLabel}</Pill>
                      {detail.followUpAt && (
                        <Pill tone="warning">
                          <Clock className="mr-1 h-3 w-3" />Follow-up {day(detail.followUpAt)}
                        </Pill>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setOpenId(null);
                      setDetail(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="brixta-soft-card space-y-3 p-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.02em]">Assigned to</div>
                  <div className="flex gap-2">
                    <select
                      aria-label="Assign this record"
                      className={inputClass}
                      value={detail.assignee ? String(detail.assignee.userId) : ""}
                      disabled={assigning}
                      onChange={(event) =>
                        void assign([detail.id], event.target.value ? Number(event.target.value) : null)
                      }
                    >
                      <option value="">Unassigned</option>
                      {people.map((person) => (
                        <option key={person.id} value={String(person.id)}>{person.name}</option>
                      ))}
                    </select>
                  </div>
                  {detail.assignee && (
                    <div className="text-xs text-muted-foreground">
                      Since {when(detail.assignee.at)}{detail.assignee.byName ? ` · by ${detail.assignee.byName}` : ""}
                    </div>
                  )}
                  {detail.mapUrl && (
                    <a
                      href={detail.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                    >
                      <MapPin className="h-4 w-4" />
                      Open in Google Maps
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <section className="space-y-3">
                  <div className="text-[12px] font-medium uppercase tracking-[0.02em]">Steps</div>
                  {detail.steps.map((step, index) => (
                    <div key={step.key} className="brixta-soft-card p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={cx(
                            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                            step.done ? "bg-emerald-600 text-white" : "border text-muted-foreground",
                          )}
                        >
                          {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{step.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {step.done ? `Done ${when(step.done.at)}${step.done.by ? ` · ${step.done.by}` : ""}` : "Not done yet"}
                          </div>
                        </div>
                      </div>
                      {step.answers.length > 0 && (
                        <dl className="mt-3 space-y-2 border-t pt-3">
                          {step.answers.map((answer) => (
                            <div key={answer.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-sm">
                              <dt className="text-muted-foreground">{answer.label}</dt>
                              <dd className="min-w-0 break-words">
                                {answer.photos.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {answer.photos.map((url) => (
                                      <a key={url} href={url} target="_blank" rel="noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={answer.label} className="h-16 w-16 rounded-lg object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                ) : answer.type === "date" ? day(answer.value) : answer.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  ))}
                </section>

                {detail.info.length > 0 && (
                  <section className="space-y-3">
                    <div className="text-[12px] font-medium uppercase tracking-[0.02em]">From the import</div>
                    <dl className="brixta-soft-card space-y-2 p-4">
                      {(showAllInfo ? detail.info : detail.info.slice(0, 8)).map((item) => (
                        <div key={item.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-sm">
                          <dt className="text-muted-foreground">{item.label}</dt>
                          <dd className="min-w-0 break-words">{item.value}</dd>
                        </div>
                      ))}
                      {detail.info.length > 8 && (
                        <button
                          type="button"
                          className="pt-1 text-sm font-medium text-primary"
                          onClick={() => setShowAllInfo((value) => !value)}
                        >
                          {showAllInfo ? "Show less" : `Show all ${detail.info.length}`}
                        </button>
                      )}
                    </dl>
                  </section>
                )}

                <section className="space-y-3">
                  <div className="text-[12px] font-medium uppercase tracking-[0.02em]">Timeline</div>
                  {detail.timeline.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nothing has happened yet.</div>
                  ) : (
                    <ol className="space-y-4 border-l pl-5">
                      {detail.timeline.map((item, index) => (
                        <li key={item.id} className="relative">
                          <span
                            className={cx(
                              "absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary",
                              index === 0 ? "bg-primary" : "bg-card",
                            )}
                          />
                          <div className="text-sm font-medium">{item.title}</div>
                          {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {when(item.at)}{item.by ? ` · ${item.by}` : ""}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
