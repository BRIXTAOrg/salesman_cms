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
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Layers3,
  Loader2,
  Network,
  Plus,
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

type PortfolioCompany = {
  id: number;
  name: string;
  schemaName: string;
  isProvisioned: boolean;
  platformVersion?: number;
  registryStatus?: string;
  isCurrent: boolean;
  available: boolean;
  stats: {
    activeEmployees: number;
    departments: number;
    responsibilities: number;
    workflows: number;
  };
  departments: string[];
  people: Array<{
    id: number;
    name: string;
    designation: string | null;
    department: string | null;
  }>;
  responsibilities: Array<{
    id: number;
    key: string;
    title: string;
  }>;
  workflows: Array<{
    id: number;
    key: string;
    name: string;
  }>;
  error?: string;
};

type PortfolioResponse = {
  companies: PortfolioCompany[];
  totals: {
    companies: number;
    activeEmployees: number;
    departments: number;
    responsibilities: number;
    workflows: number;
  };
};

const EMPTY_TOTALS = {
  companies: 0,
  activeEmployees: 0,
  departments: 0,
  responsibilities: 0,
  workflows: 0,
};

function CompanyCard({
  company,
  switching,
  onSwitch,
}: {
  company: PortfolioCompany;
  switching: number | null;
  onSwitch: (company: PortfolioCompany) => Promise<void>;
}) {
  const busy = switching === company.id;

  return (
    <Panel
      className={
        company.isCurrent
          ? "border-primary/50 bg-primary/[0.025]"
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <div className="truncate text-lg font-semibold">
              {company.name}
            </div>
            {company.isCurrent && (
              <Pill tone="good">
                Current company
              </Pill>
            )}
            {!company.available && (
              <Pill tone="info">
                Unavailable
              </Pill>
            )}
          </div>

          <div className="mt-1 truncate text-xs text-muted-foreground">
            {company.schemaName}
            {company.platformVersion
              ? ` · platform v${company.platformVersion}`
              : ""}
            {company.registryStatus
              ? ` · ${company.registryStatus}`
              : ""}
          </div>
        </div>

        {company.isCurrent ? (
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Open
          </div>
        ) : (
          <SecondaryButton
            type="button"
            disabled={
              switching !== null ||
              !company.isProvisioned ||
              !company.available
            }
            onClick={() => void onSwitch(company)}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Open
          </SecondaryButton>
        )}
      </div>

      {company.error ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          {company.error}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-lg font-semibold">
                {company.stats.activeEmployees}
              </div>
              <div className="text-[11px] text-muted-foreground">
                People
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-lg font-semibold">
                {company.stats.departments}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Departments
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-lg font-semibold">
                {company.stats.responsibilities}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Responsibilities
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-lg font-semibold">
                {company.stats.workflows}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Workflows
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                People
              </div>
              {company.people.length ? (
                <div className="space-y-1.5">
                  {company.people.map((person) => (
                    <div
                      key={person.id}
                      className="rounded-md border px-2.5 py-2"
                    >
                      <div className="truncate text-sm font-medium">
                        {person.name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {person.designation || "No designation"}
                        {" · "}
                        {person.department || "No department"}
                      </div>
                    </div>
                  ))}
                  {company.stats.activeEmployees >
                    company.people.length && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +
                      {company.stats.activeEmployees -
                        company.people.length}{" "}
                      more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No active field employees.
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Network className="h-3.5 w-3.5" />
                Departments
              </div>
              {company.departments.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {company.departments.map((department) => (
                    <Pill key={department}>
                      {department}
                    </Pill>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No departments yet.
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Responsibilities
              </div>
              {company.responsibilities.length ? (
                <div className="space-y-1.5">
                  {company.responsibilities.map(
                    (responsibility) => (
                      <div
                        key={responsibility.id}
                        className="rounded-md border px-2.5 py-2"
                      >
                        <div className="truncate text-sm font-medium">
                          {responsibility.title}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {responsibility.key}
                        </div>
                      </div>
                    ),
                  )}
                  {company.stats.responsibilities >
                    company.responsibilities.length && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +
                      {company.stats.responsibilities -
                        company.responsibilities.length}{" "}
                      more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No active Responsibilities.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

export default function OrganizationClient() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] =
    useState(true);

  const [portfolio, setPortfolio] =
    useState<PortfolioCompany[]>([]);
  const [portfolioTotals, setPortfolioTotals] =
    useState(EMPTY_TOTALS);
  const [portfolioLoading, setPortfolioLoading] =
    useState(true);
  const [portfolioError, setPortfolioError] =
    useState<string | null>(null);
  const [switching, setSwitching] =
    useState<number | null>(null);

  const loadCurrentCompany = useCallback(async () => {
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

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const body =
        await apiJson<PortfolioResponse>(
          "/api/account/portfolio",
        );

      setPortfolio(body.companies ?? []);
      setPortfolioTotals(
        body.totals ?? EMPTY_TOTALS,
      );
    } catch (error) {
      setPortfolioError(
        error instanceof Error
          ? error.message
          : "Unable to load account companies.",
      );
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([
      loadCurrentCompany(),
      loadPortfolio(),
    ]);
  }, [
    loadCurrentCompany,
    loadPortfolio,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchCompany(
    company: PortfolioCompany,
  ) {
    if (company.isCurrent) {
      return;
    }

    setSwitching(company.id);

    try {
      const response = await fetch(
        "/api/account/switch",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            organizationId: company.id,
          }),
        },
      );

      const body = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to switch company.",
        );
      }

      // Stay in the panoramic Organization screen after switching.
      window.location.assign(
        "/dashboard/workforce/organization",
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to switch company.",
      );
      setSwitching(null);
    }
  }

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
        description="Your account panorama across companies, plus the detailed organization view for the company currently open."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted/40"
            >
              <Plus className="h-4 w-4" />
              Add company
            </Link>

            <SecondaryButton
              type="button"
              onClick={() =>
                void load()
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <Panel>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Layers3 className="h-5 w-5" />
                Account panorama
              </div>
              <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
                See the workforce structure and active Responsibilities of every company attached to this account. Each firm's data still stays inside its own PostgreSQL schema; this screen only reads account-authorized summaries.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>
                {portfolioTotals.companies} companies
              </Pill>
              <Pill>
                {portfolioTotals.activeEmployees} people
              </Pill>
              <Pill>
                {portfolioTotals.departments} departments
              </Pill>
              <Pill>
                {portfolioTotals.responsibilities} responsibilities
              </Pill>
              <Pill>
                {portfolioTotals.workflows} workflows
              </Pill>
            </div>
          </div>

          {portfolioError && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              {portfolioError}
            </div>
          )}

          {portfolioLoading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />
              <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />
            </div>
          ) : portfolio.length === 0 ? (
            <EmptyState
              title="No account companies found"
              description="The current company has not been linked into the account registry yet."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {portfolio.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  switching={switching}
                  onSwitch={switchCompany}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="flex items-center gap-2 pt-2">
        <Building2 className="h-5 w-5" />
        <div>
          <div className="font-semibold">
            Current company detail
          </div>
          <div className="text-xs text-muted-foreground">
            The section below is the full workforce hierarchy for the company currently open.
          </div>
        </div>
      </div>

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
