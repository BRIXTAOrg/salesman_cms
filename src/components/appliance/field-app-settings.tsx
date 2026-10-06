"use client";

import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  MapPin,
  RotateCcw,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  checkFieldApp,
  inputSpec,
  normalizeFieldApp,
  type ConfigProblem,
  type FieldAppConfig,
} from "@/lib/field-app-contract";
import { FIELD_APP_TEMPLATES, type FieldAppTemplate } from "@/lib/field-app-templates";
import type { PlatformEntityField, PlatformEntityType } from "@/lib/platform-vnext-types";
import { cx, formatWhen } from "./client";
import {
  Field,
  inputClass,
  Modal,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

/*
 * BRIXTA_FIELD_APP_V1 — send a list to the field app.
 * BRIXTA_FIELD_APP_PUBLISH_V1 — changes go into a draft first; phones only
 * see what is published, and every publish is a version you can restore.
 */

type Summary = { steps: number; questions: number; conditional: number } | null;

type Draft = {
  config: FieldAppConfig;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  basedOnVersion: number;
};

type HistoryItem = {
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  note: string | null;
  enabled: boolean;
  summary: Summary;
};

type StoreView = {
  published: FieldAppConfig | null;
  publishedSummary: Summary;
  draft: Draft | null;
  history: HistoryItem[];
  problems: ConfigProblem[];
  clashes: Array<{ key: string; label: string; column: string; question: string }>;
};

const KEEP_CURRENT = "__current__";

export function fieldAppOf(entity: PlatformEntityType): Record<string, unknown> | null {
  const raw = entity.config?.["fieldApp"];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export function isInFieldApp(entity: PlatformEntityType) {
  const stored = fieldAppOf(entity);
  return Boolean(stored?.enabled && Array.isArray(stored.sections) && stored.sections.length > 0);
}

export function hasFieldAppDraft(entity: PlatformEntityType) {
  const raw = entity.config?.["fieldAppDraft"];
  return Boolean(raw && typeof raw === "object");
}

function guessField(fields: PlatformEntityField[], pattern: RegExp) {
  return fields.find((field) => pattern.test(`${field.key} ${field.label}`))?.key ?? null;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status}).`) as Error & {
      problems?: ConfigProblem[];
      code?: string;
    };
    error.problems = Array.isArray(body?.problems) ? body.problems : undefined;
    error.code = body?.code;
    throw error;
  }
  return body as T;
}

function fromTemplate(template: FieldAppTemplate, entityTitle: string): FieldAppConfig {
  return normalizeFieldApp(
    {
      enabled: true,
      template: template.key,
      stages: template.stages,
      sections: template.sections,
      followUpField: template.followUpField,
    },
    entityTitle,
  );
}

export default function FieldAppSettings({
  entity,
  onClose,
  onSaved,
}: {
  entity: PlatformEntityType;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const fields = useMemo(() => entity.fieldDefinitions ?? [], [entity.fieldDefinitions]);
  const textFields = fields.filter((field) => !["location_point", "media"].includes(field.dataType));
  const numberFields = fields.filter((field) => field.dataType === "number");
  const locationFields = fields.filter((field) => field.dataType === "location_point");
  const configuredDisplay =
    typeof entity.config?.["displayField"] === "string" ? (entity.config["displayField"] as string) : null;

  const [store, setStore] = useState<StoreView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [base, setBase] = useState<FieldAppConfig | null>(null);
  const [template, setTemplate] = useState<string>(KEEP_CURRENT);
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState(entity.title);
  const [titleField, setTitleField] = useState("");
  const [subtitleOne, setSubtitleOne] = useState("");
  const [subtitleTwo, setSubtitleTwo] = useState("");
  const [priorityField, setPriorityField] = useState("");
  const [locationField, setLocationField] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "draft" | "publish" | "discard" | `restore-${number}`>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<ConfigProblem[]>([]);
  const [published, setPublished] = useState<number | null>(null);

  const adopt = useCallback(
    (view: StoreView) => {
      setStore(view);
      const working = view.draft?.config ?? view.published;
      setBase(working);
      setTemplate(working ? KEEP_CURRENT : FIELD_APP_TEMPLATES[0].key);
      setEnabled(working?.enabled ?? true);
      setTitle(working?.title ?? entity.title);
      setTitleField(working?.titleField ?? configuredDisplay ?? textFields[0]?.key ?? "");
      setSubtitleOne(working?.subtitleFields[0] ?? "");
      setSubtitleTwo(working?.subtitleFields[1] ?? "");
      setPriorityField(working?.priorityField ?? guessField(numberFields, /priority|score|rank/i) ?? "");
      setLocationField(working?.locationField ?? locationFields[0]?.key ?? "");
      setServerProblems([]);
    },
    // Field lists come from the entity, which does not change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity.id],
  );

  useEffect(() => {
    let cancelled = false;
    call<StoreView>(`/api/platform/field-apps/${entity.id}`)
      .then((view) => {
        if (!cancelled) adopt(view);
      })
      .catch((failure) => {
        if (!cancelled) setLoadError(failure instanceof Error ? failure.message : "Could not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [entity.id, adopt]);

  const chosenTemplate = FIELD_APP_TEMPLATES.find((item) => item.key === template) ?? null;

  /** What would be saved or published right now. */
  const working = useMemo<FieldAppConfig | null>(() => {
    const steps =
      template === KEEP_CURRENT ? base : chosenTemplate ? fromTemplate(chosenTemplate, entity.title) : null;
    if (!steps) return null;
    const subtitleFields = [subtitleOne, subtitleTwo].filter(
      (value, index, all) => value && value !== titleField && all.indexOf(value) === index,
    );
    return normalizeFieldApp(
      {
        ...steps,
        enabled,
        title: title.trim() || entity.title,
        titleField: titleField || null,
        subtitleFields,
        priorityField: priorityField || null,
        locationField: locationField || null,
      },
      entity.title,
    );
  }, [
    template,
    base,
    chosenTemplate,
    entity.title,
    enabled,
    title,
    titleField,
    subtitleOne,
    subtitleTwo,
    priorityField,
    locationField,
  ]);

  const problems = useMemo(
    () => (working && working.enabled ? checkFieldApp(working) : []),
    [working],
  );
  const shownProblems = serverProblems.length ? serverProblems : problems;

  const counts = useMemo(() => {
    if (!working) return { questions: 0, conditional: 0 };
    const inputs = working.sections.flatMap((section) => section.fields).filter((field) => inputSpec(field.type).collects);
    return { questions: inputs.length, conditional: inputs.filter((field) => field.showWhen).length };
  }, [working]);

  async function saveDraft() {
    if (!working) return;
    setBusy("draft");
    setError(null);
    try {
      const view = await call<StoreView>(`/api/platform/field-apps/${entity.id}`, {
        method: "PUT",
        body: JSON.stringify({ config: working, revision: store?.draft?.revision }),
      });
      adopt(view);
      await onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the draft.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!working) return;
    setBusy("publish");
    setError(null);
    setServerProblems([]);
    try {
      const view = await call<StoreView & { publishedVersion: number }>(
        `/api/platform/field-apps/${entity.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "publish",
            config: working,
            revision: store?.draft?.revision,
            note: note.trim() || undefined,
          }),
        },
      );
      adopt(view);
      setNote("");
      setPublished(view.publishedVersion);
      await onSaved();
    } catch (failure) {
      const typed = failure as Error & { problems?: ConfigProblem[] };
      if (typed.problems?.length) setServerProblems(typed.problems);
      setError(typed.message || "Could not publish.");
    } finally {
      setBusy(null);
    }
  }

  async function discardDraft() {
    if (!window.confirm("Throw away the unpublished changes? Phones keep the published version.")) return;
    setBusy("discard");
    setError(null);
    try {
      const view = await call<StoreView>(`/api/platform/field-apps/${entity.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "discard" }),
      });
      adopt(view);
      await onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not discard.");
    } finally {
      setBusy(null);
    }
  }

  async function restore(version: number) {
    if (
      store?.draft &&
      !window.confirm(`Replace the current draft with version ${version}? Nothing changes on phones until you publish.`)
    ) {
      return;
    }
    setBusy(`restore-${version}`);
    setError(null);
    try {
      const view = await call<StoreView>(`/api/platform/field-apps/${entity.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "restore", version }),
      });
      adopt(view);
      await onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not restore.");
    } finally {
      setBusy(null);
    }
  }

  const live = store?.published ?? null;
  const draft = store?.draft ?? null;

  return (
    <Modal
      open
      wide
      title={`Field app · ${entity.title}`}
      description="Changes stay in a draft until you publish. Phones always use the published version."
      onClose={onClose}
    >
      {!store && !loadError && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {loadError && <div className="py-6 text-sm text-red-700">{loadError}</div>}

      {store && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="brixta-soft-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                On phones now
              </div>
              {live ? (
                <div className="mt-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">v{live.version}</span>
                    {live.enabled ? <Pill tone="good">Live</Pill> : <Pill>Hidden</Pill>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {store.publishedSummary?.steps ?? 0} steps · {store.publishedSummary?.questions ?? 0} questions
                    {live.publishedAt ? ` · ${formatWhen(live.publishedAt)}` : ""}
                    {live.publishedBy ? ` by ${live.publishedBy}` : ""}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">Not in the field app yet.</div>
              )}
            </div>
            <div className={cx("brixta-soft-card p-4", draft && "ring-1 ring-amber-500/30")}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Draft
                </div>
                {draft && (
                  <button
                    type="button"
                    onClick={() => void discardDraft()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Discard
                  </button>
                )}
              </div>
              {draft ? (
                <div className="mt-2 space-y-1">
                  <Pill tone="warning">Unpublished changes</Pill>
                  <div className="text-xs text-muted-foreground">
                    Saved {formatWhen(draft.updatedAt)}
                    {draft.updatedBy ? ` by ${draft.updatedBy}` : ""}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">No unpublished changes.</div>
              )}
            </div>
          </div>

          {published !== null && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Version {published} is live. Phones pick it up the next time they refresh.
            </div>
          )}

          <label className="brixta-soft-card flex items-center gap-3 p-4">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Show this list in the field app</span>
          </label>

          <div className="space-y-2">
            <span className="block text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
              What should the field team do?
            </span>
            <div className="grid gap-3 md:grid-cols-2">
              {base && (
                <button
                  type="button"
                  onClick={() => setTemplate(KEEP_CURRENT)}
                  className={cx(
                    "rounded-[14px] border p-4 text-left transition",
                    template === KEEP_CURRENT
                      ? "border-primary bg-primary/[0.08] ring-1 ring-primary/20"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-semibold">Keep the current steps</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {base.sections.length} steps already set up for this list.
                  </div>
                </button>
              )}
              {FIELD_APP_TEMPLATES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTemplate(item.key)}
                  className={cx(
                    "rounded-[14px] border p-4 text-left transition",
                    template === item.key
                      ? "border-primary bg-primary/[0.08] ring-1 ring-primary/20"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                </button>
              ))}
            </div>
            {template !== KEEP_CURRENT && base && (
              <div className="text-xs text-amber-700">
                Using a template replaces the current steps in the draft. Answers already collected stay on the records.
              </div>
            )}
          </div>

          {working && (
            <div className="flex flex-wrap items-center gap-2">
              {working.sections.map((section, index) => (
                <Pill key={section.key} tone="info">
                  {index + 1}. {section.title} ·{" "}
                  {section.fields.filter((field) => inputSpec(field.type).collects).length} questions
                </Pill>
              ))}
              {counts.conditional > 0 && (
                <span className="text-xs text-muted-foreground">
                  {counts.conditional} shown only when needed
                </span>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name in the app">
              <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Card title" hint="The main line on each card.">
              <select className={inputClass} value={titleField} onChange={(event) => setTitleField(event.target.value)}>
                <option value="">Record ID</option>
                {textFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Under the title">
              <select className={inputClass} value={subtitleOne} onChange={(event) => setSubtitleOne(event.target.value)}>
                <option value="">Nothing</option>
                {textFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </Field>
            <Field label="And">
              <select className={inputClass} value={subtitleTwo} onChange={(event) => setSubtitleTwo(event.target.value)}>
                <option value="">Nothing</option>
                {textFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority" hint="Higher numbers come first when distance is unknown.">
              <select className={inputClass} value={priorityField} onChange={(event) => setPriorityField(event.target.value)}>
                <option value="">None</option>
                {numberFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Map location" hint="Used for distance, nearest-first and navigation.">
              <select className={inputClass} value={locationField} onChange={(event) => setLocationField(event.target.value)}>
                <option value="">None</option>
                {locationFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {!locationField && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Without a location the app sorts by priority and can't show distance.
            </div>
          )}

          {shownProblems.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Fix before publishing
              </div>
              <ul className="list-disc space-y-0.5 pl-6 text-xs text-amber-900">
                {shownProblems.slice(0, 8).map((problem, index) => (
                  <li key={`${problem.path}-${index}`}>{problem.message}</li>
                ))}
              </ul>
            </div>
          )}

          {store.clashes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Heads-up: {store.clashes.map((clash) => clash.label).join(", ")}{" "}
              {store.clashes.length === 1 ? "uses a column" : "use columns"} that already hold a different kind of data.
            </div>
          )}

          {store.history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.02em]">
                <History className="h-3.5 w-3.5" /> Versions
              </div>
              <div className="divide-y rounded-xl border">
                {store.history.map((item) => (
                  <div key={item.version} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-10 font-semibold">v{item.version}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {item.note ? `${item.note} · ` : ""}
                      {item.summary?.steps ?? 0} steps · {item.summary?.questions ?? 0} questions
                      {item.publishedAt ? ` · ${formatWhen(item.publishedAt)}` : ""}
                      {item.publishedBy ? ` by ${item.publishedBy}` : ""}
                      {!item.enabled ? " · hidden" : ""}
                    </span>
                    {live?.version === item.version ? (
                      <Pill tone="good">Live</Pill>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void restore(item.version)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        {busy === `restore-${item.version}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Restore to draft
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="What changed? (optional)" hint="Shown in the version list.">
            <input
              className={inputClass}
              value={note}
              maxLength={200}
              placeholder="e.g. Added customer signature to Order"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error && <div className="text-sm text-red-700">{error}</div>}

          <div className="flex flex-wrap justify-end gap-3">
            <SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>
            <SecondaryButton type="button" disabled={busy !== null || !working} onClick={() => void saveDraft()}>
              {busy === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save draft
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={busy !== null || !working || problems.length > 0}
              onClick={() => void publish()}
            >
              {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              {enabled ? "Publish to phones" : "Publish (hidden)"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
