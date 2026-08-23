"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Blocks,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wifi,
  WifiOff,
} from "lucide-react";

import type {
  Responsibility,
  Role,
} from "@/lib/appliance-types";
import type {
  ComputedField,
  EvidenceBundle,
  FieldBehaviorPolicy,
  FieldMemoryPolicy,
  GenericCondition,
  PlatformDataSource,
  QueryBinding,
  ReferenceBinding,
  ReferenceFilter,
  ResponsibilityAccess,
  ResponsibilityExtensionConfig,
  ResponsibilityFlowStep,
  ResponsibilityRuleDefinition,
  ResponsibilityValidationIssue,
  SmartBlock,
} from "@/lib/platform-vnext-types";
import {
  BUILT_IN_DATA_SOURCES,
  createBlankResponsibilityExtension,
  OUTPUT_RENDERERS,
  RESPONSIBILITY_MODES,
  SMART_BLOCK_CATALOG,
} from "@/lib/responsibility-power-catalog";
import {
  RESPONSIBILITY_TEMPLATES,
} from "@/lib/responsibility-power-templates";
import { apiJson, cx } from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

type StudioTab =
  | "smart"
  | "data"
  | "rules"
  | "flow"
  | "access"
  | "output"
  | "runtime"
  | "preview";

type ExtensionResponse = {
  responsibility: {
    id: number;
    key: string;
    title: string;
    config: Record<string, unknown>;
  };
  extension: {
    responsibilityId: number;
    draftConfig: ResponsibilityExtensionConfig;
    publishedConfig: ResponsibilityExtensionConfig;
    publishedVersion: number;
    compiledHash?: string | null;
    publishedAt?: string | null;
  };
};

type RuntimeResponse = {
  assignment: {
    directAssignedUsers: number;
    assignmentRules: number;
  };
  deviceSummary: {
    registered: number;
    online: number;
    offline: number;
    compatible: number;
    updated: number;
    pending: number;
  };
  devices: Array<{
    id: string;
    userId: number;
    userName: string;
    deviceId: string;
    platform: string;
    appVersion?: string | null;
    model?: string | null;
    osVersion?: string | null;
    lastSeenAt?: string | null;
    lastSyncAt?: string | null;
    online: boolean;
    reportedVersion: number;
    supportedManifestVersion: number;
    compatible: boolean;
    updated: boolean;
  }>;
  note?: string;
};

type VersionResponse = {
  versions: Array<{
    id: string;
    version: number;
    status: string;
    createdAt?: string | null;
    publishedAt?: string | null;
    createdByUserId?: number | null;
  }>;
};

type ValidateResponse = {
  valid: boolean;
  issues: ResponsibilityValidationIssue[];
};

const TAB_DEFS: Array<{
  key: StudioTab;
  label: string;
  description: string;
}> = [
  { key: "smart", label: "BUILD+", description: "Modes, smart blocks, memory and evidence" },
  { key: "data", label: "DATA", description: "Sources, references and dumb-simple queries" },
  { key: "rules", label: "RULES", description: "Prerequisites, conditions and derived values" },
  { key: "flow", label: "FLOW", description: "Who acts next and what state changes" },
  { key: "access", label: "ACCESS", description: "Role IDs and record visibility" },
  { key: "output", label: "OUTPUT", description: "Detail, table, timeline, gallery, map, metric" },
  { key: "runtime", label: "RUNTIME", description: "Offline, sync, versions and device rollout" },
  { key: "preview", label: "PREVIEW", description: "Preview as role and device" },
];

function randomKey(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function baseFields(responsibility: Responsibility | null) {
  return responsibility?.definition.input.fields ?? [];
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function issueTone(issue: ResponsibilityValidationIssue) {
  return issue.severity === "error" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5";
}

function roleAllowed(ids: number[], roleId?: number) {
  return ids.length === 0 || (roleId ? ids.includes(roleId) : true);
}

export default function ResponsibilityPowerClient() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [registeredSources, setRegisteredSources] = useState<PlatformDataSource[]>([]);
  const [responsibilityId, setResponsibilityId] = useState<number | null>(null);
  const [config, setConfig] = useState<ResponsibilityExtensionConfig>(
    createBlankResponsibilityExtension(),
  );
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [compiledHash, setCompiledHash] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(null);
  const [versions, setVersions] = useState<VersionResponse["versions"]>([]);
  const [issues, setIssues] = useState<ResponsibilityValidationIssue[]>([]);
  const [activeTab, setActiveTab] = useState<StudioTab>("smart");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateKey, setTemplateKey] = useState("expense_claim");

  const sources = useMemo(
    () => [
      ...BUILT_IN_DATA_SOURCES,
      ...registeredSources.filter(
        (source) =>
          !BUILT_IN_DATA_SOURCES.some(
            (builtin) => builtin.key === source.key,
          ),
      ),
    ],
    [registeredSources],
  );

  const selectedResponsibility = useMemo(
    () =>
      responsibilities.find((item) => item.id === responsibilityId) ?? null,
    [responsibilities, responsibilityId],
  );

  const fields = useMemo(
    () => baseFields(selectedResponsibility),
    [selectedResponsibility],
  );

  const outputKeys = useMemo(
    () => [
      ...fields.map((field) => field.key),
      ...config.references.map((item) => item.key),
      ...config.computedFields.map((item) => item.key),
      ...config.evidenceBundles.map((item) => item.key),
    ].filter(Boolean),
    [fields, config.references, config.computedFields, config.evidenceBundles],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [responsibilityBody, roleBody, sourceBody] = await Promise.all([
        apiJson<{ responsibilities: Responsibility[] }>(
          "/api/appliance/responsibilities",
        ),
        apiJson<{ roles: Role[] }>("/api/appliance/roles"),
        apiJson<{ dataSources: PlatformDataSource[] }>(
          "/api/platform/data-sources",
        ),
      ]);

      const active = (responsibilityBody.responsibilities ?? []).filter(
        (item) => item.isActive !== false,
      );
      setResponsibilities(active);
      setRoles(roleBody.roles ?? []);
      setRegisteredSources(
        (sourceBody.dataSources ?? []).filter((item) => item.isActive !== false),
      );
      setResponsibilityId((current) => {
        if (current && active.some((item) => item.id === current)) return current;
        return active[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibility Power Studio.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [body, versionBody, runtimeBody] = await Promise.all([
        apiJson<ExtensionResponse>(
          `/api/platform/responsibility-extensions/${id}`,
        ),
        apiJson<VersionResponse>(
          `/api/platform/responsibility-extensions/${id}/versions`,
        ).catch(() => ({ versions: [] })),
        apiJson<RuntimeResponse>(
          `/api/platform/responsibility-extensions/${id}/runtime`,
        ).catch(() => null),
      ]);

      setConfig(
        body.extension?.draftConfig ?? createBlankResponsibilityExtension(),
      );
      setPublishedVersion(body.extension?.publishedVersion ?? 0);
      setCompiledHash(body.extension?.compiledHash ?? null);
      setVersions(versionBody.versions ?? []);
      setRuntime(runtimeBody);
      setIssues([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibility definition.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (responsibilityId) void loadDetail(responsibilityId);
  }, [responsibilityId, loadDetail]);

  async function saveDraft(showMessage = true) {
    if (!responsibilityId) return false;

    setSaving(true);
    try {
      await apiJson(
        `/api/platform/responsibility-extensions/${responsibilityId}`,
        {
          method: "PUT",
          body: JSON.stringify({ config }),
        },
      );
      if (showMessage) setMessage("Responsibility power draft saved.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save draft.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function validateDraft() {
    if (!responsibilityId) return false;
    const saved = await saveDraft(false);
    if (!saved) return false;

    setSaving(true);
    try {
      const body = await apiJson<ValidateResponse>(
        `/api/platform/responsibility-extensions/${responsibilityId}/validate`,
        { method: "POST" },
      );
      setIssues(body.issues ?? []);
      setMessage(
        body.valid
          ? `Validation passed${body.issues.length ? " with warnings" : ""}.`
          : `Validation found ${body.issues.filter((issue) => issue.severity === "error").length} blocking issue(s).`,
      );
      return body.valid;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to validate draft.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!responsibilityId) return;
    const valid = await validateDraft();
    if (!valid) return;

    setSaving(true);
    try {
      const body = await apiJson<{
        version: number;
        manifestHash: string;
        issues?: ResponsibilityValidationIssue[];
      }>(
        `/api/platform/responsibility-extensions/${responsibilityId}/publish`,
        { method: "POST" },
      );

      setPublishedVersion(body.version);
      setCompiledHash(body.manifestHash);
      setIssues(body.issues ?? []);
      setMessage(
        `Published v${body.version}. Manifest v2 is ready for backend/app live execution.`,
      );
      await loadDetail(responsibilityId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to publish.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createFromTemplate(selectedTemplateKey: string) {
    const template = RESPONSIBILITY_TEMPLATES.find(
      (item) => item.key === selectedTemplateKey,
    );
    if (!template) return;

    setSaving(true);
    setMessage(null);
    try {
      const body = await apiJson<{
        responsibility: { id: number; key: string; title: string };
        setupNotes?: string[];
        message?: string;
      }>("/api/platform/responsibility-templates", {
        method: "POST",
        body: JSON.stringify({
          templateKey: selectedTemplateKey,
          title: templateTitle.trim() || template.base.title,
        }),
      });

      await loadBase();
      setResponsibilityId(body.responsibility.id);
      setTemplateTitle("");
      setMessage(
        body.setupNotes?.length
          ? `${body.message ?? "Template created."} ${body.setupNotes.join(" ")}`
          : body.message ?? "Template created.",
      );
      setActiveTab("smart");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create Responsibility from template.",
      );
    } finally {
      setSaving(false);
    }
  }

  function addSmartBlock(kind: SmartBlock["kind"]) {
    const catalog = SMART_BLOCK_CATALOG.find((item) => item.kind === kind);
    if (!catalog) return;

    const sourceKey =
      kind === "entity_reference" || kind === "responsibility_reference"
        ? registeredSources[0]?.key ?? ""
        : undefined;

    const block: SmartBlock = {
      key: randomKey(kind),
      label: catalog.label,
      kind,
      sourceKey,
      config: {},
    };

    setConfig((current) => ({
      ...current,
      smartBlocks: [...current.smartBlocks, block],
      session:
        kind === "session_tracker" ||
        kind === "route_tracking" ||
        kind === "distance_travelled" ||
        kind === "timer"
          ? { ...current.session, enabled: true }
          : current.session,
    }));
  }

  function addEvidence() {
    const bundle: EvidenceBundle = {
      key: randomKey("evidence"),
      label: "Evidence bundle",
      capture: {
        photo: true,
        location: true,
        timestamp: true,
        device: true,
      },
      required: ["photo", "location", "timestamp"],
    };
    setConfig((current) => ({
      ...current,
      evidenceBundles: [...current.evidenceBundles, bundle],
    }));
  }

  function addReference() {
    const reference: ReferenceBinding = {
      key: randomKey("reference"),
      label: "Select existing record",
      sourceKey: registeredSources[0]?.key ?? "",
      mode: "one",
      searchable: true,
      required: false,
      filter: [],
      offline: { enabled: true, maxRows: 500 },
    };
    setConfig((current) => ({
      ...current,
      references: [...current.references, reference],
    }));
  }

  function addQuery() {
    const query: QueryBinding = {
      key: randomKey("query"),
      label: "Latest record",
      sourceKey: registeredSources[0]?.key ?? "",
      mode: "latest",
      limit: 1,
      filter: [],
      selectFields: [],
    };
    setConfig((current) => ({
      ...current,
      queries: [...current.queries, query],
    }));
  }

  function addMemoryPolicy() {
    const field = fields[0];
    if (!field) return;
    const policy: FieldMemoryPolicy = {
      fieldKey: field.key,
      mode: "ttl",
      ttlSeconds: 30 * 24 * 60 * 60,
      confirmationMode: "confirm_or_change",
    };
    setConfig((current) => ({
      ...current,
      memoryPolicies: [...current.memoryPolicies, policy],
    }));
  }

  function addFieldBehavior() {
    const field = fields[0];
    if (!field) return;
    const policy: FieldBehaviorPolicy = {
      fieldKey: field.key,
      presentation: "normal",
    };
    setConfig((current) => ({
      ...current,
      fieldBehaviors: [...current.fieldBehaviors, policy],
    }));
  }

  function addComputedField() {
    const computed: ComputedField = {
      key: randomKey("computed"),
      label: "Computed value",
      operation: "sum",
      inputs: fields.slice(0, 2).map((field) => field.key),
      dataType: "number",
    };
    setConfig((current) => ({
      ...current,
      computedFields: [...current.computedFields, computed],
    }));
  }

  function addRule() {
    const firstField = fields[0];
    const condition: GenericCondition = {
      key: randomKey("condition"),
      left: firstField
        ? { kind: "field", fieldKey: firstField.key }
        : { kind: "context", contextKey: "session.current.status" },
      operator: "eq",
      right: "",
    };
    const rule: ResponsibilityRuleDefinition = {
      key: randomKey("rule"),
      label: "Before submit rule",
      phase: "before_submit",
      condition,
      effect: "block",
      message: "This action is not ready yet.",
    };
    setConfig((current) => ({
      ...current,
      rules: [...current.rules, rule],
    }));
  }

  function addFlowStep() {
    const step: ResponsibilityFlowStep = {
      key: randomKey("step"),
      label: "Review",
      actor: { kind: "role", roleId: roles[0]?.id },
      actionLabel: "Approve",
      successState: "approved",
      rejectState: "rejected",
      allowOffline: false,
    };
    setConfig((current) => ({
      ...current,
      flow: {
        ...current.flow,
        enabled: true,
        steps: [...current.flow.steps, step],
      },
    }));
  }

  function toggleAccess(
    key: keyof Pick<
      ResponsibilityAccess,
      | "useRoleIds"
      | "readRoleIds"
      | "createRoleIds"
      | "updateRoleIds"
      | "reviewRoleIds"
      | "viewOutputRoleIds"
    >,
    roleId: number,
  ) {
    setConfig((current) => {
      const ids = current.access[key];
      return {
        ...current,
        access: {
          ...current.access,
          [key]: ids.includes(roleId)
            ? ids.filter((id) => id !== roleId)
            : [...ids, roleId],
        },
      };
    });
  }

  function toggleOutputKey(key: string) {
    setConfig((current) => ({
      ...current,
      outputDesign: {
        ...current.outputDesign,
        visibleFieldKeys: current.outputDesign.visibleFieldKeys.includes(key)
          ? current.outputDesign.visibleFieldKeys.filter((item) => item !== key)
          : [...current.outputDesign.visibleFieldKeys, key],
      },
    }));
  }

  if (loading && responsibilities.length === 0) {
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
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Blocks className="h-5 w-5" />
              Dumb-simple starts
            </div>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              Pick what the job feels like. BRIXTA creates a draft composition of fields, smart blocks, data, rules, flow, output and runtime policy. You then change only what is unique to the company.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {RESPONSIBILITY_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                className="rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.03]"
                disabled={saving}
                onClick={() => void createFromTemplate(mode.templateKey)}
              >
                <div className="text-sm font-semibold">{mode.label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {mode.description}
                </div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Specific starter">
              <select
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
                className={inputClass}
              >
                {RESPONSIBILITY_TEMPLATES.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Optional custom name">
              <input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                className={inputClass}
                placeholder="Travel Expense Claim"
              />
            </Field>
            <PrimaryButton
              type="button"
              disabled={saving}
              onClick={() => void createFromTemplate(templateKey)}
            >
              <Plus className="h-4 w-4" />
              Create draft
            </PrimaryButton>
          </div>
        </div>
      </Panel>

      {responsibilities.length === 0 ? (
        <EmptyState
          title="Create the first Responsibility"
          description="Choose one of the modes above. Templates create metadata and records, not new PostgreSQL tables or schemas."
        />
      ) : (
        <>
          <Panel>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <Field label="Responsibility">
                <select
                  value={responsibilityId ?? ""}
                  onChange={(event) => setResponsibilityId(Number(event.target.value))}
                  className={inputClass}
                >
                  {responsibilities.map((responsibility) => (
                    <option key={responsibility.id} value={responsibility.id}>
                      {responsibility.title}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="info">{humanize(config.builderMode)}</Pill>
                <Pill tone="info">Published v{publishedVersion}</Pill>
                {compiledHash && (
                  <Pill tone="good">Manifest {compiledHash.slice(0, 8)}</Pill>
                )}
                <SecondaryButton
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDraft()}
                >
                  <Save className="h-4 w-4" />
                  Save draft
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={saving}
                  onClick={() => void validateDraft()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Validate
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  disabled={saving}
                  onClick={() => void publish()}
                >
                  <UploadCloud className="h-4 w-4" />
                  Publish
                </PrimaryButton>
              </div>
            </div>
          </Panel>

          {issues.length > 0 && (
            <div className="space-y-2">
              {issues.map((issue, index) => (
                <div
                  key={`${issue.code}-${index}`}
                  className={cx("rounded-lg border p-3 text-sm", issueTone(issue))}
                >
                  <div className="font-medium">
                    {issue.severity === "error" ? "Publish blocker" : "Warning"}: {issue.message}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {issue.path} · {issue.code}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border bg-card p-2">
            <div className="flex min-w-max gap-1">
              {TAB_DEFS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cx(
                    "rounded-lg px-3 py-2 text-left transition",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <div className="text-xs font-semibold">{tab.label}</div>
                  <div
                    className={cx(
                      "mt-0.5 text-[10px]",
                      activeTab === tab.key
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {tab.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {activeTab === "smart" && (
            <div className="space-y-6">
              <Panel>
                <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                  <Field label="Builder mode">
                    <select
                      value={config.builderMode}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          builderMode: event.target.value as ResponsibilityExtensionConfig["builderMode"],
                        }))
                      }
                      className={inputClass}
                    >
                      {RESPONSIBILITY_MODES.map((mode) => (
                        <option key={mode.key} value={mode.key}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div>
                    <div className="text-sm font-semibold">Smart blocks</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      These blocks capture or derive operational context without asking employees to type it manually.
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {SMART_BLOCK_CATALOG.map((block) => (
                    <button
                      key={block.kind}
                      type="button"
                      className="rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-primary/[0.03]"
                      onClick={() => addSmartBlock(block.kind)}
                    >
                      <div className="text-xs text-muted-foreground">{block.group}</div>
                      <div className="mt-1 text-sm font-semibold">{block.label}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{block.description}</div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Composition</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Added smart blocks become part of the published manifest, not new tables.
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {config.smartBlocks.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Add smart blocks above. Ordinary text/number/choice/photo fields are still designed in the BUILD canvas.
                    </div>
                  ) : (
                    config.smartBlocks.map((block, index) => (
                      <div key={block.key} className="rounded-lg border p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                          <Field label="Label">
                            <input
                              value={block.label}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  smartBlocks: current.smartBlocks.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: event.target.value } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Type">
                            <input value={humanize(block.kind)} readOnly className={`${inputClass} bg-muted/40`} />
                          </Field>
                          <SecondaryButton
                            type="button"
                            onClick={() =>
                              setConfig((current) => ({
                                ...current,
                                smartBlocks: current.smartBlocks.filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </SecondaryButton>
                        </div>

                        {(block.kind === "entity_reference" || block.kind === "responsibility_reference") && (
                          <div className="mt-3">
                            <Field label="Data Source">
                              <select
                                value={block.sourceKey ?? ""}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    smartBlocks: current.smartBlocks.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, sourceKey: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={inputClass}
                              >
                                <option value="">Choose source before publish</option>
                                {registeredSources.map((source) => (
                                  <option key={source.key} value={source.key}>{source.title}</option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center gap-2 font-semibold">
                  <Clock3 className="h-4 w-4" />
                  Session / route tracker
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  TA/DA-grade primitive: Start → route points → elapsed time → distance → stop → freeze evidence.
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={config.session.enabled}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, enabled: event.target.checked },
                        }))
                      }
                    />
                    Enable session tracker
                  </label>
                  <Field label="GPS every seconds">
                    <input
                      type="number"
                      min={1}
                      value={config.session.sampleEverySeconds}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, sampleEverySeconds: Number(event.target.value) },
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Or every meters">
                    <input
                      type="number"
                      min={0}
                      value={config.session.sampleEveryMeters}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, sampleEveryMeters: Number(event.target.value) },
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Max GPS error (m)">
                    <input
                      type="number"
                      min={1}
                      value={config.session.minimumAccuracyMeters}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, minimumAccuracyMeters: Number(event.target.value) },
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.session.allowOffline}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, allowOffline: event.target.checked },
                        }))
                      }
                    />
                    Record offline
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.session.freezeEvidenceOnStop}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, freezeEvidenceOnStop: event.target.checked },
                        }))
                      }
                    />
                    Freeze route evidence on stop
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.session.captureDevice}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          session: { ...current.session, captureDevice: event.target.checked },
                        }))
                      }
                    />
                    Capture device identity
                  </label>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <Camera className="h-4 w-4" />
                        Evidence bundles
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Capture multiple proof signals as one coherent evidence event.
                      </div>
                    </div>
                    <SecondaryButton type="button" onClick={addEvidence}>
                      <Plus className="h-4 w-4" /> Bundle
                    </SecondaryButton>
                  </div>
                  <div className="mt-4 space-y-3">
                    {config.evidenceBundles.map((bundle, index) => (
                      <div key={bundle.key} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            value={bundle.label}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                evidenceBundles: current.evidenceBundles.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label: event.target.value } : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          />
                          <SecondaryButton
                            type="button"
                            onClick={() =>
                              setConfig((current) => ({
                                ...current,
                                evidenceBundles: current.evidenceBundles.filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </SecondaryButton>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {(["photo", "location", "timestamp", "device", "signature", "audio", "file", "barcode", "qr"] as const).map((capture) => (
                            <label key={capture} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={bundle.capture[capture] === true}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    evidenceBundles: current.evidenceBundles.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            capture: { ...item.capture, [capture]: event.target.checked },
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                              {humanize(capture)}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {config.evidenceBundles.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No evidence bundle yet.</div>
                    )}
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Field behavior / memory</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ask every time, remember, confirm unchanged, hide/system-capture or make read-only.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <SecondaryButton type="button" onClick={addMemoryPolicy} disabled={fields.length === 0}>Memory</SecondaryButton>
                      <SecondaryButton type="button" onClick={addFieldBehavior} disabled={fields.length === 0}>Behavior</SecondaryButton>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {config.memoryPolicies.map((policy, index) => (
                      <div key={`${policy.fieldKey}-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
                        <Field label="Field">
                          <select
                            value={policy.fieldKey}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                memoryPolicies: current.memoryPolicies.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, fieldKey: event.target.value } : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          >
                            {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Memory">
                          <select
                            value={policy.mode}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                memoryPolicies: current.memoryPolicies.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, mode: event.target.value as FieldMemoryPolicy["mode"] } : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          >
                            <option value="every_time">Ask every time</option>
                            <option value="remember_forever">Remember forever</option>
                            <option value="ttl">Remember for N days</option>
                            <option value="until_changed">Until changed</option>
                            <option value="every_n_uses">Ask after N uses</option>
                          </select>
                        </Field>
                        <Field label={policy.mode === "every_n_uses" ? "N uses" : "TTL days"}>
                          <input
                            type="number"
                            min={1}
                            value={
                              policy.mode === "every_n_uses"
                                ? policy.everyNUses ?? 5
                                : Math.max(1, Math.round((policy.ttlSeconds ?? 2592000) / 86400))
                            }
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                memoryPolicies: current.memoryPolicies.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? policy.mode === "every_n_uses"
                                      ? { ...item, everyNUses: Number(event.target.value) }
                                      : { ...item, ttlSeconds: Number(event.target.value) * 86400 }
                                    : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-sm md:col-span-2">
                          <input
                            type="checkbox"
                            checked={policy.confirmationMode === "confirm_or_change"}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                memoryPolicies: current.memoryPolicies.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, confirmationMode: event.target.checked ? "confirm_or_change" : "silent_prefill" }
                                    : item,
                                ),
                              }))
                            }
                          />
                          Show “Still correct / Change”
                        </label>
                        <SecondaryButton
                          type="button"
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              memoryPolicies: current.memoryPolicies.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </SecondaryButton>
                      </div>
                    ))}

                    {config.fieldBehaviors.map((behavior, index) => (
                      <div key={`${behavior.fieldKey}-behavior-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <Field label="Field">
                          <select
                            value={behavior.fieldKey}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                fieldBehaviors: current.fieldBehaviors.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, fieldKey: event.target.value } : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          >
                            {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Presentation">
                          <select
                            value={behavior.presentation}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                fieldBehaviors: current.fieldBehaviors.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, presentation: event.target.value as FieldBehaviorPolicy["presentation"] }
                                    : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          >
                            <option value="normal">Normal</option>
                            <option value="hidden">Hidden</option>
                            <option value="read_only">Read only</option>
                            <option value="system_captured">System captured</option>
                          </select>
                        </Field>
                        <SecondaryButton
                          type="button"
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              fieldBehaviors: current.fieldBehaviors.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </SecondaryButton>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-6">
              <Panel>
                <div className="flex items-center gap-2 font-semibold">
                  <Database className="h-4 w-4" />
                  Available Data Sources
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Generic Entities, legacy tables, Responsibility records and built-in user/device/session context all look the same to the builder.
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {sources.map((source) => (
                    <div key={`${source.id}-${source.key}`} className="rounded-lg border p-3">
                      <div className="text-sm font-semibold">{source.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{source.key}</div>
                      <Pill tone="info">{source.sourceType}</Pill>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">References</div>
                      <div className="mt-1 text-xs text-muted-foreground">Select existing data; store IDs instead of duplicating fields.</div>
                    </div>
                    <SecondaryButton type="button" onClick={addReference}>
                      <Plus className="h-4 w-4" /> Reference
                    </SecondaryButton>
                  </div>

                  <div className="mt-4 space-y-3">
                    {config.references.map((reference, index) => (
                      <div key={reference.key} className="rounded-lg border p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Label">
                            <input
                              value={reference.label}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  references: current.references.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: event.target.value } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Source">
                            <select
                              value={reference.sourceKey}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  references: current.references.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, sourceKey: event.target.value } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                            >
                              <option value="">Choose source</option>
                              {sources.map((source) => <option key={source.key} value={source.key}>{source.title}</option>)}
                            </select>
                          </Field>
                          <Field label="Selection">
                            <select
                              value={reference.mode}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  references: current.references.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, mode: event.target.value as ReferenceBinding["mode"] } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                            >
                              <option value="one">One record</option>
                              <option value="many">Many records</option>
                            </select>
                          </Field>
                          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                            <input
                              type="checkbox"
                              checked={reference.offline?.enabled !== false}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  references: current.references.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, offline: { enabled: event.target.checked, maxRows: item.offline?.maxRows ?? 500 } }
                                      : item,
                                  ),
                                }))
                              }
                            />
                            Cache this reference offline
                          </label>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <SecondaryButton
                            type="button"
                            onClick={() =>
                              setConfig((current) => ({
                                ...current,
                                references: current.references.filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </SecondaryButton>
                        </div>
                      </div>
                    ))}
                    {config.references.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No references.</div>
                    )}
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Query Builder</div>
                      <div className="mt-1 text-xs text-muted-foreground">Get [Latest record] From [Source] Where [field] [operator] [value].</div>
                    </div>
                    <SecondaryButton type="button" onClick={addQuery}>
                      <Plus className="h-4 w-4" /> Query
                    </SecondaryButton>
                  </div>

                  <div className="mt-4 space-y-3">
                    {config.queries.map((query, index) => {
                      const filter = query.filter?.[0];
                      return (
                        <div key={query.key} className="rounded-lg border p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Name">
                              <input
                                value={query.label}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, label: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Get">
                              <select
                                value={query.mode}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, mode: event.target.value as QueryBinding["mode"] } : item,
                                    ),
                                  }))
                                }
                                className={inputClass}
                              >
                                <option value="latest">Latest record</option>
                                <option value="first">First record</option>
                                <option value="many">Many records</option>
                                <option value="count">Count</option>
                                <option value="sum">Sum</option>
                                <option value="average">Average</option>
                              </select>
                            </Field>
                            <Field label="From">
                              <select
                                value={query.sourceKey}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, sourceKey: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={inputClass}
                              >
                                <option value="">Choose source</option>
                                {sources.map((source) => <option key={source.key} value={source.key}>{source.title}</option>)}
                              </select>
                            </Field>
                            <Field label="Limit">
                              <input
                                type="number"
                                min={1}
                                value={query.limit ?? 1}
                                onChange={(event) =>
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, limit: Number(event.target.value) } : item,
                                    ),
                                  }))
                                }
                                className={inputClass}
                              />
                            </Field>
                          </div>

                          <div className="mt-3 rounded-lg bg-muted/30 p-3">
                            <div className="mb-2 text-xs font-semibold">WHERE (optional)</div>
                            <div className="grid gap-2 md:grid-cols-4">
                              <input
                                value={filter?.sourceField ?? ""}
                                onChange={(event) => {
                                  const next: ReferenceFilter = {
                                    sourceField: event.target.value,
                                    operator: filter?.operator ?? "eq",
                                    valueFrom: filter?.valueFrom ?? { kind: "literal", value: "" },
                                  };
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, filter: event.target.value ? [next] : [] } : item,
                                    ),
                                  }));
                                }}
                                className={inputClass}
                                placeholder="source field"
                              />
                              <select
                                value={filter?.operator ?? "eq"}
                                onChange={(event) => {
                                  if (!filter) return;
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, filter: [{ ...filter, operator: event.target.value as ReferenceFilter["operator"] }] } : item,
                                    ),
                                  }));
                                }}
                                className={inputClass}
                              >
                                <option value="eq">equals</option>
                                <option value="neq">not equal</option>
                                <option value="contains">contains</option>
                                <option value="gt">greater than</option>
                                <option value="gte">greater/equal</option>
                                <option value="lt">less than</option>
                                <option value="lte">less/equal</option>
                              </select>
                              <select
                                value={filter?.valueFrom.kind ?? "literal"}
                                onChange={(event) => {
                                  if (!filter) return;
                                  const kind = event.target.value as ReferenceFilter["valueFrom"]["kind"];
                                  const valueFrom =
                                    kind === "field"
                                      ? { kind, fieldKey: fields[0]?.key ?? "" }
                                      : kind === "context"
                                        ? { kind, contextKey: "context.current_user.id" }
                                        : kind === "query"
                                          ? { kind, queryKey: config.queries.find((_, itemIndex) => itemIndex !== index)?.key ?? "" }
                                          : { kind: "literal" as const, value: "" };
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, filter: [{ ...filter, valueFrom }] } : item,
                                    ),
                                  }));
                                }}
                                className={inputClass}
                              >
                                <option value="literal">literal value</option>
                                <option value="field">selected/form field</option>
                                <option value="context">user/device/session context</option>
                                <option value="query">another query result</option>
                              </select>
                              <input
                                value={
                                  !filter
                                    ? ""
                                    : filter.valueFrom.kind === "literal"
                                      ? String(filter.valueFrom.value ?? "")
                                      : filter.valueFrom.kind === "field"
                                        ? filter.valueFrom.fieldKey
                                        : filter.valueFrom.kind === "context"
                                          ? filter.valueFrom.contextKey
                                          : filter.valueFrom.queryKey
                                }
                                onChange={(event) => {
                                  if (!filter) return;
                                  const value = event.target.value;
                                  const valueFrom =
                                    filter.valueFrom.kind === "field"
                                      ? { kind: "field" as const, fieldKey: value }
                                      : filter.valueFrom.kind === "context"
                                        ? { kind: "context" as const, contextKey: value }
                                        : filter.valueFrom.kind === "query"
                                          ? { kind: "query" as const, queryKey: value }
                                          : { kind: "literal" as const, value };
                                  setConfig((current) => ({
                                    ...current,
                                    queries: current.queries.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, filter: [{ ...filter, valueFrom }] } : item,
                                    ),
                                  }));
                                }}
                                className={inputClass}
                                placeholder="value / key"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <SecondaryButton
                              type="button"
                              onClick={() =>
                                setConfig((current) => ({
                                  ...current,
                                  queries: current.queries.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </SecondaryButton>
                          </div>
                        </div>
                      );
                    })}
                    {config.queries.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No queries.</div>
                    )}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><BrainCircuit className="h-4 w-4" /> Derived values</div>
                    <div className="mt-1 text-xs text-muted-foreground">Distance = route.distance; Total = food + lodging + transport.</div>
                  </div>
                  <SecondaryButton type="button" onClick={addComputedField}><Plus className="h-4 w-4" /> Value</SecondaryButton>
                </div>
                <div className="mt-4 space-y-3">
                  {config.computedFields.map((computed, index) => (
                    <div key={computed.key} className="rounded-lg border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Label"><input value={computed.label} onChange={(event) => setConfig((current) => ({ ...current, computedFields: current.computedFields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value, key: normalizeKey(event.target.value) || item.key } : item) }))} className={inputClass} /></Field>
                        <Field label="Operation">
                          <select value={computed.operation} onChange={(event) => setConfig((current) => ({ ...current, computedFields: current.computedFields.map((item, itemIndex) => itemIndex === index ? { ...item, operation: event.target.value as ComputedField["operation"] } : item) }))} className={inputClass}>
                            <option value="sum">Sum</option><option value="average">Average</option><option value="count">Count</option><option value="multiply">Multiply</option><option value="divide">Divide</option><option value="subtract">Subtract</option><option value="distance_meters">Distance meters</option><option value="duration_seconds">Duration seconds</option><option value="days_since">Days since</option><option value="expression">Expression</option>
                          </select>
                        </Field>
                        <Field label="Inputs" hint="Comma-separated field/context/query keys."><input value={computed.inputs.join(", ")} onChange={(event) => setConfig((current) => ({ ...current, computedFields: current.computedFields.map((item, itemIndex) => itemIndex === index ? { ...item, inputs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : item) }))} className={inputClass} /></Field>
                        <Field label="Expression"><input value={computed.expression ?? ""} onChange={(event) => setConfig((current) => ({ ...current, computedFields: current.computedFields.map((item, itemIndex) => itemIndex === index ? { ...item, expression: event.target.value } : item) }))} className={inputClass} placeholder="route.distanceMeters / 1000" /></Field>
                      </div>
                      <div className="mt-3 flex justify-end"><SecondaryButton type="button" onClick={() => setConfig((current) => ({ ...current, computedFields: current.computedFields.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /> Remove</SecondaryButton></div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Rules / prerequisites</div>
                    <div className="mt-1 text-xs text-muted-foreground">Before submit: Attendance status = Completed. Total &gt; 2000 → receipt required.</div>
                  </div>
                  <SecondaryButton type="button" onClick={addRule}><Plus className="h-4 w-4" /> Rule</SecondaryButton>
                </div>
                <div className="mt-4 space-y-3">
                  {config.rules.map((rule, index) => (
                    <div key={rule.key} className="rounded-lg border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Rule name"><input value={rule.label} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} className={inputClass} /></Field>
                        <Field label="When"><select value={rule.phase} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, phase: event.target.value as ResponsibilityRuleDefinition["phase"] } : item) }))} className={inputClass}><option value="before_start">Before start</option><option value="before_submit">Before submit</option><option value="before_action">Before action</option><option value="after_submit">After submit</option></select></Field>
                        <Field label="Left source"><select value={rule.condition.left.kind} onChange={(event) => { const kind = event.target.value as GenericCondition["left"]["kind"]; setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, condition: { ...item.condition, left: kind === "field" ? { kind, fieldKey: fields[0]?.key ?? "" } : kind === "query" ? { kind, queryKey: config.queries[0]?.key ?? "" } : kind === "computed" ? { kind, computedKey: config.computedFields[0]?.key ?? "" } : { kind: "context", contextKey: "session.current.status" } } } : item) })) }} className={inputClass}><option value="field">Field</option><option value="context">Context</option><option value="query">Query</option><option value="computed">Computed</option></select></Field>
                        <Field label="Left key"><input value={rule.condition.left.kind === "field" ? rule.condition.left.fieldKey : rule.condition.left.kind === "query" ? rule.condition.left.queryKey : rule.condition.left.kind === "computed" ? rule.condition.left.computedKey : rule.condition.left.contextKey} onChange={(event) => { const value = event.target.value; setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, condition: { ...item.condition, left: item.condition.left.kind === "field" ? { kind: "field", fieldKey: value } : item.condition.left.kind === "query" ? { kind: "query", queryKey: value } : item.condition.left.kind === "computed" ? { kind: "computed", computedKey: value } : { kind: "context", contextKey: value } } } : item) })) }} className={inputClass} /></Field>
                        <Field label="Operator"><select value={rule.condition.operator} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, condition: { ...item.condition, operator: event.target.value as GenericCondition["operator"] } } : item) }))} className={inputClass}><option value="eq">equals</option><option value="neq">not equal</option><option value="gt">greater than</option><option value="gte">greater/equal</option><option value="lt">less than</option><option value="lte">less/equal</option><option value="exists">exists</option><option value="not_exists">does not exist</option><option value="contains">contains</option></select></Field>
                        <Field label="Right value"><input value={rule.condition.right == null ? "" : String(rule.condition.right)} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, condition: { ...item.condition, right: event.target.value } } : item) }))} className={inputClass} /></Field>
                        <Field label="Then"><select value={rule.effect} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, effect: event.target.value as ResponsibilityRuleDefinition["effect"] } : item) }))} className={inputClass}><option value="block">Block action</option><option value="warn">Warn</option><option value="require_field">Require field</option><option value="show_field">Show field</option><option value="hide_field">Hide field</option></select></Field>
                        <Field label="Target field"><select value={rule.targetFieldKey ?? ""} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, targetFieldKey: event.target.value || undefined } : item) }))} className={inputClass}><option value="">None</option>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></Field>
                      </div>
                      <div className="mt-3"><Field label="Message"><input value={rule.message ?? ""} onChange={(event) => setConfig((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, message: event.target.value } : item) }))} className={inputClass} /></Field></div>
                      <div className="mt-3 flex justify-end"><SecondaryButton type="button" onClick={() => setConfig((current) => ({ ...current, rules: current.rules.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /> Remove</SecondaryButton></div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "flow" && (
            <Panel>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">Workflow chain</div>
                  <div className="mt-1 text-xs text-muted-foreground">Employee → Manager/Role → Accounts/Role → Complete. Role actors store stable Role IDs.</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.flow.enabled} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, enabled: event.target.checked } }))} /> Enabled</label>
                  <SecondaryButton type="button" onClick={addFlowStep}><Plus className="h-4 w-4" /> Step</SecondaryButton>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {config.flow.steps.map((step, index) => (
                  <div key={step.key} className="relative rounded-xl border p-4">
                    {index > 0 && <div className="absolute -top-4 left-8 text-lg text-muted-foreground">↓</div>}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label={`Step ${index + 1}`}><input value={step.label} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) } }))} className={inputClass} /></Field>
                      <Field label="Actor"><select value={step.actor.kind} onChange={(event) => { const kind = event.target.value as ResponsibilityFlowStep["actor"]["kind"]; setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, actor: kind === "role" ? { kind, roleId: roles[0]?.id } : { kind } } : item) } })) }} className={inputClass}><option value="submitter">Submitter</option><option value="reports_to">Reporting manager</option><option value="role">Role</option><option value="specific_user">Specific user</option></select></Field>
                      {step.actor.kind === "role" ? (
                        <Field label="Role"><select value={step.actor.roleId ?? ""} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, actor: { kind: "role", roleId: Number(event.target.value) || undefined } } : item) } }))} className={inputClass}><option value="">Choose Role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></Field>
                      ) : <div />}
                      <Field label="Action"><input value={step.actionLabel} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, actionLabel: event.target.value } : item) } }))} className={inputClass} /></Field>
                      <Field label="Success state"><input value={step.successState} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, successState: normalizeKey(event.target.value) } : item) } }))} className={inputClass} /></Field>
                      <Field label="Reject state"><input value={step.rejectState ?? ""} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, rejectState: normalizeKey(event.target.value) || undefined } : item) } }))} className={inputClass} /></Field>
                      <label className="flex items-center gap-2 self-end rounded-lg border p-3 text-sm"><input type="checkbox" checked={step.allowOffline === true} onChange={(event) => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.map((item, itemIndex) => itemIndex === index ? { ...item, allowOffline: event.target.checked } : item) } }))} /> Allow offline</label>
                      <div className="flex items-end"><SecondaryButton type="button" onClick={() => setConfig((current) => ({ ...current, flow: { ...current.flow, steps: current.flow.steps.filter((_, itemIndex) => itemIndex !== index) } }))}><Trash2 className="h-4 w-4" /> Remove</SecondaryButton></div>
                    </div>
                  </div>
                ))}
                {config.flow.steps.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Add steps, or keep Flow disabled for a one-person Responsibility.</div>}
              </div>
            </Panel>
          )}

          {activeTab === "access" && (
            <Panel>
              <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Role access matrix</div>
              <div className="mt-1 text-xs text-muted-foreground">Empty role columns mean “let assignment/backend policy decide”. When set, Role IDs are authoritative even if names change.</div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Role</th><th className="p-2">Use</th><th className="p-2">See</th><th className="p-2">Create</th><th className="p-2">Edit</th><th className="p-2">Approve</th><th className="p-2">View output</th></tr></thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">{role.label}<div className="text-[10px] text-muted-foreground">ID {role.id}</div></td>
                        {(["useRoleIds", "readRoleIds", "createRoleIds", "updateRoleIds", "reviewRoleIds", "viewOutputRoleIds"] as const).map((field) => (
                          <td key={field} className="p-2"><input type="checkbox" checked={config.access[field].includes(role.id)} onChange={() => toggleAccess(field, role.id)} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 max-w-md"><Field label="Record visibility"><select value={config.access.recordVisibility} onChange={(event) => setConfig((current) => ({ ...current, access: { ...current.access, recordVisibility: event.target.value as ResponsibilityAccess["recordVisibility"] } }))} className={inputClass}><option value="creator">Creator only</option><option value="creator_and_manager">Creator + manager</option><option value="department">Department</option><option value="roles">Configured roles</option><option value="organization">Whole organization</option></select></Field></div>
            </Panel>
          )}

          {activeTab === "output" && (
            <Panel>
              <div className="font-semibold">Output designer</div>
              <div className="mt-1 text-xs text-muted-foreground">Choose how submitted records should make sense in office/mobile output surfaces.</div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {OUTPUT_RENDERERS.map((renderer) => (
                  <button key={renderer.key} type="button" onClick={() => setConfig((current) => ({ ...current, outputDesign: { ...current.outputDesign, renderer: renderer.key } }))} className={cx("rounded-lg border p-3 text-left", config.outputDesign.renderer === renderer.key && "border-primary bg-primary/[0.04]")}>
                    <div className="text-sm font-semibold">{renderer.label}</div><div className="mt-1 text-xs text-muted-foreground">{renderer.description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-6"><div className="text-sm font-semibold">Fields shown in output</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{outputKeys.map((key) => <label key={key} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={config.outputDesign.visibleFieldKeys.includes(key)} onChange={() => toggleOutputKey(key)} />{humanize(key)}</label>)}</div></div>
            </Panel>
          )}

          {activeTab === "runtime" && (
            <div className="space-y-6">
              <Panel>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={config.offline.enabled} onChange={(event) => setConfig((current) => ({ ...current, offline: { ...current.offline, enabled: event.target.checked } }))} /> Offline allowed</label>
                  <Field label="Reference cache"><select value={config.runtime.referenceCachePolicy} onChange={(event) => setConfig((current) => ({ ...current, runtime: { ...current.runtime, referenceCachePolicy: event.target.value as ResponsibilityExtensionConfig["runtime"]["referenceCachePolicy"] } }))} className={inputClass}><option value="none">None</option><option value="assigned">Assigned/relevant</option><option value="recent">Recent</option><option value="first_n">First N</option><option value="all_bounded">All, bounded</option></select></Field>
                  <Field label="Sync mode"><select value={config.runtime.syncMode} onChange={(event) => setConfig((current) => ({ ...current, runtime: { ...current.runtime, syncMode: event.target.value as ResponsibilityExtensionConfig["runtime"]["syncMode"] } }))} className={inputClass}><option value="immediate">Immediate</option><option value="background">Background</option><option value="manual_allowed">Manual allowed</option></select></Field>
                  <Field label="Max cached reference rows"><input type="number" min={1} value={config.offline.maxReferenceRows ?? 500} onChange={(event) => setConfig((current) => ({ ...current, offline: { ...current.offline, maxReferenceRows: Number(event.target.value) } }))} className={inputClass} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={config.runtime.pushRefresh} onChange={(event) => setConfig((current) => ({ ...current, runtime: { ...current.runtime, pushRefresh: event.target.checked } }))} /> Push workspace refresh</label><label className="flex items-center gap-2"><input type="checkbox" checked={config.runtime.appResumeRefresh} onChange={(event) => setConfig((current) => ({ ...current, runtime: { ...current.runtime, appResumeRefresh: event.target.checked } }))} /> Refresh on app resume</label><label className="flex items-center gap-2"><input type="checkbox" checked={config.offline.optimisticMutations} onChange={(event) => setConfig((current) => ({ ...current, offline: { ...current.offline, optimisticMutations: event.target.checked } }))} /> Optimistic offline mutations</label></div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between gap-3"><div><div className="font-semibold">Runtime rollout</div><div className="mt-1 text-xs text-muted-foreground">CMS is ready to show live device/app rollout. Exactness improves when the app starts reporting manifest versions.</div></div><SecondaryButton type="button" onClick={() => responsibilityId && void loadDetail(responsibilityId)}><RefreshCw className="h-4 w-4" /> Refresh</SecondaryButton></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.assignment.directAssignedUsers ?? 0}</div><div className="text-xs text-muted-foreground">Direct users</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.assignment.assignmentRules ?? 0}</div><div className="text-xs text-muted-foreground">Assignment rules</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.deviceSummary.registered ?? 0}</div><div className="text-xs text-muted-foreground">Devices</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.deviceSummary.online ?? 0}</div><div className="text-xs text-muted-foreground">Online</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.deviceSummary.updated ?? 0}</div><div className="text-xs text-muted-foreground">Updated</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{runtime?.deviceSummary.pending ?? 0}</div><div className="text-xs text-muted-foreground">Pending</div></div>
                </div>

                {runtime?.devices?.length ? (
                  <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Employee</th><th className="p-2">Device</th><th className="p-2">App</th><th className="p-2">Presence</th><th className="p-2">Manifest</th><th className="p-2">Last sync</th></tr></thead><tbody>{runtime.devices.map((device) => <tr key={device.id} className="border-b last:border-0"><td className="p-2">{device.userName}</td><td className="p-2">{device.model ?? device.platform}<div className="text-[10px] text-muted-foreground">{device.osVersion ?? device.deviceId}</div></td><td className="p-2">{device.appVersion ?? "Unknown"}</td><td className="p-2">{device.online ? <Pill tone="good">Online</Pill> : <Pill>Offline</Pill>}</td><td className="p-2">{device.updated ? <Pill tone="good">v{device.reportedVersion} ✓</Pill> : <Pill tone="info">v{device.reportedVersion || "?"}</Pill>}</td><td className="p-2 text-xs text-muted-foreground">{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : "Never reported"}</td></tr>)}</tbody></table></div>
                ) : <div className="mt-5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No registered assigned devices yet. This fills automatically once the mobile runtime starts registering device + manifest telemetry.</div>}
              </Panel>

              <Panel>
                <div className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4" /> Version history</div>
                <div className="mt-4 flex flex-wrap gap-2">{versions.length ? versions.map((version) => <Pill key={version.id} tone={version.version === publishedVersion ? "good" : "neutral"}>v{version.version} · {version.status}</Pill>) : <div className="text-sm text-muted-foreground">No published versions yet.</div>}</div>
              </Panel>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <Panel>
                <div className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4" /> Preview controls</div>
                <div className="mt-4 space-y-4">
                  <Field label="Preview as Role"><select value={config.preview.roleId ?? ""} onChange={(event) => setConfig((current) => ({ ...current, preview: { ...current.preview, roleId: Number(event.target.value) || undefined } }))} className={inputClass}><option value="">No specific Role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></Field>
                  <Field label="Device"><select value={config.preview.device} onChange={(event) => setConfig((current) => ({ ...current, preview: { ...current.preview, device: event.target.value as ResponsibilityExtensionConfig["preview"]["device"] } }))} className={inputClass}><option value="phone">Phone</option><option value="tablet">Tablet</option><option value="rugged">Rugged field device</option></select></Field>
                  <Field label="Connectivity"><select value={config.preview.connectivity} onChange={(event) => setConfig((current) => ({ ...current, preview: { ...current.preview, connectivity: event.target.value as ResponsibilityExtensionConfig["preview"]["connectivity"] } }))} className={inputClass}><option value="online">Online</option><option value="offline">Offline</option></select></Field>
                  <div className="rounded-lg border p-3 text-sm"><div className="font-medium">Use permission</div><div className="mt-1 text-xs text-muted-foreground">{roleAllowed(config.access.useRoleIds, config.preview.roleId) ? "This role can reach the Responsibility (subject to assignment/backend policy)." : "This role is blocked by the Responsibility access policy."}</div></div>
                </div>
              </Panel>

              <Panel>
                <div className={cx("mx-auto rounded-[28px] border-[6px] border-foreground/80 bg-background shadow-sm", config.preview.device === "tablet" ? "max-w-[680px]" : "max-w-[360px]") }>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3 border-b pb-3"><div><div className="text-lg font-semibold">{selectedResponsibility?.title ?? "Responsibility"}</div><div className="text-xs text-muted-foreground">{humanize(config.builderMode)} · manifest v2</div></div>{config.preview.connectivity === "online" ? <Pill tone="good"><Wifi className="mr-1 h-3 w-3" /> Online</Pill> : <Pill tone="info"><WifiOff className="mr-1 h-3 w-3" /> Offline</Pill>}</div>
                    {!roleAllowed(config.access.useRoleIds, config.preview.roleId) ? (
                      <div className="my-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">This Role would not see/use this Responsibility.</div>
                    ) : (
                      <div className="space-y-4 py-5">
                        {config.session.enabled && <div className="rounded-lg border p-3"><div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" /> {config.session.label}</div><div className="mt-2 grid grid-cols-2 gap-2"><button className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{config.session.startActionLabel}</button><button className="rounded-md border px-3 py-2 text-xs font-semibold">{config.session.stopActionLabel}</button></div><div className="mt-2 text-[11px] text-muted-foreground">GPS every {config.session.sampleEverySeconds}s / {config.session.sampleEveryMeters}m · offline {config.session.allowOffline ? "allowed" : "blocked"}</div></div>}
                        {fields.filter((field) => objectValue(field.config).hidden !== true).map((field) => <div key={field.key}><div className="mb-1 text-xs font-medium">{field.label}{field.required ? " *" : ""}</div><div className="flex h-10 items-center rounded-md border px-3 text-xs text-muted-foreground">{humanize(field.inputType)}</div></div>)}
                        {config.smartBlocks.map((block) => <div key={block.key} className="rounded-md border bg-muted/20 p-2 text-xs"><span className="font-medium">{block.label}</span><span className="text-muted-foreground"> · {humanize(block.kind)}</span></div>)}
                        {config.evidenceBundles.map((bundle) => <div key={bundle.key} className="rounded-lg border p-3"><div className="flex items-center gap-2 text-xs font-medium"><Camera className="h-4 w-4" /> {bundle.label}</div><div className="mt-1 text-[11px] text-muted-foreground">{Object.entries(bundle.capture).filter(([, enabled]) => enabled).map(([key]) => humanize(key)).join(" + ")}</div></div>)}
                        {config.flow.enabled && <div className="rounded-lg border p-3"><div className="text-xs font-semibold">FLOW</div><div className="mt-2 space-y-1 text-xs">{config.flow.steps.map((step, index) => <div key={step.key}>{index + 1}. {step.label} → {step.actionLabel}</div>)}</div></div>}
                        {config.preview.connectivity === "offline" && !config.offline.enabled && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">This Responsibility requires internet. Cached detail can be shown, but actions should be blocked.</div>}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
