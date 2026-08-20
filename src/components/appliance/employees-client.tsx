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
  Role,
} from "@/lib/appliance-types";
import {
  apiJson,
  formatWhen,
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
} from "./primitives";

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

  const [showCreate, setShowCreate] =
    useState(false);
  const [selectedId, setSelectedId] =
    useState<number | null>(null);
  const [detail, setDetail] =
    useState<EmployeeDetail | null>(null);
  const [roleIds, setRoleIds] =
    useState<number[]>([]);

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

  async function createEmployee(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const data = new FormData(event.currentTarget);
    const managerRaw = String(data.get("reportsToId") ?? "");

    const payload = {
      employeeCode: String(data.get("employeeCode") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      name: String(data.get("name") ?? "").trim(),
      department: String(data.get("department") ?? "").trim() || null,
      designation: String(data.get("designation") ?? "").trim() || null,
      phoneNumber: String(data.get("phoneNumber") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim() || null,
      role: String(data.get("role") ?? "").trim() || null,
      area: String(data.get("area") ?? "").trim() || null,
      zone: String(data.get("zone") ?? "").trim() || null,
      reportsToId: managerRaw ? Number(managerRaw) : null,
      responsibilityIds: [],
      roleIds: [],
    };

    try {
      await apiJson("/api/appliance/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
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

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: String(data.get("name") ?? "").trim(),
            department: String(data.get("department") ?? "").trim() || null,
            designation: String(data.get("designation") ?? "").trim() || null,
            phoneNumber: String(data.get("phoneNumber") ?? "").trim() || null,
            email: String(data.get("email") ?? "").trim() || null,
            role: String(data.get("role") ?? "").trim() || null,
            area: String(data.get("area") ?? "").trim() || null,
            zone: String(data.get("zone") ?? "").trim() || null,
            reportsToId: managerRaw ? Number(managerRaw) : null,
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

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
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
            <PrimaryButton type="button" onClick={() => setShowCreate(true)}>
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

      <Panel className="overflow-hidden p-0">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No employees found" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/45 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Designation</th>
                  <th className="px-5 py-3 font-medium">Direct Responsibilities</th>
                  <th className="px-5 py-3 font-medium">Last seen</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((employee) => (
                  <tr key={employee.id} className="hover:bg-muted/25">
                    <td className="px-5 py-4">
                      <div className="font-medium">
                        {employee.name ?? employee.username ?? `Employee ${employee.id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {employee.employeeCode ?? "No employee ID"}
                      </div>
                    </td>
                    <td className="px-5 py-4">{employee.department ?? "—"}</td>
                    <td className="px-5 py-4">{employee.designation ?? "—"}</td>
                    <td className="px-5 py-4">{employee.directResponsibilityCount ?? 0}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatWhen(employee.lastSeenAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Pill
                        tone={
                          employee.status === "active"
                            ? "good"
                            : employee.status === "suspended"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {employee.status ?? "unknown"}
                      </Pill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <SecondaryButton
                        type="button"
                        className="h-9"
                        onClick={() => void loadDetail(employee.id)}
                      >
                        Manage
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={showCreate}
        title="Add employee"
        description="Create the mobile identity. Responsibilities can be assigned afterwards."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={createEmployee} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee ID">
              <input name="employeeCode" required className={inputClass} />
            </Field>
            <Field label="Initial mobile password">
              <input name="password" type="password" required minLength={6} className={inputClass} />
            </Field>
            <Field label="Full name">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phoneNumber" className={inputClass} />
            </Field>
            <Field label="Department">
              <input name="department" className={inputClass} />
            </Field>
            <Field label="Designation">
              <input name="designation" className={inputClass} />
            </Field>
            <Field label="Role label" hint="Business label only; approval authority uses Role IDs below.">
              <input name="role" className={inputClass} />
            </Field>
            <Field label="Reports to">
              <select name="reportsToId" className={inputClass} defaultValue="">
                <option value="">No manager</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name ?? employee.employeeCode ?? employee.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <Field label="Area">
              <input name="area" className={inputClass} />
            </Field>
            <Field label="Zone">
              <input name="zone" className={inputClass} />
            </Field>
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
                <Field label="Name">
                  <input name="name" defaultValue={detail.employee.name ?? ""} className={inputClass} />
                </Field>
                <Field label="Phone">
                  <input name="phoneNumber" defaultValue={detail.employee.phoneNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="Department">
                  <input name="department" defaultValue={detail.employee.department ?? ""} className={inputClass} />
                </Field>
                <Field label="Designation">
                  <input name="designation" defaultValue={detail.employee.designation ?? ""} className={inputClass} />
                </Field>
                <Field label="Role label">
                  <input name="role" defaultValue={detail.employee.role ?? ""} className={inputClass} />
                </Field>
                <Field label="Reports to">
                  <select
                    name="reportsToId"
                    defaultValue={detail.employee.reportsToId ? String(detail.employee.reportsToId) : ""}
                    className={inputClass}
                  >
                    <option value="">No manager</option>
                    {employees
                      .filter((employee) => employee.id !== selectedId)
                      .map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name ?? employee.employeeCode ?? employee.id}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={detail.employee.email ?? ""} className={inputClass} />
                </Field>
                <Field label="Area">
                  <input name="area" defaultValue={detail.employee.area ?? ""} className={inputClass} />
                </Field>
                <Field label="Zone">
                  <input name="zone" defaultValue={detail.employee.zone ?? ""} className={inputClass} />
                </Field>
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
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {roles.map((role) => {
                  const checked = roleIds.includes(role.id);
                  return (
                    <label key={role.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setRoleIds((current) =>
                            checked
                              ? current.filter((id) => id !== role.id)
                              : [...current, role.id],
                          )
                        }
                      />
                      {role.label}
                    </label>
                  );
                })}
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
