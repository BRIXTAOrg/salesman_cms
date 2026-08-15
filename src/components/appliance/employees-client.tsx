
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Smartphone,
  UserRound,
} from "lucide-react";

import type {
  Capability,
  Employee,
  EmployeeDetail,
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
  const [capabilities, setCapabilities] =
    useState<Capability[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [query, setQuery] =
    useState("");
  const [department, setDepartment] =
    useState("all");
  const [showCreate, setShowCreate] =
    useState(false);
  const [selectedId, setSelectedId] =
    useState<number | null>(null);
  const [detail, setDetail] =
    useState<EmployeeDetail | null>(
      null,
    );
  const [directIds, setDirectIds] =
    useState<number[]>([]);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [employeeBody, capabilityBody] =
        await Promise.all([
          apiJson<{
            success: boolean;
            employees: Employee[];
          }>("/api/appliance/employees"),
          apiJson<{
            success: boolean;
            capabilities: Capability[];
          }>("/api/appliance/capabilities"),
        ]);

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
          : "Unable to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetail(null);

      try {
        const body =
          await apiJson<EmployeeDetail & {
            success: boolean;
          }>(
            `/api/appliance/employees/${id}`,
          );

        setDetail(body);
        setDirectIds(
          body.directCapabilityIds ?? [],
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employee.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map(
              (employee) =>
                employee.department,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      ).sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const needle =
      query.trim().toLowerCase();

    return employees.filter(
      (employee) => {
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
          (!needle ||
            text.includes(needle)) &&
          (department === "all" ||
            employee.department ===
              department)
        );
      },
    );
  }, [
    employees,
    query,
    department,
  ]);

  async function createEmployee(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const data = new FormData(
      event.currentTarget,
    );

    const managerRaw = String(
      data.get("reportsToId") ?? "",
    );

    const payload = {
      employeeCode: String(
        data.get("employeeCode") ?? "",
      ).trim(),
      password: String(
        data.get("password") ?? "",
      ),
      name: String(
        data.get("name") ?? "",
      ).trim(),
      department:
        String(
          data.get("department") ?? "",
        ).trim() || null,
      designation:
        String(
          data.get("designation") ?? "",
        ).trim() || null,
      phoneNumber:
        String(
          data.get("phoneNumber") ?? "",
        ).trim() || null,
      email:
        String(
          data.get("email") ?? "",
        ).trim() || null,
      role:
        String(
          data.get("role") ?? "",
        ).trim() || null,
      area:
        String(
          data.get("area") ?? "",
        ).trim() || null,
      zone:
        String(
          data.get("zone") ?? "",
        ).trim() || null,
      reportsToId: managerRaw
        ? Number(managerRaw)
        : null,
      capabilityIds: [],
    };

    try {
      await apiJson(
        "/api/appliance/employees",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setShowCreate(false);
      setMessage(
        `${payload.name} was added. You can assign responsibilities from their profile.`,
      );
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
    const data = new FormData(
      event.currentTarget,
    );

    const managerRaw = String(
      data.get("reportsToId") ?? "",
    );

    const payload = {
      name: String(
        data.get("name") ?? "",
      ).trim(),
      department:
        String(
          data.get("department") ?? "",
        ).trim() || null,
      designation:
        String(
          data.get("designation") ?? "",
        ).trim() || null,
      phoneNumber:
        String(
          data.get("phoneNumber") ?? "",
        ).trim() || null,
      email:
        String(
          data.get("email") ?? "",
        ).trim() || null,
      role:
        String(
          data.get("role") ?? "",
        ).trim() || null,
      area:
        String(
          data.get("area") ?? "",
        ).trim() || null,
      zone:
        String(
          data.get("zone") ?? "",
        ).trim() || null,
      reportsToId: managerRaw
        ? Number(managerRaw)
        : null,
    };

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
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
          : "Unable to save employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveResponsibilities() {
    if (!selectedId) return;

    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}/capabilities`,
        {
          method: "PUT",
          body: JSON.stringify({
            capabilityIds: directIds,
          }),
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
          : "Unable to save responsibilities.",
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
          body: JSON.stringify({
            status,
          }),
        },
      );

      await Promise.all([
        load(),
        loadDetail(selectedId),
      ]);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!selectedId) return;

    const password =
      window.prompt(
        "Enter a new mobile password (minimum 6 characters).",
      );

    if (!password) return;

    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/employees/${selectedId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({
            password,
          }),
        },
      );

      setMessage(
        "Password reset. Registered devices were revoked for safety.",
      );
      await loadDetail(selectedId);
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

  const activeCapabilities =
    capabilities.filter(
      (capability) =>
        capability.isActive !== false,
    );

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workforce"
        title="Employees"
        description="People first. Their designation describes who they are; responsibilities decide what they can do in the mobile app."
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
              Add employee
            </PrimaryButton>
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="flex h-11 items-center gap-2 rounded-xl border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search employee, ID, department..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <select
          value={department}
          onChange={(event) =>
            setDepartment(
              event.target.value,
            )
          }
          className={inputClass}
        >
          <option value="all">
            All departments
          </option>
          {departments.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ),
          )}
        </select>
      </div>

      <Panel className="overflow-hidden p-0">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No employees found"
              description="Add an employee or change the filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/45 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    Employee
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Department
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Designation
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Responsibilities
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Last seen
                  </th>
                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(
                  (employee) => (
                    <tr
                      key={employee.id}
                      className="hover:bg-muted/25"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {employee.name ??
                            employee.username ??
                            `Employee ${employee.id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.employeeCode ??
                            "No employee ID"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {employee.department ??
                          "—"}
                      </td>
                      <td className="px-5 py-4">
                        {employee.designation ??
                          "—"}
                      </td>
                      <td className="px-5 py-4">
                        {employee.directResponsibilityCount ??
                          0}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {formatWhen(
                          employee.lastSeenAt,
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Pill
                          tone={
                            employee.status ===
                            "active"
                              ? "good"
                              : employee.status ===
                                  "suspended"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {employee.status ??
                            "unknown"}
                        </Pill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <SecondaryButton
                          type="button"
                          onClick={() =>
                            void loadDetail(
                              employee.id,
                            )
                          }
                          className="h-9"
                        >
                          Manage
                        </SecondaryButton>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={showCreate}
        title="Add employee"
        description="Only the basics are required. Organization detail can grow later."
        onClose={() =>
          setShowCreate(false)
        }
        wide
      >
        <form
          onSubmit={createEmployee}
          className="space-y-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee ID">
              <input
                name="employeeCode"
                required
                placeholder="EMP-1024"
                className={inputClass}
              />
            </Field>
            <Field label="Initial mobile password">
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className={inputClass}
              />
            </Field>
            <Field label="Full name">
              <input
                name="name"
                required
                placeholder="Rakesh Kumar"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                name="phoneNumber"
                placeholder="9876543210"
                className={inputClass}
              />
            </Field>
            <Field label="Department">
              <input
                name="department"
                placeholder="Distribution"
                className={inputClass}
              />
            </Field>
            <Field label="Designation">
              <input
                name="designation"
                placeholder="Super Stockist"
                className={inputClass}
              />
            </Field>
            <Field
              label="Role code"
              hint="Optional internal label; it does not decide the mobile workspace."
            >
              <input
                name="role"
                placeholder="EMPLOYEE"
                className={inputClass}
              />
            </Field>
            <Field label="Reports to">
              <select
                name="reportsToId"
                className={inputClass}
                defaultValue=""
              >
                <option value="">
                  No manager
                </option>
                {employees.map(
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
                        employee.employeeCode ??
                        employee.id}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                className={inputClass}
              />
            </Field>
            <Field label="Area">
              <input
                name="area"
                className={inputClass}
              />
            </Field>
            <Field label="Zone">
              <input
                name="zone"
                className={inputClass}
              />
            </Field>
          </div>

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
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create employee
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={selectedId !== null}
        title={
          detail?.employee.name ??
          detail?.employee
            .employeeCode ??
          "Employee"
        }
        description={
          detail
            ? [
                detail.employee
                  .employeeCode,
                detail.employee
                  .department,
                detail.employee
                  .designation,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Loading employee..."
        }
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
        }}
        wide
      >
        {!detail ? (
          <div className="flex min-h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Pill
                tone={
                  detail.employee.status ===
                  "active"
                    ? "good"
                    : detail.employee.status ===
                        "suspended"
                      ? "danger"
                      : "neutral"
                }
              >
                {detail.employee.status}
              </Pill>

              <Pill tone="info">
                Last seen{" "}
                {formatWhen(
                  detail.runtime
                    ?.lastSeenAt,
                )}
              </Pill>

              <Pill>
                {detail.capabilities.length}{" "}
                responsibility
                {detail.capabilities.length ===
                1
                  ? ""
                  : "ies"}
              </Pill>
            </div>

            <Panel>
              <div className="mb-4 flex items-center gap-2 font-semibold">
                <UserRound className="h-4 w-4" />
                Profile
              </div>

              <form
                onSubmit={updateProfile}
                className="grid gap-4 md:grid-cols-2"
              >
                <Field label="Name">
                  <input
                    name="name"
                    defaultValue={
                      detail.employee
                        .name ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    name="phoneNumber"
                    defaultValue={
                      detail.employee
                        .phoneNumber ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Department">
                  <input
                    name="department"
                    defaultValue={
                      detail.employee
                        .department ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Designation">
                  <input
                    name="designation"
                    defaultValue={
                      detail.employee
                        .designation ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Role code">
                  <input
                    name="role"
                    defaultValue={
                      detail.employee
                        .role ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Reports to">
                  <select
                    name="reportsToId"
                    defaultValue={
                      detail.employee
                        .reportsToId
                        ? String(
                            detail
                              .employee
                              .reportsToId,
                          )
                        : ""
                    }
                    className={inputClass}
                  >
                    <option value="">
                      No manager
                    </option>
                    {employees
                      .filter(
                        (employee) =>
                          employee.id !==
                          selectedId,
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
                              employee.employeeCode ??
                              employee.id}
                          </option>
                        ),
                      )}
                  </select>
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    defaultValue={
                      detail.employee
                        .email ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Area">
                  <input
                    name="area"
                    defaultValue={
                      detail.employee
                        .area ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Zone">
                  <input
                    name="zone"
                    defaultValue={
                      detail.employee
                        .zone ??
                      ""
                    }
                    className={inputClass}
                  />
                </Field>

                <div className="md:col-span-2 flex justify-end">
                  <PrimaryButton
                    type="submit"
                    disabled={saving}
                  >
                    Save profile
                  </PrimaryButton>
                </div>
              </form>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel>
                <div className="mb-1 font-semibold">
                  Responsibilities
                </div>
                <div className="mb-4 text-sm text-muted-foreground">
                  Check exactly what should appear in this employee's app. Inherited rules are shown in the preview after saving.
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {activeCapabilities.map(
                    (capability) => (
                      <label
                        key={
                          capability.id
                        }
                        className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={directIds.includes(
                            capability.id,
                          )}
                          onChange={() =>
                            setDirectIds(
                              (current) =>
                                current.includes(
                                  capability.id,
                                )
                                  ? current.filter(
                                      (
                                        id,
                                      ) =>
                                        id !==
                                        capability.id,
                                    )
                                  : [
                                      ...current,
                                      capability.id,
                                    ],
                            )
                          }
                        />
                        <div>
                          <div className="font-medium">
                            {
                              capability.title
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {
                              capability.type
                            }
                          </div>
                        </div>
                      </label>
                    ),
                  )}
                </div>

                <PrimaryButton
                  type="button"
                  onClick={() =>
                    void saveResponsibilities()
                  }
                  disabled={saving}
                  className="mt-4 w-full"
                >
                  Save responsibilities
                </PrimaryButton>
              </Panel>

              <Panel>
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <Smartphone className="h-4 w-4" />
                  App preview
                </div>
                <div className="mb-4 text-sm text-muted-foreground">
                  This mirrors what the employee receives from bootstrap.
                </div>

                <div className="rounded-[24px] border-4 border-foreground/80 bg-background p-4 shadow-inner">
                  <div className="text-sm font-semibold">
                    {detail.employee.name ??
                      "Employee"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      detail.employee
                        .department,
                      detail.employee
                        .designation,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>

                  <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    My responsibilities
                  </div>

                  <div className="mt-2 space-y-2">
                    {detail.capabilities.length ===
                    0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No responsibilities assigned
                      </div>
                    ) : (
                      detail.capabilities.map(
                        (
                          capability,
                        ) => (
                          <div
                            key={
                              capability.id
                            }
                            className="flex items-center gap-3 rounded-xl border bg-card p-3"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <div className="text-sm font-medium">
                              {
                                capability.title
                              }
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>
              </Panel>
            </div>

            <Panel>
              <div className="mb-4 font-semibold">
                Security & access
              </div>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    void resetPassword()
                  }
                >
                  <KeyRound className="h-4 w-4" />
                  Reset password
                </SecondaryButton>

                {detail.employee.status !==
                "active" ? (
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      void setStatus(
                        "active",
                      )
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Activate
                  </SecondaryButton>
                ) : (
                  <>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        void setStatus(
                          "inactive",
                        )
                      }
                    >
                      <ShieldOff className="h-4 w-4" />
                      Disable
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        void setStatus(
                          "suspended",
                        )
                      }
                    >
                      Suspend
                    </SecondaryButton>
                  </>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Disabling an employee preserves their history. Password reset revokes active devices.
              </div>
            </Panel>
          </div>
        )}
      </Modal>
    </div>
  );
}
