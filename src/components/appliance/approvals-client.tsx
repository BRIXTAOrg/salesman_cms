
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BadgeCheck,
  Check,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import type {
  Approval,
  Employee,
} from "@/lib/appliance-types";
import {
  apiJson,
  formatDateTime,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

export default function ApprovalsClient() {
  const [approvals, setApprovals] =
    useState<Approval[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [view, setView] =
    useState<"pending" | "all">(
      "pending",
    );
  const [loading, setLoading] =
    useState(true);
  const [savingId, setSavingId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          approvalBody,
          employeeBody,
        ] = await Promise.all([
          apiJson<{
            approvals: Approval[];
          }>(
            `/api/appliance/approvals?status=${view}`,
          ),
          apiJson<{
            employees: Employee[];
          }>("/api/appliance/employees"),
        ]);

        setApprovals(
          approvalBody.approvals ?? [],
        );
        setEmployees(
          employeeBody.employees ?? [],
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load approvals.",
        );
      } finally {
        setLoading(false);
      }
    },
    [view],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount =
    approvals.filter(
      (item) =>
        item.status === "pending",
    ).length;

  const employeeName = (
    id?: number | null,
  ) => {
    if (!id) return "System";

    const employee = employees.find(
      (item) => item.id === id,
    );

    return (
      employee?.name ??
      employee?.employeeCode ??
      `Employee ${id}`
    );
  };

  async function decide(
    approval: Approval,
    decision:
      | "approved"
      | "rejected",
  ) {
    const note =
      window.prompt(
        decision === "approved"
          ? "Optional approval note:"
          : "Reason for rejection:",
      ) ?? "";

    setSavingId(approval.id);

    try {
      await apiJson(
        `/api/appliance/approvals/${approval.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision,
            note,
          }),
        },
      );

      setMessage(
        decision === "approved"
          ? "Approved."
          : "Rejected.",
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update approval.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      Approval[]
    >();

    for (const approval of approvals) {
      const key =
        approval.areaKey ||
        "general";

      map.set(key, [
        ...(map.get(key) ?? []),
        approval,
      ]);
    }

    return [...map.entries()];
  }, [approvals]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Approvals"
        description="One inbox for work that needs a decision. Approval source can be TA/DA, shipment, task completion or any future workflow."
        action={
          <SecondaryButton
            type="button"
            onClick={() =>
              void load()
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setView("pending")
          }
          className={
            view === "pending"
              ? "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              : "rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
          }
        >
          Waiting
        </button>

        <button
          type="button"
          onClick={() =>
            setView("all")
          }
          className={
            view === "all"
              ? "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              : "rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
          }
        >
          History
        </button>

        <Pill
          tone={
            pendingCount
              ? "warning"
              : "good"
          }
        >
          {pendingCount} waiting
        </Pill>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : approvals.length ===
        0 ? (
        <EmptyState
          title={
            view === "pending"
              ? "Nothing waiting for approval"
              : "No approval history yet"
          }
          description="When a workflow creates an approval request it will appear here."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(
            ([area, items]) => (
              <Panel key={area}>
                <div className="mb-4 flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5" />
                  <div className="text-lg font-semibold">
                    {area
                      .replace(
                        /_/g,
                        " ",
                      )
                      .replace(
                        /\b\w/g,
                        (letter) =>
                          letter.toUpperCase(),
                      )}
                  </div>
                  <Pill>
                    {items.length}
                  </Pill>
                </div>

                <div className="divide-y">
                  {items.map(
                    (approval) => (
                      <div
                        key={
                          approval.id
                        }
                        className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">
                              {
                                approval.title
                              }
                            </div>
                            <Pill
                              tone={
                                approval.status ===
                                "approved"
                                  ? "good"
                                  : approval.status ===
                                      "rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {
                                approval.status
                              }
                            </Pill>
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            Requested by{" "}
                            {employeeName(
                              approval.requesterUserId,
                            )}
                            {" · "}
                            {
                              approval.sourceType
                            }
                            {" · "}
                            {formatDateTime(
                              approval.requestedAt,
                            )}
                          </div>

                          {approval.decisionNote && (
                            <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                              {
                                approval.decisionNote
                              }
                            </div>
                          )}
                        </div>

                        {approval.status ===
                          "pending" && (
                          <div className="flex gap-2">
                            <SecondaryButton
                              type="button"
                              disabled={
                                savingId ===
                                approval.id
                              }
                              onClick={() =>
                                void decide(
                                  approval,
                                  "rejected",
                                )
                              }
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </SecondaryButton>

                            <PrimaryButton
                              type="button"
                              disabled={
                                savingId ===
                                approval.id
                              }
                              onClick={() =>
                                void decide(
                                  approval,
                                  "approved",
                                )
                              }
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </PrimaryButton>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </Panel>
            ),
          )}
        </div>
      )}
    </div>
  );
}
