"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import type {
  CrudOperation,
  Responsibility,
  Role,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowVersion,
} from "@/lib/appliance-types";
import {
  apiJson,
} from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Modal,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";

type BuilderStep = {
  localId: string;
  title: string;
  stepType: "action" | "approval";
  responsibilityKey: string;
  operation: CrudOperation;
  approverRoleIds: number[];
};

type BuilderState = {
  name: string;
  description: string;
  steps: BuilderStep[];
};

function localId() {
  return globalThis.crypto?.randomUUID?.() ??
    `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blankAction(
  responsibility?: Responsibility,
): BuilderStep {
  const operations = enabledOperations(responsibility);
  return {
    localId: localId(),
    title: responsibility
      ? `Create ${responsibility.title}`
      : "Start work",
    stepType: "action",
    responsibilityKey: responsibility?.key ?? "",
    operation: operations[0] ?? "create",
    approverRoleIds: [],
  };
}

function blankApproval(): BuilderStep {
  return {
    localId: localId(),
    title: "Approval",
    stepType: "approval",
    responsibilityKey: "",
    operation: "create",
    approverRoleIds: [],
  };
}

function enabledOperations(
  responsibility?: Responsibility,
): CrudOperation[] {
  const all: CrudOperation[] = [
    "create",
    "read",
    "update",
    "delete",
  ];

  if (!responsibility?.definition?.crud) {
    return all;
  }

  return all.filter(
    (operation) => responsibility.definition.crud[operation],
  );
}

function titleForAction(
  responsibility: Responsibility | undefined,
  operation: CrudOperation,
) {
  const verb =
    operation === "create"
      ? "Create"
      : operation === "read"
        ? "Read"
        : operation === "update"
          ? "Update"
          : "Delete";

  return responsibility
    ? `${verb} ${responsibility.title}`
    : `${verb} record`;
}

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function latestVersion(
  workflow: WorkflowDefinition,
) {
  return [...(workflow.versions ?? [])]
    .sort((a, b) => b.version - a.version)[0] ?? null;
}

function builderStepFromExisting(
  step: WorkflowStep,
): BuilderStep {
  const config = objectValue(step.config);
  const roleIds = Array.isArray(config.approverRoleIds)
    ? config.approverRoleIds.map(Number).filter(Number.isInteger)
    : [];

  return {
    localId: localId(),
    title: step.title,
    stepType:
      step.stepType === "approval"
        ? "approval"
        : "action",
    responsibilityKey:
      typeof config.responsibilityKey === "string"
        ? config.responsibilityKey
        : "",
    operation:
      ["create", "read", "update", "delete"].includes(
        String(config.operation),
      )
        ? config.operation as CrudOperation
        : "create",
    approverRoleIds: roleIds,
  };
}

function payloadSteps(steps: BuilderStep[]) {
  return steps.map((step) =>
    step.stepType === "approval"
      ? {
          stepType: "approval",
          title: step.title.trim() || "Approval",
          approverRoleIds: step.approverRoleIds,
        }
      : {
          stepType: "action",
          title: step.title.trim(),
          responsibilityKey: step.responsibilityKey,
          operation: step.operation,
        },
  );
}

export default function WorkflowsClient() {
  const [workflows, setWorkflows] =
    useState<WorkflowDefinition[]>([]);
  const [responsibilities, setResponsibilities] =
    useState<Responsibility[]>([]);
  const [roles, setRoles] =
    useState<Role[]>([]);
  const [operations, setOperations] =
    useState<CrudOperation[]>([
      "create",
      "read",
      "update",
      "delete",
    ]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const [showCreate, setShowCreate] =
    useState(false);
  const [builder, setBuilder] =
    useState<BuilderState>({
      name: "",
      description: "",
      steps: [blankAction()],
    });
  const [versioning, setVersioning] =
    useState<WorkflowDefinition | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [workflowBody, responsibilityBody] =
        await Promise.all([
          apiJson<{
            workflows: WorkflowDefinition[];
            roles: Role[];
            operations: CrudOperation[];
          }>("/api/appliance/workflows"),
          apiJson<{
            responsibilities: Responsibility[];
          }>("/api/appliance/responsibilities"),
        ]);

      setWorkflows(workflowBody.workflows ?? []);
      setRoles(workflowBody.roles ?? []);
      setOperations(
        workflowBody.operations?.length
          ? workflowBody.operations
          : ["create", "read", "update", "delete"],
      );
      setResponsibilities(
        (responsibilityBody.responsibilities ?? []).filter(
          (item) => item.isActive !== false,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Workflows.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const responsibilityMap = useMemo(
    () => new Map(
      responsibilities.map((item) => [item.key, item]),
    ),
    [responsibilities],
  );

  function validateBuilder() {
    if (!builder.name.trim()) {
      return "Workflow name is required.";
    }
    if (builder.steps.length === 0) {
      return "Workflow needs at least one step.";
    }
    if (builder.steps[0].stepType !== "action") {
      return "The first Workflow step must be a Responsibility action.";
    }

    for (let index = 0; index < builder.steps.length; index += 1) {
      const step = builder.steps[index];

      if (!step.title.trim()) {
        return `Step ${index + 1} needs a title.`;
      }

      if (step.stepType === "action") {
        if (!step.responsibilityKey) {
          return `Step ${index + 1} needs a Responsibility.`;
        }

        const responsibility = responsibilityMap.get(step.responsibilityKey);
        if (!responsibility) {
          return `Step ${index + 1} references a disabled or missing Responsibility.`;
        }

        if (!responsibility.definition.crud[step.operation]) {
          return `${step.title}: ${step.operation} is disabled on ${responsibility.title}.`;
        }
      } else if (step.approverRoleIds.length === 0) {
        return `Step ${index + 1} needs at least one approver role.`;
      }
    }

    return null;
  }

  function updateStep(
    index: number,
    patch: Partial<BuilderStep>,
  ) {
    setBuilder((current) => ({
      ...current,
      steps: current.steps.map((step, itemIndex) =>
        itemIndex === index
          ? { ...step, ...patch }
          : step,
      ),
    }));
  }

  function moveStep(
    index: number,
    direction: -1 | 1,
  ) {
    setBuilder((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.steps.length) {
        return current;
      }
      const steps = [...current.steps];
      const [item] = steps.splice(index, 1);
      steps.splice(target, 0, item);
      return { ...current, steps };
    });
  }

  function openCreate() {
    const firstResponsibility = responsibilities[0];
    setVersioning(null);
    setBuilder({
      name: "",
      description: "",
      steps: [blankAction(firstResponsibility)],
    });
    setShowCreate(true);
    setMessage(null);
  }

  function openVersion(workflow: WorkflowDefinition) {
    const version = latestVersion(workflow);
    setVersioning(workflow);
    setBuilder({
      name: workflow.name,
      description: workflow.description ?? "",
      steps:
        version?.steps?.length
          ? version.steps
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(builderStepFromExisting)
          : [blankAction(responsibilities[0])],
    });
    setShowCreate(true);
    setMessage(null);
  }

  async function saveWorkflow(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const validation = validateBuilder();
    if (validation) {
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (versioning) {
        // Name/description belong to the definition; step topology belongs to
        // an immutable published version.
        await apiJson(
          `/api/appliance/workflows/${versioning.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: builder.name.trim(),
              description: builder.description.trim() || null,
            }),
          },
        );

        await apiJson(
          `/api/appliance/workflows/${versioning.id}/versions`,
          {
            method: "POST",
            body: JSON.stringify({
              steps: payloadSteps(builder.steps),
            }),
          },
        );

        setMessage("New Workflow version published. Running instances remain tied to their original version.");
      } else {
        await apiJson(
          "/api/appliance/workflows",
          {
            method: "POST",
            body: JSON.stringify({
              name: builder.name.trim(),
              description: builder.description.trim() || null,
              steps: payloadSteps(builder.steps),
            }),
          },
        );

        setMessage("Workflow published. Runtime authorization will use its Responsibility CRUD steps.");
      }

      setShowCreate(false);
      setVersioning(null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save Workflow.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleWorkflow(
    workflow: WorkflowDefinition,
  ) {
    setSaving(true);
    try {
      await apiJson(
        `/api/appliance/workflows/${workflow.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !workflow.isActive,
          }),
        },
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update Workflow.",
      );
    } finally {
      setSaving(false);
    }
  }

  function actionOperations(step: BuilderStep) {
    const responsibility = responsibilityMap.get(step.responsibilityKey);
    const enabled = enabledOperations(responsibility);
    return operations.filter((operation) => enabled.includes(operation));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Workflows"
        description="Sequence Responsibility CRUD actions and approval decisions. The backend is the authoritative state machine; the CMS only authors versions."
        action={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={openCreate}
              disabled={responsibilities.length === 0}
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </PrimaryButton>
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      {responsibilities.length === 0 && !loading && (
        <EmptyState
          title="Create a Responsibility first"
          description="Workflow action nodes reference stable Responsibility CRUD operations, not route names."
        />
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No Workflows yet"
          description="Responsibilities can work independently. Add a Workflow when order, prerequisites or approval matter."
        />
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => {
            const version = latestVersion(workflow);
            const steps = (version?.steps ?? [])
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <Panel key={workflow.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      <div className="text-lg font-semibold">{workflow.name}</div>
                      <Pill tone={workflow.isActive ? "good" : "neutral"}>
                        {workflow.isActive ? "Active" : "Disabled"}
                      </Pill>
                      {version && (
                        <Pill tone="info">v{version.version} · {version.status}</Pill>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {workflow.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      className="h-9"
                      onClick={() => openVersion(workflow)}
                    >
                      Publish new version
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className="h-9"
                      disabled={saving}
                      onClick={() => void toggleWorkflow(workflow)}
                    >
                      {workflow.isActive ? "Disable" : "Enable"}
                    </SecondaryButton>
                  </div>
                </div>

                {steps.length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <div className="flex min-w-max items-stretch gap-3">
                      {steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className="w-60 rounded-lg border bg-muted/20 p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Step {index + 1} · {step.stepType}
                            </div>
                            <div className="mt-1 font-medium">{step.title}</div>
                            {step.actionKey && (
                              <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                                {step.actionKey}
                              </div>
                            )}
                          </div>
                          {index < steps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        title={versioning ? `Publish new version · ${versioning.name}` : "Create Workflow"}
        description="Action nodes use Responsibility + CRUD operation. Approval nodes use stable Role IDs. Published versions are immutable."
        onClose={() => {
          setShowCreate(false);
          setVersioning(null);
        }}
        wide
      >
        <form onSubmit={saveWorkflow} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Workflow name">
              <input
                value={builder.name}
                onChange={(event) =>
                  setBuilder((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </Field>
            <Field label="Description">
              <input
                value={builder.description}
                onChange={(event) =>
                  setBuilder((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div className="space-y-4">
            {builder.steps.map((step, index) => {
              const selectedResponsibility = responsibilityMap.get(step.responsibilityKey);
              const availableOperations = actionOperations(step);

              return (
                <Panel key={step.localId} className="bg-muted/15">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {index + 1}
                      </div>
                      <div className="mt-1 font-medium">{step.title || "Untitled step"}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === builder.steps.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBuilder((current) => ({
                            ...current,
                            steps: current.steps.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        disabled={builder.steps.length === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Node type">
                      <select
                        value={step.stepType}
                        onChange={(event) => {
                          const stepType = event.target.value as "action" | "approval";
                          if (index === 0 && stepType === "approval") return;
                          updateStep(index, {
                            stepType,
                            title:
                              stepType === "approval"
                                ? "Approval"
                                : titleForAction(selectedResponsibility, step.operation),
                          });
                        }}
                        className={inputClass}
                      >
                        <option value="action">Responsibility action</option>
                        {index > 0 && <option value="approval">Approval</option>}
                      </select>
                    </Field>

                    <Field label="Step title">
                      <input
                        value={step.title}
                        onChange={(event) => updateStep(index, { title: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  {step.stepType === "action" ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Responsibility">
                        <select
                          value={step.responsibilityKey}
                          onChange={(event) => {
                            const responsibilityKey = event.target.value;
                            const responsibility = responsibilityMap.get(responsibilityKey);
                            const nextOperation = enabledOperations(responsibility)[0] ?? "create";
                            updateStep(index, {
                              responsibilityKey,
                              operation: nextOperation,
                              title: titleForAction(responsibility, nextOperation),
                            });
                          }}
                          className={inputClass}
                        >
                          <option value="">Choose Responsibility...</option>
                          {responsibilities.map((responsibility) => (
                            <option key={responsibility.id} value={responsibility.key}>
                              {responsibility.title}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="CRUD operation">
                        <select
                          value={step.operation}
                          onChange={(event) => {
                            const operation = event.target.value as CrudOperation;
                            updateStep(index, {
                              operation,
                              title: titleForAction(selectedResponsibility, operation),
                            });
                          }}
                          className={inputClass}
                        >
                          {availableOperations.map((operation) => (
                            <option key={operation} value={operation}>
                              {operation}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Field
                        label="Approver roles"
                        hint="Any selected role can approve in the current backend policy mode."
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          {roles.map((role) => {
                            const checked = step.approverRoleIds.includes(role.id);
                            return (
                              <label
                                key={role.id}
                                className="flex items-center gap-2 rounded-md border p-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    updateStep(index, {
                                      approverRoleIds: checked
                                        ? step.approverRoleIds.filter((id) => id !== role.id)
                                        : [...step.approverRoleIds, role.id],
                                    })
                                  }
                                />
                                {role.label}
                              </label>
                            );
                          })}
                        </div>
                      </Field>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setBuilder((current) => ({
                  ...current,
                  steps: [
                    ...current.steps,
                    blankAction(responsibilities[0]),
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Action step
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() =>
                setBuilder((current) => ({
                  ...current,
                  steps: [
                    ...current.steps,
                    blankApproval(),
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Approval step
            </SecondaryButton>
          </div>

          <div className="flex justify-end gap-2 border-t pt-5">
            <SecondaryButton
              type="button"
              onClick={() => {
                setShowCreate(false);
                setVersioning(null);
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {versioning ? "Publish version" : "Publish Workflow"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
