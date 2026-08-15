
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";

import type {
  Capability,
  Employee,
  WorkItem,
} from "@/lib/appliance-types";
import {
  apiJson,
  formatDateTime,
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

export default function AssignmentsClient() {
  const [items, setItems] =
    useState<WorkItem[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [capabilities, setCapabilities] =
    useState<Capability[]>([]);
  const [status, setStatus] =
    useState("open");
  const [showCreate, setShowCreate] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        itemBody,
        employeeBody,
        capabilityBody,
      ] = await Promise.all([
        apiJson<{
          workItems: WorkItem[];
        }>("/api/appliance/work-items"),
        apiJson<{
          employees: Employee[];
        }>("/api/appliance/employees"),
        apiJson<{
          capabilities: Capability[];
        }>("/api/appliance/capabilities"),
      ]);

      setItems(
        itemBody.workItems ?? [],
      );
      setEmployees(
        employeeBody.employees ?? [],
      );
      setCapabilities(
        capabilityBody.capabilities ?? [],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load assignments.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (status === "all") {
      return items;
    }

    if (status === "open") {
      return items.filter(
        (item) =>
          item.status ===
            "assigned" ||
          item.status ===
            "in_progress",
      );
    }

    return items.filter(
      (item) =>
        item.status === status,
    );
  }, [items, status]);

  function employeeName(
    id: number,
  ) {
    const employee = employees.find(
      (item) => item.id === id,
    );

    return (
      employee?.name ??
      employee?.employeeCode ??
      `Employee ${id}`
    );
  }

  function capabilityName(
    id?: number | null,
  ) {
    if (!id) return "General work";

    return (
      capabilities.find(
        (item) => item.id === id,
      )?.title ??
      "Responsibility"
    );
  }

  async function createAssignment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);

    const data = new FormData(
      event.currentTarget,
    );

    const capabilityRaw = String(
      data.get("capabilityId") ?? "",
    );
    const dueRaw = String(
      data.get("dueAt") ?? "",
    );

    try {
      await apiJson(
        "/api/appliance/work-items",
        {
          method: "POST",
          body: JSON.stringify({
            assigneeUserId: Number(
              data.get("assigneeUserId"),
            ),
            capabilityId:
              capabilityRaw
                ? Number(capabilityRaw)
                : null,
            title: String(
              data.get("title") ?? "",
            ).trim(),
            description:
              String(
                data.get(
                  "description",
                ) ?? "",
              ).trim() || null,
            priority: String(
              data.get("priority") ??
                "normal",
            ),
            dueAt: dueRaw
              ? new Date(
                  dueRaw,
                ).toISOString()
              : null,
            approvalRequired:
              data.get(
                "approvalRequired",
              ) === "on",
            approvalAreaKey:
              String(
                data.get(
                  "approvalAreaKey",
                ) ?? "",
              ).trim() || null,
            payload: {},
          }),
        },
      );

      setShowCreate(false);
      setMessage(
        "Work assigned. It will appear in the employee's work queue.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to assign work.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    item: WorkItem,
    nextStatus: string,
  ) {
    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/work-items/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      await load();
    } finally {
      setSaving(false);
    }
  }

  const openCount = items.filter(
    (item) =>
      item.status === "assigned" ||
      item.status === "in_progress",
  ).length;

  const completedCount =
    items.filter(
      (item) =>
        item.status === "completed",
    ).length;

  const overdueCount =
    items.filter((item) => {
      if (
        !item.dueAt ||
        item.status === "completed" ||
        item.status === "cancelled"
      ) {
        return false;
      }

      return (
        new Date(
          item.dueAt,
        ).getTime() < Date.now()
      );
    }).length;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Assignments"
        description="A responsibility says what someone can do. An assignment says what they should do now."
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
              onClick={() =>
                setShowCreate(true)
              }
            >
              <Plus className="h-4 w-4" />
              Assign work
            </PrimaryButton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {openCount}
          </div>
          <div className="mt-1 text-sm">
            Open
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {completedCount}
          </div>
          <div className="mt-1 text-sm">
            Completed
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {overdueCount}
          </div>
          <div className="mt-1 text-sm">
            Overdue
          </div>
        </div>
      </div>

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ["open", "Open"],
          ["completed", "Completed"],
          ["cancelled", "Cancelled"],
          ["all", "All"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() =>
              setStatus(value)
            }
            className={
              status === value
                ? "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
                : "rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Panel className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No assignments here"
              description="Assign specific work when someone needs a concrete task, visit, check or follow-up."
            />
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((item) => {
              const overdue =
                Boolean(item.dueAt) &&
                ![
                  "completed",
                  "cancelled",
                ].includes(
                  item.status,
                ) &&
                new Date(
                  item.dueAt!,
                ).getTime() <
                  Date.now();

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    {item.status ===
                    "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : item.status ===
                      "cancelled" ? (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">
                        {item.title}
                      </div>
                      <Pill
                        tone={
                          item.status ===
                          "completed"
                            ? "good"
                            : overdue
                              ? "danger"
                              : item.status ===
                                  "in_progress"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {overdue
                          ? "Overdue"
                          : item.status.replace(
                              "_",
                              " ",
                            )}
                      </Pill>
                      {item.priority !==
                        "normal" && (
                        <Pill tone="warning">
                          {item.priority}
                        </Pill>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      {employeeName(
                        item.assigneeUserId,
                      )}
                      {" · "}
                      {capabilityName(
                        item.capabilityId,
                      )}
                    </div>

                    {item.description && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                  </div>

                  <div className="min-w-44 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      {item.dueAt
                        ? formatDateTime(
                            item.dueAt,
                          )
                        : "No due date"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {item.status ===
                    "cancelled" ? (
                      <SecondaryButton
                        type="button"
                        onClick={() =>
                          void updateStatus(
                            item,
                            "assigned",
                          )
                        }
                        className="h-9"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reopen
                      </SecondaryButton>
                    ) : ![
                        "completed",
                      ].includes(
                        item.status,
                      ) ? (
                      <SecondaryButton
                        type="button"
                        onClick={() =>
                          void updateStatus(
                            item,
                            "cancelled",
                          )
                        }
                        className="h-9"
                      >
                        Cancel
                      </SecondaryButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={showCreate}
        title="Assign work"
        description="Give a specific person a specific piece of work. Keep it simple."
        onClose={() =>
          setShowCreate(false)
        }
        wide
      >
        <form
          onSubmit={createAssignment}
          className="space-y-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee">
              <select
                name="assigneeUserId"
                required
                className={inputClass}
                defaultValue=""
              >
                <option value="">
                  Choose employee
                </option>
                {employees
                  .filter(
                    (employee) =>
                      employee.status ===
                      "active",
                  )
                  .map(
                    (employee) => (
                      <option
                        key={
                          employee.id
                        }
                        value={
                          employee.id
                        }
                      >
                        {employee.name ??
                          employee.employeeCode}
                      </option>
                    ),
                  )}
              </select>
            </Field>

            <Field
              label="Responsibility"
              hint="Optional. Use this when the task belongs to a known responsibility."
            >
              <select
                name="capabilityId"
                className={inputClass}
                defaultValue=""
              >
                <option value="">
                  General work
                </option>
                {capabilities
                  .filter(
                    (item) =>
                      item.isActive !==
                      false,
                  )
                  .map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.title}
                      </option>
                    ),
                  )}
              </select>
            </Field>

            <Field label="Task">
              <input
                name="title"
                required
                placeholder="Visit ABC Traders"
                className={inputClass}
              />
            </Field>

            <Field label="Due">
              <input
                name="dueAt"
                type="datetime-local"
                className={inputClass}
              />
            </Field>

            <Field label="Priority">
              <select
                name="priority"
                className={inputClass}
                defaultValue="normal"
              >
                <option value="low">
                  Low
                </option>
                <option value="normal">
                  Normal
                </option>
                <option value="high">
                  High
                </option>
                <option value="urgent">
                  Urgent
                </option>
              </select>
            </Field>

            <Field
              label="Approval area"
              hint="Only needed when completion should create an approval."
            >
              <input
                name="approvalAreaKey"
                placeholder="expense_approval"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Instructions">
            <textarea
              name="description"
              placeholder="Anything the employee should know before starting."
              className={textareaClass}
            />
          </Field>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              name="approvalRequired"
            />
            <div>
              <div className="text-sm font-medium">
                Approval required after completion
              </div>
              <div className="text-xs text-muted-foreground">
                The backend will route it to the configured owner or fallback admin.
              </div>
            </div>
          </label>

          <div className="flex justify-end gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={saving}
            >
              Assign work
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
