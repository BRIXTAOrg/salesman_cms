
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Network,
  RefreshCw,
  Users,
} from "lucide-react";

import type {
  Employee,
} from "@/lib/appliance-types";
import {
  apiJson,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  SecondaryButton,
  Stat,
} from "./primitives";

export default function OrganizationClient() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] =
    useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const body =
        await apiJson<{
          employees: Employee[];
        }>("/api/appliance/employees");

      setEmployees(
        body.employees ?? [],
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = employees.filter(
    (employee) =>
      employee.status === "active",
  );

  const departmentGroups = useMemo(() => {
    const map =
      new Map<string, Employee[]>();

    for (const employee of active) {
      const key =
        employee.department?.trim() ||
        "Unassigned";

      map.set(key, [
        ...(map.get(key) ?? []),
        employee,
      ]);
    }

    return [...map.entries()].sort(
      (a, b) =>
        a[0].localeCompare(b[0]),
    );
  }, [active]);

  const managerName = (
    id?: number | null,
  ) => {
    if (!id) return null;

    const manager = employees.find(
      (employee) =>
        employee.id === id,
    );

    return (
      manager?.name ??
      manager?.employeeCode ??
      null
    );
  };

  const missingManager =
    active.filter(
      (employee) =>
        !employee.reportsToId,
    ).length;

  const missingDepartment =
    active.filter(
      (employee) =>
        !employee.department,
    ).length;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workforce"
        title="Organization"
        description="A simple view of departments and reporting lines. Hierarchy gives scope; responsibilities give capability."
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          value={active.length}
          label="Active employees"
        />
        <Stat
          value={departmentGroups.length}
          label="Departments"
        />
        <Stat
          value={missingManager}
          label="Without manager"
          hint={
            missingManager
              ? "Only add reporting lines where the business needs them."
              : "Reporting lines are complete."
          }
        />
      </div>

      {(missingManager > 0 ||
        missingDepartment > 0) && (
        <Panel className="border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <div className="font-medium">
                Organization setup can be improved
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {missingManager} employee(s) have no manager and {missingDepartment} have no department. This does not block basic use.
              </div>
              <Link
                href="/dashboard/workforce/employees"
                className="mt-2 inline-block text-sm font-medium"
              >
                Fix in Employees
              </Link>
            </div>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border bg-muted/30" />
      ) : departmentGroups.length ===
        0 ? (
        <EmptyState
          title="No organization data yet"
          description="Create employees first. Departments are optional."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {departmentGroups.map(
            ([name, members]) => (
              <Panel key={name}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    <div className="text-lg font-semibold">
                      {name}
                    </div>
                  </div>
                  <Pill>
                    {members.length} people
                  </Pill>
                </div>

                <div className="mt-4 divide-y">
                  {members.map(
                    (employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {employee.name ??
                              employee.employeeCode}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {employee.designation ??
                              "No designation"}
                            {" · "}
                            {managerName(
                              employee.reportsToId,
                            )
                              ? `Reports to ${managerName(
                                  employee.reportsToId,
                                )}`
                              : "No manager"}
                          </div>
                        </div>
                        {!employee.reportsToId && (
                          <Pill tone="info">
                            Flexible
                          </Pill>
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
