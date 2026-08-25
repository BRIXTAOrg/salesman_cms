"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableReusable } from "@/components/data-table-reusable";
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
    useState<"pending" | "all">("pending");
  const [loading, setLoading] =
    useState(true);
  const [savingId, setSavingId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [approvalBody, employeeBody] = await Promise.all([
        apiJson<{ approvals: Approval[] }>(
          `/api/appliance/approvals?status=${view}`,
        ),
        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),
      ]);

      setApprovals(approvalBody.approvals ?? []);
      setEmployees(employeeBody.employees ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load approvals.",
      );
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  function employeeName(id?: number | null) {
    if (!id) return "System";
    const employee = employees.find((item) => item.id === id);
    return employee?.name ?? employee?.employeeCode ?? `Employee ${id}`;
  }

  async function decide(
    approval: Approval,
    decision: "approved" | "rejected",
  ) {
    const note = window.prompt(
      decision === "approved"
        ? "Optional approval note:"
        : "Reason for rejection:",
    ) ?? "";

    setSavingId(approval.id);
    setMessage(null);

    try {
      await apiJson(
        `/api/appliance/approvals/${approval.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, note }),
        },
      );
      setMessage(decision === "approved" ? "Approved." : "Rejected.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to decide approval.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const columns = useMemo<ColumnDef<Approval>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Request",
        cell: ({ row }) => (
          <div className="font-semibold">{row.original.title}</div>
        ),
      },
      {
        id: "requestedBy",
        header: "Requested by",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {employeeName(row.original.requesterUserId)}
          </span>
        ),
      },
      {
        accessorKey: "requestedAt",
        header: "Requested at",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateTime(row.original.requestedAt)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Pill
            tone={
              row.original.status === "approved"
                ? "good"
                : row.original.status === "rejected"
                  ? "danger"
                  : "warning"
            }
          >
            {row.original.status}
          </Pill>
        ),
      },
      {
        id: "note",
        header: "Note",
        cell: ({ row }) =>
          row.original.decisionNote ? (
            <span className="text-muted-foreground">
              {row.original.decisionNote}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const approval = row.original;
          if (approval.status !== "pending") return null;

          return (
            <div className="flex justify-end gap-2">
              <SecondaryButton
                type="button"
                disabled={savingId === approval.id}
                onClick={() => void decide(approval, "rejected")}
              >
                <X className="h-4 w-4" />
                Reject
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={savingId === approval.id}
                onClick={() => void decide(approval, "approved")}
              >
                <Check className="h-4 w-4" />
                Approve
              </PrimaryButton>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, savingId],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Approvals"
        description="One inbox for approval nodes generated by published Workflows. The backend filters this list to decisions the current dashboard user is actually eligible to make."
        action={
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView("pending")}
          className={
            view === "pending"
              ? "rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
              : "rounded-md border px-3 py-2 text-sm font-medium"
          }
        >
          Waiting
        </button>
        <button
          type="button"
          onClick={() => setView("all")}
          className={
            view === "all"
              ? "rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
              : "rounded-md border px-3 py-2 text-sm font-medium"
          }
        >
          History
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          title={
            view === "pending"
              ? "Nothing waiting for your approval"
              : "No approval history"
          }
          description="Approval requests are created by Workflow approval steps."
        />
      ) : (
        <DataTableReusable columns={columns} data={approvals} />
      )}
    </div>
  );
}