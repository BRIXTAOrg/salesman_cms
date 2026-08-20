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
  ArrowUp,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

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

type ActionOption = {
  value: string;
  key: string;
  title: string;
  kind: string;
};

type RoleOption = {
  id: number;
  label: string;
};

type ExistingStep = {
  id: number;
  workflowVersionId: number;
  stepKey: string;
  title: string;
  stepType: string;
  sortOrder: number;
  actionKey?: string | null;
  actionTitle?: string | null;
};

type Workflow = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  versions: Array<{
    id: number;
    version: number;
    status: string;
  }>;
  steps: ExistingStep[];
};

type BuilderStep = {
  id: string;
  title: string;
  stepType: "action" | "approval";
  actionRef: string;
  approverRoleIds: number[];
};

function localId() {
  return globalThis.crypto?.randomUUID?.() ??
    `step-${Date.now()}-${Math.random()}`;
}

function blankStep(
  index: number,
): BuilderStep {
  return {
    id: localId(),
    title:
      index === 0
        ? "Start work"
        : `Step ${index + 1}`,
    stepType: "action",
    actionRef: "",
    approverRoleIds: [],
  };
}

export default function WorkflowsClient() {
  const [
    workflows,
    setWorkflows,
  ] = useState<Workflow[]>([]);

  const [
    actions,
    setActions,
  ] = useState<ActionOption[]>([]);

  const [roles, setRoles] =
    useState<RoleOption[]>([]);

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [steps, setSteps] =
    useState<BuilderStep[]>([
      blankStep(0),
    ]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const body =
          await apiJson<{
            workflows:
              Workflow[];
            actions:
              ActionOption[];
            roles:
              RoleOption[];
          }>(
            "/api/workspace/workflows",
          );

        setWorkflows(
          body.workflows ?? [],
        );

        setActions(
          body.actions ?? [],
        );

        setRoles(
          body.roles ?? [],
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load workflows.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const actionMap = useMemo(
    () =>
      new Map(
        actions.map(
          (action) => [
            action.value,
            action,
          ],
        ),
      ),
    [actions],
  );

  function updateStep(
    index: number,
    patch:
      Partial<BuilderStep>,
  ) {
    setSteps((current) =>
      current.map(
        (step, itemIndex) =>
          itemIndex === index
            ? {
                ...step,
                ...patch,
              }
            : step,
      ),
    );
  }

  function moveStep(
    index: number,
    direction: -1 | 1,
  ) {
    setSteps((current) => {
      const target =
        index + direction;

      if (
        target < 0 ||
        target >=
          current.length
      ) {
        return current;
      }

      const next = [
        ...current,
      ];

      const [item] =
        next.splice(
          index,
          1,
        );

      next.splice(
        target,
        0,
        item,
      );

      return next;
    });
  }

  async function createWorkflow(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const missingAction =
      steps.find(
        (step) =>
          !step.actionRef,
      );

    if (missingAction) {
      setMessage(
        "Every workflow step needs an action or responsibility.",
      );
      return;
    }

    const missingApprover =
      steps.find(
        (step) =>
          step.stepType ===
            "approval" &&
          step.approverRoleIds
            .length === 0,
      );

    if (missingApprover) {
      setMessage(
        "Every approval step needs at least one approver role.",
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    const data =
      new FormData(
        event.currentTarget,
      );

    try {
      await apiJson(
        "/api/workspace/workflows",
        {
          method: "POST",
          body: JSON.stringify({
            name:
              String(
                data.get(
                  "name",
                ) ?? "",
              ).trim(),

            description:
              String(
                data.get(
                  "description",
                ) ?? "",
              ).trim() ||
              null,

            steps: steps.map(
              (step) => ({
                title:
                  step.title,
                stepType:
                  step.stepType,
                actionRef:
                  step.actionRef,
                approverRoleIds:
                  step.approverRoleIds,
              }),
            ),
          }),
        },
      );

      setShowCreate(false);
      setSteps([
        blankStep(0),
      ]);

      setMessage(
        "Workflow published. The sidebar and Control Center will now resolve from it.",
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create workflow.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleWorkflow(
    workflow: Workflow,
  ) {
    setSaving(true);

    try {
      await apiJson(
        `/api/workspace/workflows/${workflow.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive:
              !workflow.isActive,
          }),
        },
      );

      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-6">
      <div className="space-y-8">
        <PageIntro
          eyebrow="Workspace"
          title="Workflows"
          description="Define the sequence of work. Published workflows drive navigation, approvals and Control Center metrics."
          action={
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                onClick={() =>
                  void load()
                }
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </SecondaryButton>

              <PrimaryButton
                type="button"
                onClick={() => {
                  setSteps([
                    blankStep(0),
                  ]);
                  setShowCreate(
                    true,
                  );
                  setMessage(null);
                }}
              >
                <Plus className="h-4 w-4" />
                Create workflow
              </PrimaryButton>
            </div>
          }
        />

        {message && (
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : workflows.length ===
          0 ? (
          <EmptyState
            title="No workflows yet"
            description="Create the first workflow. Once published, the rest of the CMS can shape itself around that flow."
          />
        ) : (
          <div className="space-y-4">
            {workflows.map(
              (workflow) => {
                const published =
                  [...workflow.versions]
                    .reverse()
                    .find(
                      (version) =>
                        version.status ===
                        "published",
                    );

                const steps =
                  published
                    ? workflow.steps
                        .filter(
                          (step) =>
                            step.workflowVersionId ===
                            published.id,
                        )
                        .sort(
                          (a, b) =>
                            a.sortOrder -
                            b.sortOrder,
                        )
                    : [];

                return (
                  <Panel
                    key={
                      workflow.id
                    }
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <GitBranch className="h-5 w-5" />
                          <div className="text-lg font-semibold">
                            {
                              workflow.name
                            }
                          </div>

                          <Pill
                            tone={
                              workflow.isActive
                                ? "good"
                                : "neutral"
                            }
                          >
                            {workflow.isActive
                              ? "Active"
                              : "Off"}
                          </Pill>

                          {published && (
                            <Pill tone="info">
                              Published
                              v
                              {
                                published.version
                              }
                            </Pill>
                          )}
                        </div>

                        {workflow.description && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {
                              workflow.description
                            }
                          </p>
                        )}
                      </div>

                      <SecondaryButton
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void toggleWorkflow(
                            workflow,
                          )
                        }
                      >
                        {workflow.isActive
                          ? "Disable"
                          : "Enable"}
                      </SecondaryButton>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                      <div className="flex min-w-max items-center gap-3">
                        {steps.map(
                          (
                            step,
                            index,
                          ) => (
                            <div
                              key={
                                step.id
                              }
                              className="flex items-center gap-3"
                            >
                              <div className="w-60 rounded-xl border bg-muted/20 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                  {step.stepType ===
                                  "approval"
                                    ? "Approval"
                                    : "Action"}
                                </div>

                                <div className="mt-1 font-medium">
                                  {
                                    step.title
                                  }
                                </div>

                                {step.actionTitle && (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    {
                                      step.actionTitle
                                    }
                                  </div>
                                )}
                              </div>

                              {index <
                                steps.length -
                                  1 && (
                                <div className="text-muted-foreground">
                                  →
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </Panel>
                );
              },
            )}
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        title="Create workflow"
        description="Define the real sequence. Each step references an existing Responsibility/action. Approval steps dynamically use tenant roles."
        onClose={() =>
          setShowCreate(false)
        }
        wide
      >
        <form
          onSubmit={
            createWorkflow
          }
          className="space-y-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Workflow name">
              <input
                name="name"
                required
                placeholder="Dealer Field Visit"
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="What is this flow for?">
              <input
                name="description"
                placeholder="Journey plan, approval and visit reporting."
                className={
                  inputClass
                }
              />
            </Field>
          </div>

          <div className="space-y-4">
            {steps.map(
              (step, index) => (
                <div
                  key={step.id}
                  className="rounded-xl border bg-muted/10 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Step{" "}
                        {index + 1}
                      </div>

                      <div className="mt-1 font-medium">
                        {step.title ||
                          "Untitled step"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={
                          index === 0
                        }
                        onClick={() =>
                          moveStep(
                            index,
                            -1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          index ===
                          steps.length -
                            1
                        }
                        onClick={() =>
                          moveStep(
                            index,
                            1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          steps.length ===
                          1
                        }
                        onClick={() =>
                          setSteps(
                            (current) =>
                              current.filter(
                                (
                                  _,
                                  itemIndex,
                                ) =>
                                  itemIndex !==
                                  index,
                              ),
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <Field label="Step name">
                      <input
                        value={
                          step.title
                        }
                        onChange={(
                          event,
                        ) =>
                          updateStep(
                            index,
                            {
                              title:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        className={
                          inputClass
                        }
                      />
                    </Field>

                    <Field label="Step type">
                      <select
                        value={
                          step.stepType
                        }
                        onChange={(
                          event,
                        ) =>
                          updateStep(
                            index,
                            {
                              stepType:
                                event
                                  .target
                                  .value ===
                                "approval"
                                  ? "approval"
                                  : "action",
                              approverRoleIds:
                                [],
                            },
                          )
                        }
                        className={
                          inputClass
                        }
                      >
                        <option value="action">
                          Action
                        </option>
                        <option value="approval">
                          Approval
                        </option>
                      </select>
                    </Field>

                    <Field label="Responsibility / action">
                      <select
                        value={
                          step.actionRef
                        }
                        onChange={(
                          event,
                        ) => {
                          const ref =
                            event
                              .target
                              .value;

                          const option =
                            actionMap.get(
                              ref,
                            );

                          updateStep(
                            index,
                            {
                              actionRef:
                                ref,
                              title:
                                step.title ||
                                option?.title ||
                                "",
                            },
                          );
                        }}
                        required
                        className={
                          inputClass
                        }
                      >
                        <option value="">
                          Choose
                        </option>

                        {actions.map(
                          (action) => (
                            <option
                              key={
                                action.value
                              }
                              value={
                                action.value
                              }
                            >
                              {
                                action.title
                              }
                              {action.kind ===
                              "responsibility"
                                ? " — Responsibility"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                  </div>

                  {step.stepType ===
                    "approval" && (
                    <div className="mt-5">
                      <Field
                        label="Who can approve?"
                        hint="Any selected role may approve this step. Role IDs are stored, so renaming the role later does not break the workflow."
                      >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {roles.map(
                            (role) => {
                              const checked =
                                step.approverRoleIds.includes(
                                  role.id,
                                );

                              return (
                                <label
                                  key={
                                    role.id
                                  }
                                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      checked
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateStep(
                                        index,
                                        {
                                          approverRoleIds:
                                            event
                                              .target
                                              .checked
                                              ? [
                                                  ...step.approverRoleIds,
                                                  role.id,
                                                ]
                                              : step.approverRoleIds.filter(
                                                  (
                                                    id,
                                                  ) =>
                                                    id !==
                                                    role.id,
                                                ),
                                        },
                                      )
                                    }
                                  />

                                  {
                                    role.label
                                  }
                                </label>
                              );
                            },
                          )}
                        </div>
                      </Field>
                    </div>
                  )}
                </div>
              ),
            )}

            <SecondaryButton
              type="button"
              onClick={() =>
                setSteps(
                  (current) => [
                    ...current,
                    blankStep(
                      current.length,
                    ),
                  ],
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add step
            </SecondaryButton>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            Dependencies are created
            automatically in sequence:
            an action requires the
            previous action to be
            completed; a step after an
            approval requires the
            approval to be approved.
          </div>

          <div className="flex justify-end gap-2 border-t pt-6">
            <SecondaryButton
              type="button"
              onClick={() =>
                setShowCreate(
                  false,
                )
              }
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              disabled={saving}
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Publish workflow
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
