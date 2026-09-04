"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Settings2,
  Sparkles,
  Globe2,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SearchSelect } from "@/components/search-select";
import type {
  Department,
  Employee,
  Responsibility,
  Role,
} from "@/lib/appliance-types";
import type {
  PlatformDataSource,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";
import type {
  KernelAction,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import {
  STARTER_TEMPLATES,
  blankResponsibilityKernel,
} from "@/lib/responsibility-kernel-catalog";
import {
  compileKernelToBaseDefinition,
  hydrateKernelFromBaseDefinition,
} from "@/lib/responsibility-kernel-compiler";
import { RESPONSIBILITY_KERNEL_METADATA_KEY } from "@/lib/responsibility-kernel-types";
import { validateResponsibilityKernel } from "@/lib/responsibility-kernel-validation";

import ResponsibilityAppBuilder from "./responsibility-app-builder";
import ResponsibilityExternalLinkBuilder from "./responsibility-external-link-builder";
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

const BUILDER_TARGET_ROLE_IDS_KEY = "builderTargetRoleIds";

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

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asKernel(
  config: ResponsibilityExtensionConfig,
  responsibility?: Responsibility | null,
): ResponsibilityKernel {
  const metadata =
    config.metadata && typeof config.metadata === "object"
      ? config.metadata
      : {};
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
    return hydrateKernelFromBaseDefinition(
      responsibility.definition,
      responsibility.title,
    );
  }
  return blankResponsibilityKernel();
}

function targetRoleIdsFrom(config: ResponsibilityExtensionConfig) {
  const raw = config.metadata?.[BUILDER_TARGET_ROLE_IDS_KEY];
  return Array.isArray(raw)
    ? raw.map(Number).filter((item) => Number.isInteger(item) && item > 0)
    : [];
}

function withBuilderState(
  config: ResponsibilityExtensionConfig,
  kernel: ResponsibilityKernel,
  targetRoleIds: number[],
): ResponsibilityExtensionConfig {
  return {
    ...config,
    metadata: {
      ...(config.metadata ?? {}),
      [RESPONSIBILITY_KERNEL_METADATA_KEY]: kernel,
      [BUILDER_TARGET_ROLE_IDS_KEY]: [...new Set(targetRoleIds)],
    },
  };
}

function builderActionOperation(action: KernelAction): "create" | "update" {
  return ["create", "submit", "start"].includes(action.kind)
    ? "create"
    : "update";
}

function inlineReviewIntent(
  action: KernelAction,
) {
  const required =
    action.config
      .reviewRequired ===
    true;

  if (!required) {
    return null;
  }

  const rawTarget =
    action.config
      .reviewTarget;

  if (
    rawTarget &&
    typeof rawTarget ===
      "object" &&
    !Array.isArray(
      rawTarget,
    )
  ) {
    const target =
      rawTarget as Record<
        string,
        unknown
      >;

    const kind =
      String(
        target.kind ??
        "default",
      );

    if (
      kind ===
      "employee"
    ) {
      return {
        kind:
          "user" as const,

        userId:
          Number(
            target.userId,
          ),
      };
    }

    if (
      kind ===
      "role"
    ) {
      return {
        kind:
          "role" as const,

        roleId:
          Number(
            target.roleId,
          ),
      };
    }

    if (
      kind ===
      "department"
    ) {
      return {
        kind:
          "department" as const,

        departmentId:
          String(
            target.departmentId ??
            "",
          ).trim(),
      };
    }

    return {
      kind:
        "reports_to" as const,
    };
  }

  /*
   * Old Responsibility drafts continue to work.
   */
  const rawApprover =
    typeof action.config
      .reviewApprover ===
      "string"
      ? action.config
          .reviewApprover
          .trim()
      : "";

  if (
    rawApprover.startsWith(
      "role:",
    )
  ) {
    const roleId =
      Number(
        rawApprover.slice(
          "role:".length,
        ),
      );

    return (
      Number.isInteger(
        roleId,
      ) &&
      roleId > 0
    )
      ? {
          kind:
            "role" as const,
          roleId,
        }
      : {
          kind:
            "reports_to" as const,
        };
  }

  return {
    kind:
      "reports_to" as const,
  };
}

function inlineReviewWorkflowKey(responsibilityKey: string, actionId: string) {
  return `auto_review_${normalizeKey(responsibilityKey)}_${normalizeKey(actionId)}`;
}

export default function ResponsibilityKernelClient() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(
    [],
  );
  const [responsibilityId, setResponsibilityId] = useState<number | null>(null);
  const [extension, setExtension] =
    useState<ResponsibilityExtensionConfig | null>(null);
  const [kernel, setKernel] = useState<ResponsibilityKernel>(
    blankResponsibilityKernel(),
  );
  const [dataSources, setDataSources] = useState<PlatformDataSource[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [targetRoleIds, setTargetRoleIds] = useState<number[]>([]);

  const [publishedVersion, setPublishedVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);

  /*
   * One Responsibility, multiple delivery surfaces.
   *
   * This changes the authoring VIEW only.
   * Save/Publish still persists the same canonical Kernel.
   */
  const [builderSurface, setBuilderSurface] =
    useState<"app" | "external">("app");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStarter, setNewStarter] = useState("blank");
  const [newTargetRoleIds, setNewTargetRoleIds] = useState<number[]>([]);

  const selectedResponsibility = useMemo(
    () => responsibilities.find((item) => item.id === responsibilityId) ?? null,
    [responsibilities, responsibilityId],
  );

  const validation = useMemo(
    () => validateResponsibilityKernel(kernel),
    [kernel],
  );
  const compiled = useMemo(
    () => compileKernelToBaseDefinition(kernel),
    [kernel],
  );
  const errorCount = validation.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = validation.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [
        responsibilityBody,
        sourceBody,
        roleBody,
        employeeBody,
        departmentBody,
      ] = await Promise.all([
        apiJson<{ responsibilities: Responsibility[] }>(
          "/api/appliance/responsibilities",
        ),

        apiJson<{ dataSources: PlatformDataSource[] }>(
          "/api/platform/data-sources",
        ),

        apiJson<{ roles: Role[] }>(
          "/api/platform/roles",
        ),

        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),

        apiJson<{ departments: Department[] }>(
          "/api/appliance/departments",
        ),
      ]);

      const active = (responsibilityBody.responsibilities ?? []).filter(
        (item) => item.isActive !== false,
      );
      setResponsibilities(active);
      setDataSources(sourceBody.dataSources ?? []);
      setRoles(roleBody.roles ?? []);
      setEmployees(employeeBody.employees ?? []);
      setDepartments(departmentBody.departments ?? []);
      setResponsibilityId((current) =>
        current && active.some((item) => item.id === current)
          ? current
          : (active[0]?.id ?? null),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibility Canvas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: number, knownResponsibilities?: Responsibility[]) => {
      setLoading(true);
      try {
        const body = await apiJson<ExtensionResponse>(
          `/api/platform/responsibility-extensions/${id}`,
        );
        const list = knownResponsibilities ?? responsibilities;
        const responsibility = list.find((item) => item.id === id) ?? null;

        setExtension(body.extension.draftConfig);
        setKernel(asKernel(body.extension.draftConfig, responsibility));
        setTargetRoleIds(targetRoleIdsFrom(body.extension.draftConfig));
        setPublishedVersion(body.extension.publishedVersion ?? 0);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Responsibility definition.",
        );
      } finally {
        setLoading(false);
      }
    },
    [responsibilities],
  );

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (responsibilityId) void loadDetail(responsibilityId);
  }, [responsibilityId, loadDetail]);

  async function saveDraft(silent = false) {
    if (!responsibilityId || !extension) {
      throw new Error("Choose a Responsibility first.");
    }
    if (targetRoleIds.length === 0) {
      throw new Error(
        "Choose at least one target Role. The builder must know who this Responsibility is for.",
      );
    }

    setSaving(true);
    try {
      const nextExtension = withBuilderState(extension, kernel, targetRoleIds);

      await apiJson(
        `/api/platform/responsibility-extensions/${responsibilityId}`,
        {
          method: "PUT",
          body: JSON.stringify({ config: nextExtension }),
        },
      );

      setExtension(nextExtension);
      if (!silent) {
        setMessage(
          "Draft saved. Role targeting is baked into the draft; employee devices remain on the last published version.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function syncInlineReviewWorkflows() {
    if (!selectedResponsibility) return;

    const layout = kernel.metadata.ui?.layout ?? [];
    const orderedActions = layout
      .map((possibilityId) =>
        kernel.possibilities.find((item) => item.id === possibilityId),
      )
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "action" }
        > => Boolean(item && item.type === "action"),
      );

    const workflowBody = await apiJson<{
      workflows: Array<{
        id: number;
        key: string;
        isActive: boolean;
      }>;
    }>("/api/appliance/workflows");

    const existingWorkflows = workflowBody.workflows ?? [];
    const prefix = `auto_review_${normalizeKey(selectedResponsibility.key)}_`;
    const desiredKeys = new Set<string>();

    for (let index = 0; index < orderedActions.length; index += 1) {
      const current = orderedActions[index].action;
      const review = inlineReviewIntent(current);
      if (!review) continue;

      const workflowKey = inlineReviewWorkflowKey(
        selectedResponsibility.key,
        current.id,
      );
      desiredKeys.add(workflowKey);

      const steps: Array<Record<string, unknown>> = [
        {
          stepType: "action",
          title: current.label,
          responsibilityKey: selectedResponsibility.key,
          operation: builderActionOperation(current),
        },
        {
          stepType: "approval",
          title: `Verify ${current.label}`,

          approverKind:
            review.kind,

          ...(review.kind === "role"
            ? {
                approverRoleIds: [
                  review.roleId,
                ],
              }
            : {}),

          ...(review.kind === "user"
            ? {
                approverUserId:
                  review.userId,
              }
            : {}),

          ...(review.kind === "department"
            ? {
                approverDepartmentId:
                  review.departmentId,
              }
            : {}),
        },
      ];

      const next = orderedActions[index + 1]?.action;
      if (
        next &&
        builderActionOperation(next) !== builderActionOperation(current)
      ) {
        steps.push({
          stepType: "action",
          title: next.label,
          responsibilityKey: selectedResponsibility.key,
          operation: builderActionOperation(next),
        });
      }

      const existing = existingWorkflows.find(
        (workflow) => workflow.key === workflowKey,
      );

      if (existing) {
        if (!existing.isActive) {
          await apiJson(`/api/appliance/workflows/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: true }),
          });
        }

        await apiJson(`/api/appliance/workflows/${existing.id}/versions`, {
          method: "POST",
          body: JSON.stringify({ steps }),
        });
      } else {
        await apiJson("/api/appliance/workflows", {
          method: "POST",
          body: JSON.stringify({
            key: workflowKey,
            name: `${selectedResponsibility.title} - ${current.label} review`,
            description:
              "Generated automatically from an inline Responsibility review gate.",
            steps,
          }),
        });
      }
    }

    for (const workflow of existingWorkflows) {
      if (
        workflow.key.startsWith(prefix) &&
        !desiredKeys.has(workflow.key) &&
        workflow.isActive
      ) {
        await apiJson(`/api/appliance/workflows/${workflow.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        });
      }
    }
  }

  async function publish() {
    if (!responsibilityId) return;

    if (targetRoleIds.length === 0) {
      setMessage("Publish blocked: select at least one target Role.");
      return;
    }

    const issues = validateResponsibilityKernel(kernel);
    if (issues.some((issue) => issue.severity === "error")) {
      setCheckOpen(true);
      setMessage("Publish blocked. Fix the red checks shown below the canvas.");
      return;
    }

    setPublishing(true);
    try {
      await saveDraft(true);
      const body = await apiJson<{ version?: number; message?: string }>(
        `/api/platform/responsibility-extensions/${responsibilityId}/publish`,
        { method: "POST" },
      );
      setPublishedVersion(body.version ?? publishedVersion + 1);

      await syncInlineReviewWorkflows();

      setMessage(
        body.message ??
          "Published. The employee app and any inline human review flow are now active.",
      );

      const refreshed = await apiJson<{ responsibilities: Responsibility[] }>(
        "/api/appliance/responsibilities",
      );
      setResponsibilities(
        (refreshed.responsibilities ?? []).filter(
          (item) => item.isActive !== false,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish Responsibility.",
      );
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
    if (newTargetRoleIds.length === 0) {
      setMessage(
        "Choose who this Responsibility is for before opening the builder.",
      );
      return;
    }

    const template =
      STARTER_TEMPLATES.find((item) => item.key === newStarter) ??
      STARTER_TEMPLATES[0];
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

      const list = await apiJson<{ responsibilities: Responsibility[] }>(
        "/api/appliance/responsibilities",
      );
      const active = (list.responsibilities ?? []).filter(
        (item) => item.isActive !== false,
      );
      setResponsibilities(active);

      const created = [...active]
        .reverse()
        .find((item) => item.key === key || item.title === title);
      if (!created) {
        throw new Error(
          "Responsibility created, but its new id could not be resolved. Refresh and select it.",
        );
      }

      const detail = await apiJson<ExtensionResponse>(
        `/api/platform/responsibility-extensions/${created.id}`,
      );
      const nextExtension = withBuilderState(
        detail.extension.draftConfig,
        nextKernel,
        newTargetRoleIds,
      );

      await apiJson(`/api/platform/responsibility-extensions/${created.id}`, {
        method: "PUT",
        body: JSON.stringify({ config: nextExtension }),
      });

      setResponsibilityId(created.id);
      setExtension(nextExtension);
      setKernel(nextKernel);
      setTargetRoleIds(newTargetRoleIds);
      setPublishedVersion(0);

      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewStarter("blank");
      setNewTargetRoleIds([]);

      setMessage(
        `“${title}” created for ${newTargetRoleIds.length} Role(s). The canvas now knows who it is being built for.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create Responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleTargetRole(roleId: number, creating = false) {
    const setter = creating ? setNewTargetRoleIds : setTargetRoleIds;
    setter((current) =>
      current.includes(roleId)
        ? current.filter((item) => item !== roleId)
        : [...current, roleId],
    );
  }

  if (loading && responsibilities.length === 0 && !createOpen) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-clip space-y-4 pb-8">
      <div className="rounded-2xl border bg-background/95 p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="text-base font-semibold">
                Responsibility Canvas
              </div>
              <Pill>v{publishedVersion || "draft"}</Pill>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Choose the Role → drag the app → publish. World, context and
              workflow wiring are infrastructure, not extra homework.
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-2">
            {responsibilities.length > 0 && (
              <div className="w-full sm:w-[260px]">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                  Responsibility
                </div>
                <SearchSelect
                  options={responsibilities.map((item) => ({
                    label: item.title,
                    value: String(item.id),
                  }))}
                  value={responsibilityId ? String(responsibilityId) : ""}
                  placeholder="Choose Responsibility..."
                  searchPlaceholder="Search Responsibilities..."
                  onChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    if (next) setResponsibilityId(Number(next));
                  }}
                />
              </div>
            )}

            <SecondaryButton
              type="button"
              onClick={() => setCreateOpen((value) => !value)}
            >
              <Plus className="h-4 w-4" /> New
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={!responsibilityId || loading}
              onClick={() =>
                responsibilityId && void loadDetail(responsibilityId)
              }
            >
              <RefreshCw className="h-4 w-4" /> Reload
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setCheckOpen((value) => !value)}
              className={cx(errorCount > 0 && "border-destructive/50")}
            >
              {errorCount > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Check{" "}
              {errorCount > 0
                ? errorCount
                : warningCount > 0
                  ? warningCount
                  : "✓"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={!responsibilityId || saving}
              onClick={() => void saveDraft()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={!responsibilityId || publishing}
              onClick={() => void publish()}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Publish
            </PrimaryButton>
          </div>
        </div>

        {roles.length > 0 && selectedResponsibility && (
          <div className="mt-3 rounded-lg border bg-muted/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium">
              <UsersRound className="h-3.5 w-3.5" />
              This Responsibility is for
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleTargetRole(role.id)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs transition",
                    targetRoleIds.includes(role.id)
                      ? "border-primary bg-primary/[0.08] text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {message && (
          <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            {message}
          </div>
        )}
      </div>

      {createOpen && (
        <Panel>
          <div className="text-lg font-semibold">Create Responsibility</div>
          <div className="mt-1 text-sm text-muted-foreground">
            First choose who this is for. Then the builder can become
            role-aware.
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Responsibility name">
              <input
                className={inputClass}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Expense Claim / Dealer Visit / Site Inspection"
              />
            </Field>
            <Field label="Starter">
              <select
                className={inputClass}
                value={newStarter}
                onChange={(event) => setNewStarter(event.target.value)}
              >
                {STARTER_TEMPLATES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} — {item.description}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What is this for?">
              <textarea
                className={textareaClass}
                rows={2}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Optional plain-language description"
              />
            </Field>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium">
              Who will receive this Responsibility?
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleTargetRole(role.id, true)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-sm",
                    newTargetRoleIds.includes(role.id)
                      ? "border-primary bg-primary/[0.08]"
                      : "text-muted-foreground",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <PrimaryButton
              type="button"
              disabled={saving}
              onClick={() => void createResponsibility()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create & open canvas
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {!selectedResponsibility ? (
        <EmptyState
          title={
            responsibilities.length === 0
              ? "Create your first Responsibility"
              : "Choose a Responsibility"
          }
          description={
            responsibilities.length === 0
              ? "Use New above. Choose the target Role(s), then build the experience."
              : "Select a Responsibility above to open its builders."
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
            <button
              type="button"
              onClick={() => setBuilderSurface("app")}
              className={cx(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                builderSurface === "app"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Sparkles className="mr-2 inline h-4 w-4" />
              App Builder
            </button>

            <button
              type="button"
              onClick={() => setBuilderSurface("external")}
              className={cx(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                builderSurface === "external"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Globe2 className="mr-2 inline h-4 w-4" />
              External Link
            </button>

            <div className="ml-auto px-2 text-[11px] text-muted-foreground">
              Same Responsibility · same UI · same Pixel Logic
            </div>
          </div>

          {builderSurface === "app" ? (
            <ResponsibilityAppBuilder
              responsibilityId={selectedResponsibility.id}
              responsibilityTitle={selectedResponsibility.title}
              kernel={kernel}
              dataSources={dataSources}
              roles={roles}
              employees={employees}
              departments={departments}
              onChange={setKernel}
            />
          ) : (
            <ResponsibilityExternalLinkBuilder
              responsibilityId={selectedResponsibility.id}
              responsibilityTitle={selectedResponsibility.title}
              kernel={kernel}
              onChange={setKernel}
            />
          )}
        </>
      )}

      {checkOpen && (
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Canvas check</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Safety validation only. This is not another builder.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCheckOpen(false)}
              className="rounded-md p-2 hover:bg-muted"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {validation.map((issue) => (
              <div
                key={`${issue.code}-${issue.target ?? "root"}`}
                className={cx(
                  "flex items-start gap-3 rounded-lg border p-3",
                  issue.severity === "error" && "border-destructive/40",
                  issue.severity === "good" && "border-emerald-500/30",
                )}
              >
                {issue.severity === "error" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : issue.severity === "good" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <div className="text-sm">{issue.message}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {issue.code}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDeveloperOpen((value) => !value)}
            className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Developer contract
            {developerOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {developerOpen && (
            <pre className="mt-3 max-h-[520px] overflow-auto rounded-lg border bg-muted/20 p-3 text-[10px] leading-relaxed">
              {JSON.stringify(
                {
                  targetRoleIds,
                  kernel,
                  compiledBaseDefinition: compiled,
                },
                null,
                2,
              )}
            </pre>
          )}
        </Panel>
      )}
    </div>
  );
}
