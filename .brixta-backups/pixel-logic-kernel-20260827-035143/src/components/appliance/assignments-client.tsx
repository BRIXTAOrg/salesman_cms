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
  Search,
  Users,
} from "lucide-react";

import type {
  Employee,
  EmployeeDetail,
  Responsibility,
} from "@/lib/appliance-types";
import {
  apiJson,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

export default function AssignmentsClient() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [responsibilities, setResponsibilities] =
    useState<Responsibility[]>([]);
  const [selectedId, setSelectedId] =
    useState<number | null>(null);
  const [detail, setDetail] =
    useState<EmployeeDetail | null>(null);
  const [directIds, setDirectIds] =
    useState<number[]>([]);
  const [query, setQuery] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [employeeBody, responsibilityBody] =
        await Promise.all([
          apiJson<{ employees: Employee[] }>(
            "/api/appliance/employees",
          ),
          apiJson<{ responsibilities: Responsibility[] }>(
            "/api/appliance/responsibilities",
          ),
        ]);

      const nextEmployees = employeeBody.employees ?? [];
      setEmployees(nextEmployees);
      setResponsibilities(
        (responsibilityBody.responsibilities ?? []).filter(
          (item) => item.isActive !== false,
        ),
      );

      setSelectedId((current) =>
        current ?? nextEmployees[0]?.id ?? null,
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

  const loadEmployee = useCallback(async (id: number) => {
    setMessage(null);

    try {
      const body = await apiJson<EmployeeDetail>(
        `/api/appliance/employees/${id}`,
      );

      setDetail(body);
      setDirectIds(
        body.directResponsibilityIds ??
          body.directCapabilityIds ??
          [],
      );
    } catch (error) {
      setDetail(null);
      setDirectIds([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load employee assignments.",
      );
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (selectedId) {
      void loadEmployee(selectedId);
    }
  }, [selectedId, loadEmployee]);

  const filteredEmployees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;

    return employees.filter((employee) =>
      [
        employee.name,
        employee.employeeCode,
        employee.department,
        employee.designation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [employees, query]);

  const resolvedIds = useMemo(
    () => new Set(
      (detail?.responsibilities ?? []).map((item) => item.id),
    ),
    [detail],
  );

  function toggle(id: number) {
    setDirectIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);

    try {
      const body = await apiJson<{
        success: boolean;
        directResponsibilityIds: number[];
        resolvedResponsibilities: Responsibility[];
      }>(
        `/api/appliance/employees/${selectedId}/responsibilities`,
        {
          method: "PUT",
          body: JSON.stringify({
            responsibilityIds: directIds,
          }),
        },
      );

      setDirectIds(body.directResponsibilityIds ?? directIds);
      setMessage("Direct Responsibility assignments saved.");
      await Promise.all([
        loadEmployee(selectedId),
        loadBase(),
      ]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save assignments.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedEmployee = employees.find(
    (employee) => employee.id === selectedId,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Assignments"
        description="Assign Responsibilities directly to employees. Organization-wide rules are configured on each Responsibility and are resolved in addition to these direct assignments."
        action={
          <SecondaryButton type="button" onClick={() => void loadBase()}>
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

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees"
          description="Add a mobile employee before assigning Responsibilities."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
          <Panel className="p-0 overflow-hidden">
            <div className="border-b p-4">
              <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find employee..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="max-h-[680px] overflow-y-auto">
              {filteredEmployees.map((employee) => {
                const active = employee.id === selectedId;
                return (
                  <button
                    type="button"
                    key={employee.id}
                    onClick={() => setSelectedId(employee.id)}
                    className={
                      active
                        ? "flex w-full items-center gap-3 border-b bg-muted/60 px-4 py-3 text-left"
                        : "flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-muted/30"
                    }
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {employee.name ?? employee.employeeCode ?? `Employee ${employee.id}`}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[employee.department, employee.designation]
                          .filter(Boolean)
                          .join(" · ") || "No organization metadata"}
                      </div>
                    </div>
                    <Pill>{employee.directResponsibilityCount ?? 0}</Pill>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            {!selectedEmployee || !detail ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xl font-semibold">
                      {selectedEmployee.name ?? selectedEmployee.employeeCode}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Choose the Responsibilities assigned directly to this employee.
                    </div>
                  </div>
                  <PrimaryButton
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save assignments
                  </PrimaryButton>
                </div>

                {responsibilities.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title="No active Responsibilities"
                      description="Create a Responsibility first."
                    />
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {responsibilities.map((responsibility) => {
                      const direct = directIds.includes(responsibility.id);
                      const resolved = resolvedIds.has(responsibility.id);
                      const inherited = resolved && !direct;

                      return (
                        <label
                          key={responsibility.id}
                          className={
                            direct
                              ? "flex cursor-pointer gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
                              : "flex cursor-pointer gap-3 rounded-lg border p-4 hover:bg-muted/20"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={direct}
                            onChange={() => toggle(responsibility.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{responsibility.title}</div>
                              {inherited && <Pill tone="info">from rule</Pill>}
                            </div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">
                              {responsibility.key}
                            </div>
                            {responsibility.description && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                {responsibility.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Resolved now: {detail.responsibilities.length}. Direct selections: {directIds.length}. A rule can grant or deny additional Responsibilities without duplicating employee records.
                </div>
              </>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
