"use client";

import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  CirclePlay,
  Eye,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Employee, Responsibility, Role } from "@/lib/appliance-types";
import type { PlatformDataSource, ResponsibilityExtensionConfig } from "@/lib/platform-vnext-types";
import type {
  KernelAction,
  KernelCapture,
  KernelOutput,
  KernelPossibility,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import {
  ACTION_CATALOG,
  CAPTURE_CATALOG,
  OUTPUT_CATALOG,
  STARTER_TEMPLATES,
  blankResponsibilityKernel,
} from "@/lib/responsibility-kernel-catalog";
import {
  compileKernelToBaseDefinition,
  hydrateKernelFromBaseDefinition,
} from "@/lib/responsibility-kernel-compiler";
import { validateResponsibilityKernel } from "@/lib/responsibility-kernel-validation";
import { RESPONSIBILITY_KERNEL_METADATA_KEY } from "@/lib/responsibility-kernel-types";

import ResponsibilityAppBuilder from "./responsibility-app-builder";
import ResponsibilityEventEditor from "./responsibility-event-editor";
import ResponsibilityOutputEditor from "./responsibility-output-editor";
import ResponsibilityWorldEditor from "./responsibility-world-editor";
import { apiJson, cx } from "./client";
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

type ExtensionResponse = {
  responsibility: { id: number; key: string; title: string; config: Record<string, unknown> };
  extension: {
    responsibilityId: number;
    draftConfig: ResponsibilityExtensionConfig;
    publishedConfig: ResponsibilityExtensionConfig;
    publishedVersion: number;
    compiledHash?: string | null;
    publishedAt?: string | null;
  };
};

type StudioTab = "app" | "world" | "possibilities" | "events" | "output" | "review";

const tabs: Array<{
  key: StudioTab;
  label: string;
  description: string;
  icon: typeof Blocks;
}> = [
  { key: "app", label: "APP BUILDER", description: "Drag, click, configure, play", icon: Blocks },
  { key: "world", label: "WORLD", description: "Actors + objects + context + state", icon: Workflow },
  { key: "possibilities", label: "POSSIBILITIES", description: "What can happen right now", icon: Sparkles },
  { key: "events", label: "EVENTS & RULES", description: "What happens next", icon: GitBranch },
  { key: "output", label: "OUTPUT", description: "Who sees what", icon: Eye },
  { key: "review", label: "RUN & REVIEW", description: "Validate, compile, publish", icon: CirclePlay },
];

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asKernel(
  config: ResponsibilityExtensionConfig,
  responsibility?: Responsibility | null,
): ResponsibilityKernel {
  const metadata = config.metadata && typeof config.metadata === "object" ? config.metadata : {};
  const candidate = metadata[RESPONSIBILITY_KERNEL_METADATA_KEY];
  if (
    candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    (candidate as { kernelVersion?: unknown }).kernelVersion === 3
  ) {
    return candidate as ResponsibilityKernel;
  }
  if (responsibility?.definition) {
    return hydrateKernelFromBaseDefinition(responsibility.definition, responsibility.title);
  }
  return blankResponsibilityKernel();
}

function withKernel(
  config: ResponsibilityExtensionConfig,
  kernel: ResponsibilityKernel,
): ResponsibilityExtensionConfig {
  return {
    ...config,
    metadata: {
      ...(config.metadata ?? {}),
      [RESPONSIBILITY_KERNEL_METADATA_KEY]: kernel,
    },
  };
}

function possibilityLabel(item: KernelPossibility) {
  return item.type === "capture" ? item.capture.label : item.type === "action" ? item.action.label : item.output.label;
}

function possibilityKind(item: KernelPossibility) {
  return item.type === "capture" ? item.capture.kind : item.type === "action" ? item.action.kind : item.output.kind;
}

function PossibilitiesEditor({
  kernel,
  onChange,
  goBuilder,
  goOutput,
}: {
  kernel: ResponsibilityKernel;
  onChange: (kernel: ResponsibilityKernel) => void;
  goBuilder: () => void;
  goOutput: () => void;
}) {
  const captures = kernel.possibilities.filter((item) => item.type === "capture");
  const actions = kernel.possibilities.filter((item) => item.type === "action");
  const outputs = kernel.possibilities.filter((item) => item.type === "output");

  function addCapture(kind: KernelCapture["kind"]) {
    const catalog = CAPTURE_CATALOG.find((item) => item.kind === kind);
    const captureId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const capture: KernelCapture = {
      id: captureId,
      label: catalog?.label ?? humanize(kind),
      kind,
      required: false,
      storeAs: normalizeKey(catalog?.label ?? kind),
      config: kind === "choice" ? { options: ["Option 1", "Option 2"] } : {},
    };
    onChange({
      ...kernel,
      possibilities: [...kernel.possibilities, { id: possibilityId, type: "capture", capture }],
      metadata: {
        ...kernel.metadata,
        ui: {
          ...(kernel.metadata.ui ?? { layout: [] }),
          layout: [...(kernel.metadata.ui?.layout ?? []), possibilityId],
        },
      },
    });
  }

  function addAction(kind: KernelAction["kind"]) {
    const catalog = ACTION_CATALOG.find((item) => item.kind === kind);
    const actionId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    onChange({
      ...kernel,
      possibilities: [
        ...kernel.possibilities,
        {
          id: possibilityId,
          type: "action",
          action: {
            id: actionId,
            label: catalog?.label ?? humanize(kind),
            kind,
            actorId: kernel.runtimeWorld.actors[0]?.id,
            objectId: kernel.runtimeWorld.objects[0]?.id,
            captureIds: [],
            config: {},
          },
        },
      ],
      metadata: {
        ...kernel.metadata,
        ui: {
          ...(kernel.metadata.ui ?? { layout: [] }),
          layout: [...(kernel.metadata.ui?.layout ?? []), possibilityId],
        },
      },
    });
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="max-w-4xl">
          <div className="text-lg font-semibold">Possibilities</div>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
            This is not a second builder. These are the exact same IDs created on the phone canvas. Use this view to audit the operational meaning: what can be captured, what actions exist, and what outputs can appear.
          </div>
        </div>
      </Panel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Panel>
          <div className="flex items-center justify-between gap-2">
            <div><div className="font-semibold">Capture / ask</div><div className="text-xs text-muted-foreground">Data entering the Responsibility</div></div>
            <select className={`${inputClass} w-auto max-w-[150px]`} value="" onChange={(event) => { if (event.target.value) addCapture(event.target.value as KernelCapture["kind"]); event.target.value = ""; }}>
              <option value="">+ Add...</option>
              {CAPTURE_CATALOG.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {captures.map((item) => item.type === "capture" && (
              <button key={item.id} type="button" onClick={goBuilder} className="w-full rounded-lg border p-3 text-left hover:bg-muted/30">
                <div className="font-medium">{item.capture.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{humanize(item.capture.kind)} · stores {item.capture.storeAs || "not configured"}{item.capture.required ? " · required" : ""}</div>
              </button>
            ))}
            {captures.length === 0 && <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No captures yet.</div>}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-2">
            <div><div className="font-semibold">Actions</div><div className="text-xs text-muted-foreground">Things actors can do</div></div>
            <select className={`${inputClass} w-auto max-w-[150px]`} value="" onChange={(event) => { if (event.target.value) addAction(event.target.value as KernelAction["kind"]); event.target.value = ""; }}>
              <option value="">+ Add...</option>
              {ACTION_CATALOG.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {actions.map((item) => item.type === "action" && (
              <button key={item.id} type="button" onClick={goBuilder} className="w-full rounded-lg border p-3 text-left hover:bg-muted/30">
                <div className="font-medium">{item.action.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {humanize(item.action.kind)} · {kernel.runtimeWorld.actors.find((actor) => actor.id === item.action.actorId)?.label ?? "no actor"} · collects {item.action.captureIds.length}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {typeof item.action.config.availableState === "string" && item.action.config.availableState && <Pill>when {String(item.action.config.availableState)}</Pill>}
                  {typeof item.action.config.resultingState === "string" && item.action.config.resultingState && <Pill>→ {String(item.action.config.resultingState)}</Pill>}
                </div>
              </button>
            ))}
            {actions.length === 0 && <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No actions yet.</div>}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-2">
            <div><div className="font-semibold">Output / show</div><div className="text-xs text-muted-foreground">What leaves/is presented</div></div>
            <button type="button" className="text-xs text-primary" onClick={goOutput}>Edit outputs →</button>
          </div>
          <div className="mt-4 space-y-2">
            {outputs.map((item) => item.type === "output" && (
              <button key={item.id} type="button" onClick={goOutput} className="w-full rounded-lg border p-3 text-left hover:bg-muted/30">
                <div className="font-medium">{item.output.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{humanize(item.output.kind)} · {item.output.actorIds.length || "no"} audience(s) · {item.output.visibleKeys.length} visible fields</div>
              </button>
            ))}
            {outputs.length === 0 && <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No output views yet.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function ResponsibilityKernelClient() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [responsibilityId, setResponsibilityId] = useState<number | null>(null);
  const [extension, setExtension] = useState<ResponsibilityExtensionConfig | null>(null);
  const [kernel, setKernel] = useState<ResponsibilityKernel>(blankResponsibilityKernel());
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dataSources, setDataSources] = useState<PlatformDataSource[]>([]);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<StudioTab>("app");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStarter, setNewStarter] = useState("blank");

  const selectedResponsibility = useMemo(
    () => responsibilities.find((item) => item.id === responsibilityId) ?? null,
    [responsibilities, responsibilityId],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [responsibilityBody, roleBody, employeeBody, sourceBody] = await Promise.all([
        apiJson<{ responsibilities: Responsibility[] }>("/api/appliance/responsibilities"),
        apiJson<{ roles: Role[] }>("/api/appliance/roles"),
        apiJson<{ employees: Employee[] }>("/api/appliance/employees"),
        apiJson<{ dataSources: PlatformDataSource[] }>("/api/platform/data-sources"),
      ]);
      const active = (responsibilityBody.responsibilities ?? []).filter((item) => item.isActive !== false);
      setResponsibilities(active);
      setRoles(roleBody.roles ?? []);
      setEmployees(employeeBody.employees ?? []);
      setDataSources(sourceBody.dataSources ?? []);
      setResponsibilityId((current) => current && active.some((item) => item.id === current) ? current : active[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Responsibility Studio.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number, knownResponsibilities?: Responsibility[]) => {
    setLoading(true);
    try {
      const body = await apiJson<ExtensionResponse>(`/api/platform/responsibility-extensions/${id}`);
      const list = knownResponsibilities ?? responsibilities;
      const responsibility = list.find((item) => item.id === id) ?? null;
      setExtension(body.extension.draftConfig);
      setKernel(asKernel(body.extension.draftConfig, responsibility));
      setPublishedVersion(body.extension.publishedVersion ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Responsibility definition.");
    } finally {
      setLoading(false);
    }
  }, [responsibilities]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => { if (responsibilityId) void loadDetail(responsibilityId); }, [responsibilityId, loadDetail]);

  async function saveDraft(silent = false) {
    if (!responsibilityId || !extension) throw new Error("Choose a Responsibility first.");
    setSaving(true);
    try {
      const nextExtension = withKernel(extension, kernel);

      // Save Draft only persists the Kernel draft. It deliberately does NOT
      // update mobile_capabilities.config, so unfinished changes never leak
      // to employee devices. Publish performs the atomic Kernel -> app compile.
      await apiJson(`/api/platform/responsibility-extensions/${responsibilityId}`, {
        method: "PUT",
        body: JSON.stringify({ config: nextExtension }),
      });

      setExtension(nextExtension);
      if (!silent) setMessage("Draft saved privately. Employee devices stay on the last published version until you Publish.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!responsibilityId) return;
    const issues = validateResponsibilityKernel(kernel);
    if (issues.some((issue) => issue.severity === "error")) {
      setMessage("Publish blocked: fix the red Run & Review items first.");
      setActiveTab("review");
      return;
    }
    setPublishing(true);
    try {
      await saveDraft(true);
      const body = await apiJson<{ version?: number; message?: string; issues?: unknown[] }>(
        `/api/platform/responsibility-extensions/${responsibilityId}/publish`,
        { method: "POST" },
      );
      setPublishedVersion(body.version ?? publishedVersion + 1);
      setMessage(body.message ?? "Published. The compiled Responsibility is ready for runtime delivery.");
      const refreshed = await apiJson<{ responsibilities: Responsibility[] }>("/api/appliance/responsibilities");
      setResponsibilities((refreshed.responsibilities ?? []).filter((item) => item.isActive !== false));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish Responsibility.");
    } finally {
      setPublishing(false);
    }
  }

  async function createResponsibility() {
    const title = newTitle.trim();
    if (!title) {
      setMessage("Give the Responsibility a name.");
      return;
    }
    const template = STARTER_TEMPLATES.find((item) => item.key === newStarter) ?? STARTER_TEMPLATES[0];
    const nextKernel = template.create();
    nextKernel.metadata.ui = {
      ...(nextKernel.metadata.ui ?? { layout: [] }),
      title,
      description: newDescription.trim() || nextKernel.metadata.ui?.description,
    };
    const key = normalizeKey(title);
    setSaving(true);
    try {
      await apiJson("/api/appliance/responsibilities", {
        method: "POST",
        body: JSON.stringify({
          key,
          title,
          description: newDescription.trim() || null,
          icon: "blocks",
          config: compileKernelToBaseDefinition(nextKernel),
        }),
      });
      const list = await apiJson<{ responsibilities: Responsibility[] }>("/api/appliance/responsibilities");
      const active = (list.responsibilities ?? []).filter((item) => item.isActive !== false);
      setResponsibilities(active);
      const created = [...active].reverse().find((item) => item.key === key || item.title === title);
      if (!created) throw new Error("Responsibility created, but could not resolve its new id. Refresh and select it.");
      const detail = await apiJson<ExtensionResponse>(`/api/platform/responsibility-extensions/${created.id}`);
      const nextExtension = withKernel(detail.extension.draftConfig, nextKernel);
      await apiJson(`/api/platform/responsibility-extensions/${created.id}`, {
        method: "PUT",
        body: JSON.stringify({ config: nextExtension }),
      });
      setResponsibilityId(created.id);
      setExtension(nextExtension);
      setKernel(nextKernel);
      setPublishedVersion(0);
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewStarter("blank");
      setActiveTab("app");
      setMessage(`“${title}” created. Build the phone app, click blocks to configure them, then Play.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Responsibility.");
    } finally {
      setSaving(false);
    }
  }

  const validation = useMemo(() => validateResponsibilityKernel(kernel), [kernel]);
  const compiled = useMemo(() => compileKernelToBaseDefinition(kernel), [kernel]);

  if (loading && responsibilities.length === 0 && !createOpen) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="min-w-0 space-y-5 pb-8">
      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="text-xl font-semibold">Responsibility Studio</div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Build the employee app first. Every block is the same Kernel node used by World, Possibilities, Events, Output and Publish. No disconnected “form vs power” definitions.
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {responsibilities.length > 0 && (
              <Field label="Responsibility">
                <select className={`${inputClass} min-w-[250px]`} value={responsibilityId ?? ""} onChange={(event) => setResponsibilityId(Number(event.target.value))}>
                  {responsibilities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </Field>
            )}
            <SecondaryButton type="button" onClick={() => setCreateOpen((value) => !value)}><Plus className="h-4 w-4" /> New</SecondaryButton>
            <SecondaryButton type="button" disabled={!responsibilityId || loading} onClick={() => responsibilityId && void loadDetail(responsibilityId)}><RefreshCw className="h-4 w-4" /> Reload</SecondaryButton>
            <PrimaryButton type="button" disabled={!responsibilityId || saving} onClick={() => void saveDraft()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</PrimaryButton>
          </div>
        </div>
        {message && <div className="mt-4 rounded-lg border bg-muted/20 px-3 py-2 text-sm">{message}</div>}
      </Panel>

      {createOpen && (
        <Panel>
          <div className="text-lg font-semibold">Create Responsibility</div>
          <div className="mt-1 text-sm text-muted-foreground">Name it, choose an editable starter, then build the real phone experience.</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Responsibility name"><input className={inputClass} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Leave Request / Daily Attendance / Dealer Visit" /></Field>
            <Field label="Starter"><select className={inputClass} value={newStarter} onChange={(event) => setNewStarter(event.target.value)}>{STARTER_TEMPLATES.map((item) => <option key={item.key} value={item.key}>{item.label} — {item.description}</option>)}</select></Field>
            <Field label="What is this for?"><textarea className={textareaClass} rows={2} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} /></Field>
          </div>
          <div className="mt-4 flex justify-end"><PrimaryButton type="button" disabled={saving} onClick={() => void createResponsibility()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create & open builder</PrimaryButton></div>
        </Panel>
      )}

      {!selectedResponsibility && responsibilities.length === 0 ? (
        <EmptyState title="Create your first Responsibility" description="Use New above. Start from a template or Blank." />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cx(
                    "min-w-0 rounded-lg border p-3 text-left transition hover:bg-muted/30",
                    activeTab === tab.key && "border-primary bg-primary/[0.05] ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{tab.label}</span></div>
                  <div className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">{tab.description}</div>
                </button>
              );
            })}
          </div>

          {activeTab === "app" && <ResponsibilityAppBuilder kernel={kernel} dataSources={dataSources} onChange={setKernel} />}
          {activeTab === "world" && <ResponsibilityWorldEditor kernel={kernel} roles={roles} employees={employees} onChange={setKernel} />}
          {activeTab === "possibilities" && <PossibilitiesEditor kernel={kernel} onChange={setKernel} goBuilder={() => setActiveTab("app")} goOutput={() => setActiveTab("output")} />}
          {activeTab === "events" && <ResponsibilityEventEditor kernel={kernel} onChange={setKernel} />}
          {activeTab === "output" && <ResponsibilityOutputEditor kernel={kernel} onChange={setKernel} />}

          {activeTab === "review" && (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">Run & Review</div>
                    <div className="mt-1 text-sm text-muted-foreground">Nothing should surprise you at Publish. This checks the connections before the app receives the compiled contract.</div>
                  </div>
                  <Pill tone={validation.some((issue) => issue.severity === "error") ? "neutral" : "good"}>
                    {validation.filter((issue) => issue.severity === "error").length} errors
                  </Pill>
                </div>
                <div className="mt-5 space-y-2">
                  {validation.map((issue) => (
                    <div key={`${issue.code}-${issue.target ?? "root"}`} className={cx("flex items-start gap-3 rounded-lg border p-3", issue.severity === "error" && "border-destructive/40", issue.severity === "good" && "border-emerald-500/30")}>
                      {issue.severity === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : issue.severity === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div><div className="text-sm">{issue.message}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{issue.code}</div></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <SecondaryButton type="button" disabled={saving} onClick={() => void saveDraft()}><Save className="h-4 w-4" /> Save draft</SecondaryButton>
                  <PrimaryButton type="button" disabled={publishing || validation.some((issue) => issue.severity === "error")} onClick={() => void publish()}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Publish v{publishedVersion + 1}
                  </PrimaryButton>
                </div>
              </Panel>

              <Panel>
                <div className="font-semibold">What Publish sends</div>
                <div className="mt-1 text-xs text-muted-foreground">Compatibility app contract generated from the same Kernel. Debug only—admins do not edit this JSON.</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Visible fields</div><div className="mt-1 text-xl font-semibold">{compiled.input.fields.filter((field) => field.config.hidden !== true).length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">App actions</div><div className="mt-1 text-xl font-semibold">{compiled.app?.actions.length ?? 0}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Output</div><div className="mt-1 font-medium">{compiled.output.renderer}</div></div>
                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Developer contract</summary>
                    <pre className="mt-3 max-h-[420px] overflow-auto text-[10px] leading-relaxed">{JSON.stringify({ kernel, compiledBaseDefinition: compiled }, null, 2)}</pre>
                  </details>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
