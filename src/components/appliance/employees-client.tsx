"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  UserRound,
} from "lucide-react";

import type {
  Employee,
  EmployeeDetail,
  ReportingPolicy,
  ReportingSnapshot,
  Role,
} from "@/lib/appliance-types";
import {
  apiJson,
  formatWhen,
} from "./client";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableReusable } from "@/components/data-table-reusable";
import { SearchSelect } from "@/components/search-select";
import { MultiSelect } from "@/components/multi-select";
import ReportingPolicyEditor from "./reporting-policy-editor";
import RolesVNextClient from "./roles-vnext-client";
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
} from "./primitives";

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SectionHeading({ children }: { children: string }) {
  return (
    <div className="pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:pt-0">
      {children}
    </div>
  );
}

export default function EmployeesClient() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [roles, setRoles] =
    useState<Role[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [query, setQuery] =
    useState("");
  const [department, setDepartment] =
    useState("all");
  const [message, setMessage] =
    useState<string | null>(null);

  const [peopleTab, setPeopleTab] =
    useState<"employees" | "roles">("employees");

  const [showCreate, setShowCreate] =
    useState(false);
  const [createDepartments, setCreateDepartments] =
    useState<string[]>([]);
  const [createDesignation, setCreateDesignation] =
    useState("");
  const [selectedId, setSelectedId] =
    useState<number | null>(null);
  const [detail, setDetail] =
    useState<EmployeeDetail | null>(null);
  const [editDepartments, setEditDepartments] =
    useState<string[]>([]);
  const [editDesignation, setEditDesignation] =
    useState("");
  const [roleIds, setRoleIds] =
    useState<number[]>([]);

  const [
    createReportingPolicy,
    setCreateReportingPolicy,
  ] = useState<ReportingPolicy>({
    version: 1,
    mode: "unset",
  });

  const [
    editReportingPolicy,
    setEditReportingPolicy,
  ] = useState<ReportingPolicy>({
    version: 1,
    mode: "unset",
  });

  const [
    reportingSnapshot,
    setReportingSnapshot,
  ] = useState<ReportingSnapshot | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [employeeBody, roleBody] = await Promise.all([
        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),
        apiJson<{ roles: Role[] }>(
          "/api/appliance/roles",
        ),
      ]);

      setEmployees(employeeBody.employees ?? []);
      setRoles(roleBody.roles ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setSelectedId(id);
    setDetail(null);
    setMessage(null);

    try {
      const body = await apiJson<EmployeeDetail>(
        `/api/appliance/employees/${id}`,
      );
      setDetail(body);
      setRoleIds(body.directRoleIds ?? []);
      setEditDepartments(
        body.employee.department
          ? body.employee.department
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      );
      setEditDesignation(body.employee.designation ?? "");

      setEditReportingPolicy(
        body.reporting?.policy ?? {
          version: 1,
          mode:
            body.employee.reportsToId
              ? "specific_user"
              : "unset",
          userId:
            body.employee.reportsToId ??
            undefined,
        },
      );

      setReportingSnapshot(
        body.reporting ??
        null,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load employee.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const departments = useMemo(
    () => [...new Set(
      employees
        .map((employee) => employee.department)
        .filter((value): value is string => Boolean(value)),
    )].sort(),
    [employees],
  );

  const jobRoleOptions = useMemo(
    () => [...new Set(
      roles
        .map((role) => role.jobRole)
        .filter((value): value is string => Boolean(value)),
    )]
      .sort()
      .map((value) => ({ label: value, value })),
    [roles],
  );

  const orgRoleOptions = useMemo(
    () => [...new Set(
      roles
        .map((role) => role.orgRole)
        .filter((value): value is string => Boolean(value)),
    )]
      .sort()
      .map((value) => ({ label: value, value })),
    [roles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return employees.filter((employee) => {
      const text = [
        employee.name,
        employee.username,
        employee.employeeCode,
        employee.department,
        employee.designation,
        employee.phoneNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!needle || text.includes(needle)) &&
        (department === "all" || employee.department === department)
      );
    });
  }, [employees, query, department]);

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        id: "employee",
        header: "Employee",
        accessorFn: (employee) => employee.name ?? employee.username ?? `Employee ${employee.id}`,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.name ?? row.original.username ?? `Employee ${row.original.id}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode ?? "No employee ID"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => row.original.department ?? "—",
      },
      {
        accessorKey: "designation",
        header: "Designation",
        cell: ({ row }) => row.original.designation ?? "—",
      },
      {
        id: "reportingRule",
        header: "Reporting Rule",
        cell: ({ row }) => {
          const policy =
            row.original.reportingPolicy;

          const mode =
            policy?.mode ??
            row.original.reportingMode ??
            "unset";

          if (mode === "top_level") {
            return (
              <div className="space-y-1">
                <div className="font-medium">
                  Top level
                </div>
                <div className="text-xs text-muted-foreground">
                  No direct manager
                </div>
              </div>
            );
          }

          if (mode === "specific_user") {
            const manager =
              employees.find(
                (employee) =>
                  employee.id ===
                  policy?.userId,
              );

            return (
              <div className="space-y-1">
                <div className="font-medium">
                  Specific employee
                </div>
                <div className="text-xs text-muted-foreground">
                  {manager?.name ??
                    manager?.employeeCode ??
                    (policy?.userId
                      ? `Employee ${policy.userId}`
                      : "Not selected")}
                </div>
              </div>
            );
          }

          if (mode === "role") {
            const role =
              roles.find(
                (item) =>
                  item.id ===
                  policy?.roleId,
              );

            const roleName =
              role?.label ??
              (
                [
                  role?.orgRole,
                  role?.jobRole,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                (
                  policy?.roleId
                    ? `Role ${policy.roleId}`
                    : "Role not selected"
                )
              );

            const scopeLabels:
              Record<string, string> = {
                same_department:
                  "Same department",

                same_area:
                  "Same area",

                same_zone:
                  "Same zone",

                same_department_area:
                  "Same department + area",

                same_department_zone:
                  "Same department + zone",

                organization:
                  "Entire organization",
              };

            return (
              <div className="space-y-1">
                <div className="font-medium">
                  {roleName}
                </div>

                <div className="text-xs text-muted-foreground">
                  {scopeLabels[
                    policy?.scope ??
                    "same_department"
                  ] ??
                    policy?.scope ??
                    "Same department"}
                </div>
              </div>
            );
          }

          return (
            <Pill tone="neutral">
              Not configured
            </Pill>
          );
        },
      },

      {
        id: "reportsTo",
        header: "Reports To",
        cell: ({ row }) => {
          const status =
            row.original.reportingStatus;

          if (status === "resolved") {
            return (
              <div className="space-y-1">
                <div className="font-medium">
                  {row.original
                    .reportingManagerName ??
                    "Resolved manager"}
                </div>

                <Pill tone="good">
                  Resolved
                </Pill>
              </div>
            );
          }

          if (status === "top_level") {
            return (
              <Pill tone="info">
                Top level
              </Pill>
            );
          }

          if (status === "no_match") {
            return (
              <Pill tone="neutral">
                No match
              </Pill>
            );
          }

          if (status === "ambiguous") {
            return (
              <Pill tone="danger">
                Ambiguous
              </Pill>
            );
          }

          if (status === "invalid") {
            return (
              <Pill tone="danger">
                Invalid rule
              </Pill>
            );
          }

          return (
            <Pill tone="neutral">
              Not configured
            </Pill>
          );
        },
      },
      {
        accessorKey: "directReportCount",
        header: "Team",
        cell: ({ row }) =>
          row.original
            .directReportCount ??
          0,
      },
      {
        accessorKey: "directResponsibilityCount",
        header: "Direct Responsibilities",
        cell: ({ row }) => row.original.directResponsibilityCount ?? 0,
      },
      {
        accessorKey: "lastSeenAt",
        header: "Last seen",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatWhen(row.original.lastSeenAt)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Pill
            tone={
              row.original.status === "active"
                ? "good"
                : row.original.status === "suspended"
                  ? "danger"
                  : "neutral"
            }
          >
            {row.original.status ?? "unknown"}
          </Pill>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="text-right">
            <SecondaryButton
              type="button"
              className="h-9"
              onClick={() => void loadDetail(row.original.id)}
            >
              Manage
            </SecondaryButton>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function createEmployee(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const data = new FormData(event.currentTarget);
    if (
      createReportingPolicy.mode === "unset"
    ) {
      setSaving(false);
      setMessage(
        "Choose a reporting method: Specific employee, Role + scope, or Top level.",
      );
      return;
    }

    const areaValue = String(data.get("area") ?? "").trim();
    const zoneValue = String(data.get("zone") ?? "").trim();

    const payload = {
      employeeCode: String(data.get("employeeCode") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      name: String(data.get("name") ?? "").trim(),
      department: createDepartments.length
        ? createDepartments.join(", ")
        : null,
      designation: createDesignation.trim() || null,
      phoneNumber: String(data.get("phoneNumber") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim() || null,
      // Role is not a separate UI field — it mirrors the selected
      // Designation and is only ever read from the database, never edited
      // directly.
      role: createDesignation.trim() || null,
      area: areaValue || "area",
      zone: zoneValue || "zone",
      reportingPolicy:
        createReportingPolicy,
      responsibilityIds: [],
      roleIds: [],
    };

    try {
      await apiJson("/api/appliance/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      setCreateDepartments([]);
      setCreateDesignation("");
      setCreateReportingPolicy({
        version: 1,
        mode: "unset",
      });
      setMessage(`${payload.name} was added.`);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateProfile(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!selectedId) return;

    setSaving(true);
    const data = new FormData(event.currentTarget);
    const managerRaw = String(data.get("reportsToId") ?? "");
    const areaValue = String(data.get("area") ?? "").trim();
    const zoneValue = String(data.get("zone") ?? "").trim();

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: String(data.get("name") ?? "").trim(),
            department: editDepartments.length
              ? editDepartments.join(", ")
              : null,
            designation: editDesignation.trim() || null,
            phoneNumber: String(data.get("phoneNumber") ?? "").trim() || null,
            email: String(data.get("email") ?? "").trim() || null,
            role: editDesignation.trim() || null,
            area: areaValue || "area",
            zone: zoneValue || "zone",
            reportingPolicy:
              editReportingPolicy,
          }),
        },
      );

      await Promise.all([
        load(),
        loadDetail(selectedId),
      ]);
      setMessage("Employee profile saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function previewReporting() {
    if (!selectedId) return;

    try {
      const body =
        await apiJson<ReportingSnapshot>(
          `/api/appliance/employees/${selectedId}/reporting-policy/preview`,
          {
            method: "POST",
            body: JSON.stringify({
              reportingPolicy:
                editReportingPolicy,
            }),
          },
        );

      setReportingSnapshot(body);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to preview reporting rule.",
      );
    }
  }

  async function saveRoles() {
    if (!selectedId) return;
    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}/roles`,
        {
          method: "PUT",
          body: JSON.stringify({ roleIds }),
        },
      );
      await loadDetail(selectedId);
      setMessage("Role assignments saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save roles.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(
    status: "active" | "inactive" | "suspended",
  ) {
    if (!selectedId) return;
    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}/status`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        },
      );
      await Promise.all([
        load(),
        loadDetail(selectedId),
      ]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change employee status.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!selectedId) return;
    const password = window.prompt(
      "Enter a new mobile password (minimum 6 characters).",
    );
    if (!password) return;

    setSaving(true);
    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ password }),
        },
      );
      setMessage("Mobile password reset.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset password.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (peopleTab === "roles") {
    return (
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPeopleTab("employees")}
            className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Employees
          </button>

          <button
            type="button"
            className="rounded-md border border-primary bg-primary/[0.06] px-3 py-2 text-sm font-medium"
          >
            Roles
          </button>
        </div>

        <RolesVNextClient />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-primary bg-primary/[0.06] px-3 py-2 text-sm font-medium"
        >
          Employees
        </button>

        <button
          type="button"
          onClick={() => setPeopleTab("roles")}
          className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Roles
        </button>
      </div>
      <PageIntro
        eyebrow="People"
        title="Employees"
        description="Identity and organization metadata live here. Responsibilities are assigned separately and Roles determine administrative/approval authority."
        action={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                setCreateDepartments([]);
                setCreateDesignation("");
                setCreateReportingPolicy({
                  version: 1,
                  mode: "unset",
                });
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add employee
            </PrimaryButton>
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employee, ID, department..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className={inputClass}
        >
          <option value="all">All departments</option>
          {departments.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Panel className="overflow-hidden p-0">
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="p-5">
          <EmptyState title="No employees found" />
        </Panel>
      ) : (
        <DataTableReusable columns={columns} data={filtered} />
      )}

      <Modal
        open={showCreate}
        title="Add employee"
        description="Create the mobile identity. Responsibilities can be assigned afterwards."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={createEmployee} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SectionHeading>Identity</SectionHeading>
            </div>
            <Field label="Full name">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phoneNumber" className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>

            <div className="md:col-span-2">
              <SectionHeading>Mobile login</SectionHeading>
            </div>
            <Field label="Employee ID" hint="Used as the login ID for the field app.">
              <input name="employeeCode" required className={inputClass} />
            </Field>
            <Field label="Initial mobile password">
              <input name="password" type="password" required minLength={6} className={inputClass} />
            </Field>

            <div className="md:col-span-2">
              <SectionHeading>Role</SectionHeading>
            </div>
            <Field label="Department" hint="Select one or more.">
              <MultiSelect
                options={jobRoleOptions}
                selectedValues={createDepartments}
                onValueChange={setCreateDepartments}
                placeholder="Search departments..."
              />
            </Field>
            <Field label="Designation">
              <SearchSelect
                options={orgRoleOptions}
                value={createDesignation}
                onChange={(next) => setCreateDesignation(next as string)}
                placeholder="Search designations..."
              />
            </Field>

            <div className="md:col-span-2">
              <SectionHeading>Location & reporting</SectionHeading>
            </div>
            <Field label="Area">
              <input
                name="area"
                placeholder="Area"
                className={inputClass}
                onInput={(event) => {
                  event.currentTarget.value = capitalizeFirst(
                    event.currentTarget.value,
                  );
                }}
              />
            </Field>
            <Field label="Zone">
              <input
                name="zone"
                placeholder="Zone"
                className={inputClass}
                onInput={(event) => {
                  event.currentTarget.value = capitalizeFirst(
                    event.currentTarget.value,
                  );
                }}
              />
            </Field>
            <div className="md:col-span-2">
              <ReportingPolicyEditor
                value={createReportingPolicy}
                onChange={setCreateReportingPolicy}
                employees={employees}
                roles={roles}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add employee
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedId)}
        title={detail?.employee.name ?? "Manage employee"}
        description="Profile, Roles and account status. Use Assignments to change direct Responsibilities."
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
          setReportingSnapshot(null);
        }}
        wide
      >
        {!detail ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <SectionHeading>Identity</SectionHeading>
                </div>
                <Field label="Name">
                  <input name="name" defaultValue={detail.employee.name ?? ""} className={inputClass} />
                </Field>
                <Field label="Phone">
                  <input name="phoneNumber" defaultValue={detail.employee.phoneNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={detail.employee.email ?? ""} className={inputClass} />
                </Field>

                <div className="md:col-span-2">
                  <SectionHeading>Role</SectionHeading>
                </div>
                <Field label="Department" hint="Select one or more.">
                  <MultiSelect
                    options={jobRoleOptions}
                    selectedValues={editDepartments}
                    onValueChange={setEditDepartments}
                    placeholder="Search departments..."
                  />
                </Field>
                <Field label="Designation">
                  <SearchSelect
                    options={orgRoleOptions}
                    value={editDesignation}
                    onChange={(next) => setEditDesignation(next as string)}
                    placeholder="Search designations..."
                  />
                </Field>

                <div className="md:col-span-2">
                  <SectionHeading>Location & reporting</SectionHeading>
                </div>
                <Field label="Area">
                  <input
                    name="area"
                    defaultValue={detail.employee.area ?? ""}
                    placeholder="Area"
                    className={inputClass}
                    onInput={(event) => {
                      event.currentTarget.value = capitalizeFirst(
                        event.currentTarget.value,
                      );
                    }}
                  />
                </Field>
                <Field label="Zone">
                  <input
                    name="zone"
                    defaultValue={detail.employee.zone ?? ""}
                    placeholder="Zone"
                    className={inputClass}
                    onInput={(event) => {
                      event.currentTarget.value = capitalizeFirst(
                        event.currentTarget.value,
                      );
                    }}
                  />
                </Field>
                <div className="md:col-span-2">
                  <ReportingPolicyEditor
                    value={editReportingPolicy}
                    onChange={(next) => {
                      setEditReportingPolicy(next);
                      setReportingSnapshot(null);
                    }}
                    employees={employees}
                    roles={roles}
                    subjectId={selectedId}
                    snapshot={reportingSnapshot}
                    onPreview={() =>
                      void previewReporting()
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <PrimaryButton type="submit" disabled={saving}>Save profile</PrimaryButton>
              </div>
            </form>

            <Panel className="bg-muted/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Responsibilities</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {detail.responsibilities.length} currently resolved for this employee.
                  </div>
                </div>
                <Link
                  href="/dashboard/workspace/assignments"
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Open Assignments
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.responsibilities.map((responsibility) => (
                  <Pill key={responsibility.id}>{responsibility.title}</Pill>
                ))}
              </div>
            </Panel>

            <Panel className="bg-muted/15">
              <div className="font-semibold">Authority Roles</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Workflow approval policies reference these stable Role IDs.
              </div>
              <div className="mt-4">
                <MultiSelect
                  options={roles.map((role) => ({
                    label: role.label,
                    value: String(role.id),
                  }))}
                  selectedValues={roleIds.map(String)}
                  onValueChange={(values) =>
                    setRoleIds(values.map(Number))
                  }
                  placeholder="Search roles..."
                />
              </div>
              <div className="mt-4 flex justify-end">
                <SecondaryButton type="button" onClick={() => void saveRoles()} disabled={saving}>
                  Save Roles
                </SecondaryButton>
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                <Pill tone={detail.employee.status === "active" ? "good" : "neutral"}>
                  {detail.employee.status ?? "unknown"}
                </Pill>
              </div>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={() => void resetPassword()} disabled={saving}>
                  <KeyRound className="h-4 w-4" />
                  Reset password
                </SecondaryButton>
                {detail.employee.status === "active" ? (
                  <SecondaryButton type="button" onClick={() => void setStatus("suspended")} disabled={saving}>
                    <ShieldOff className="h-4 w-4" />
                    Suspend
                  </SecondaryButton>
                ) : (
                  <PrimaryButton type="button" onClick={() => void setStatus("active")} disabled={saving}>
                    Activate
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}