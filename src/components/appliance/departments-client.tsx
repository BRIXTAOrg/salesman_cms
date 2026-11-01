"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  Department,
  DepartmentAuthority,
  Employee,
  Role,
} from "@/lib/appliance-types";

import {
  apiJson,
} from "./client";

import {
  Field,
  inputClass,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

function authorityValue(
  authority:
    DepartmentAuthority,
) {
  if (
    authority.kind ===
    "employee"
  ) {
    return `employee:${authority.userId}`;
  }

  if (
    authority.kind ===
    "role"
  ) {
    return `role:${authority.roleId}`;
  }

  return "none";
}

function parseAuthority(
  value: string,
): DepartmentAuthority {
  if (
    value.startsWith(
      "employee:",
    )
  ) {
    const userId =
      Number(
        value.slice(
          "employee:".length,
        ),
      );

    return (
      Number.isInteger(
        userId,
      ) &&
      userId > 0
    )
      ? {
          kind:
            "employee",
          userId,
        }
      : {
          kind:
            "none",
        };
  }

  if (
    value.startsWith(
      "role:",
    )
  ) {
    const roleId =
      Number(
        value.slice(
          "role:".length,
        ),
      );

    return (
      Number.isInteger(
        roleId,
      ) &&
      roleId > 0
    )
      ? {
          kind:
            "role",
          roleId,
        }
      : {
          kind:
            "none",
        };
  }

  return {
    kind:
      "none",
  };
}

function employeeName(
  employee: Employee,
) {
  return (
    employee.name ??
    employee.employeeCode ??
    `Employee ${employee.id}`
  );
}

export default function DepartmentsClient() {
  const [
    departments,
    setDepartments,
  ] =
    useState<
      Department[]
    >([]);

  const [
    employees,
    setEmployees,
  ] =
    useState<
      Employee[]
    >([]);

  const [
    roles,
    setRoles,
  ] =
    useState<
      Role[]
    >([]);

  const [
    newName,
    setNewName,
  ] =
    useState("");

  const [newMaxMembers, setNewMaxMembers] = useState("");
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string,string>>({});
  const [memberDrafts, setMemberDrafts] = useState<Record<string,string>>({});
  const [
    newAuthority,
    setNewAuthority,
  ] =
    useState<
      DepartmentAuthority
    >({
      kind:
        "none",
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const [
            departmentBody,
            employeeBody,
            roleBody,
          ] =
            await Promise.all([
              apiJson<{
                departments:
                  Department[];
              }>(
                "/api/appliance/departments",
              ),

              apiJson<{
                employees:
                  Employee[];
              }>(
                "/api/appliance/employees",
              ),

              apiJson<{
                roles:
                  Role[];
              }>(
                "/api/platform/roles",
              ),
            ]);

          setDepartments(
            departmentBody
              .departments ??
            [],
          );

          setEmployees(
            employeeBody
              .employees ??
            [],
          );

          setRoles(
            roleBody.roles ??
            [],
          );
        } catch (
          error
        ) {
          setMessage(
            error instanceof
              Error
              ? error.message
              : "Unable to load Departments.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      void load();
    },
    [load],
  );

  async function create() {
    const name =
      newName.trim();

    if (!name) {
      setMessage(
        "Give the Department a name.",
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        "/api/appliance/departments",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              name,
              maxMembers: newMaxMembers.trim() ? Number(newMaxMembers) : null,

              defaultAuthority:
                newAuthority,
            }),
        },
      );

      setNewName("");
      setNewMaxMembers("");
      setNewAuthority({
        kind:
          "none",
      });

      setMessage(
        `${name} created.`,
      );

      await load();
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to create Department.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateCapacity(department: Department) {
    const raw = capacityDrafts[department.id] ?? String(department.maxMembers ?? "");
    const capacity = raw.trim() ? Number(raw) : null;
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000)) {
      setMessage("Use a whole number between 1 and 100000, or leave blank for unlimited."); return;
    }
    setSaving(true);setMessage(null);
    try {
      await apiJson(`/api/appliance/departments/${encodeURIComponent(department.id)}`, {
        method:"PATCH",body:JSON.stringify({maxMembers:capacity}),
      });
      await load(); setMessage(`${department.name} team size updated.`);
    } catch(e) { setMessage(e instanceof Error?e.message:"Could not update capacity."); }
    finally {setSaving(false);}
  }

  async function assignMember(department:Department) {
    const id=Number(memberDrafts[department.id]);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    if (department.maxMembers !== null && department.maxMembers !== undefined &&
        (department.memberCount ?? 0) >= department.maxMembers) {
      setMessage("This department is full. Increase the team size before adding another person.");return;
    }
    setSaving(true);setMessage(null);
    try {
      await apiJson(`/api/appliance/employees/${id}`,{method:"PATCH",body:JSON.stringify({department:department.name})});
      setMemberDrafts(s=>({...s,[department.id]:""}));
      await load();setMessage("Employee assigned to department. Their reporting manager was not changed.");
    } catch(e) {setMessage(e instanceof Error?e.message:"Could not assign employee.");}
    finally {setSaving(false);}
  }

  async function updateAuthority(
    department:
      Department,
    value:
      string,
  ) {
    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        `/api/appliance/departments/${encodeURIComponent(
          department.id,
        )}`,
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              defaultAuthority:
                parseAuthority(
                  value,
                ),
            }),
        },
      );

      setMessage(
        `${department.name} authority updated.`,
      );

      await load();
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to update Department.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(
    department:
      Department,
  ) {
    if (
      !window.confirm(
        `Delete ${department.name}?`,
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/departments/${encodeURIComponent(
          department.id,
        )}`,
        {
          method:
            "DELETE",
        },
      );

      await load();
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to delete Department.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resolvedNames(
    department:
      Department,
  ) {
    const ids =
      department
        .resolvedUserIds ??
      [];

    return ids
      .map(
        (id) =>
          employees.find(
            (employee) =>
              employee.id ===
              id,
          ),
      )
      .filter(
        (
          employee,
        ): employee is Employee =>
          Boolean(employee),
      )
      .map(
        employeeName,
      );
  }

  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.status !==
          "inactive" &&
        employee.status !==
          "suspended",
    );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        title="Departments"
        description="Set up your departments once. Responsibilities can then send approvals and reviews to a department."
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="font-semibold">
          Create department
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          The default authority is who receives a Responsibility when that Responsibility says “send this to this Department”.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Department name">
            <input
              className={inputClass}
              value={newName}
              onChange={(event) =>
                setNewName(
                  event.target
                    .value,
                )
              }
              placeholder="Sales / Finance / HR / Procurement"
            />
          </Field>

          <Field label="Person responsible / workflow authority">
            <select
              className={inputClass}
              value={authorityValue(
                newAuthority,
              )}
              onChange={(event) =>
                setNewAuthority(
                  parseAuthority(
                    event.target
                      .value,
                  ),
                )
              }
            >
              <option value="none">
                Configure later
              </option>

              <optgroup label="Specific employee">
                {activeEmployees.map(
                  (
                    employee,
                  ) => (
                    <option
                      key={`employee:${employee.id}`}
                      value={`employee:${employee.id}`}
                    >
                      {employeeName(
                        employee,
                      )}
                    </option>
                  ),
                )}
              </optgroup>

              <optgroup label="Authority Role">
                {roles.map(
                  (role) => (
                    <option
                      key={`role:${role.id}`}
                      value={`role:${role.id}`}
                    >
                      {role.label}
                    </option>
                  ),
                )}
              </optgroup>
            </select>
          </Field>
        </div>

        <div className="mt-4 max-w-xs">
          <Field label="Planned team size / capacity (optional)">
            <input className={inputClass} type="number" min={1} max={100000} placeholder="Unlimited"
              value={newMaxMembers} onChange={e=>setNewMaxMembers(e.target.value)}/>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <PrimaryButton
            type="button"
            disabled={saving}
            onClick={() =>
              void create()
            }
          >
            Create department
          </PrimaryButton>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {departments.map(
          (
            department,
          ) => {
            const resolved =
              resolvedNames(
                department,
              );

            return (
              <Panel
                key={
                  department.id
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">
                      {
                        department.name
                      }
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2">
                                  <Pill>
                         {department.memberCount ?? 0} / {department.maxMembers ?? "unlimited"} members
                       </Pill>

                      {resolved.length >
                      0 ? (
                        <Pill tone="good">
                          Authority resolved
                        </Pill>
                      ) : (
                        <Pill tone="neutral">
                          Authority unresolved
                        </Pill>
                      )}
                    </div>
                  </div>

                  <SecondaryButton
                    type="button"
                    disabled={
                      saving ||
                      (
                        department.memberCount ??
                        0
                      ) >
                        0
                    }
                    onClick={() =>
                      void remove(
                        department,
                      )
                    }
                  >
                    Delete
                  </SecondaryButton>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Team size (blank = unlimited)">
                    <div className="flex gap-2">
                      <input className={inputClass} type="number" min={1} max={100000}
                        value={capacityDrafts[department.id] ?? String(department.maxMembers ?? "")}
                        onChange={e=>setCapacityDrafts(x=>({...x,[department.id]:e.target.value}))}/>
                      <SecondaryButton type="button" disabled={saving} onClick={()=>void updateCapacity(department)}>Save</SecondaryButton>
                    </div>
                  </Field>
                  <Field label="Assign an existing employee">
                    <div className="flex gap-2">
                      <select className={inputClass} value={memberDrafts[department.id] ?? ""}
                        onChange={e=>setMemberDrafts(x=>({...x,[department.id]:e.target.value}))}>
                        <option value="">Choose employee</option>
                        {activeEmployees.filter(e=>!String(e.department??"").split(",").map(x=>x.trim()).includes(department.name))
                          .map(e=><option key={e.id} value={e.id}>{employeeName(e)}</option>)}
                      </select>
                      <SecondaryButton type="button" disabled={saving} onClick={()=>void assignMember(department)}>Assign</SecondaryButton>
                    </div>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Person responsible / workflow authority">
                    <select
                      className={inputClass}
                      value={authorityValue(
                        department
                          .defaultAuthority,
                      )}
                      onChange={(event) =>
                        void updateAuthority(
                          department,
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="none">
                        Not configured
                      </option>

                      <optgroup label="Specific employee">
                        {activeEmployees.map(
                          (
                            employee,
                          ) => (
                            <option
                              key={`employee:${employee.id}`}
                              value={`employee:${employee.id}`}
                            >
                              {employeeName(
                                employee,
                              )}
                            </option>
                          ),
                        )}
                      </optgroup>

                      <optgroup label="Authority Role">
                        {roles.map(
                          (role) => (
                            <option
                              key={`role:${role.id}`}
                              value={`role:${role.id}`}
                            >
                              {
                                role.label
                              }
                            </option>
                          ),
                        )}
                      </optgroup>
                    </select>
                  </Field>
                </div>

                <div className="mt-4 rounded-lg border bg-muted/10 p-3">
                  <div className="text-xs font-medium">
                    Currently resolves to
                  </div>

                  <div className="mt-1 text-sm">
                    {resolved.length
                      ? resolved.join(
                          ", ",
                        )
                      : "Nobody yet"}
                  </div>
                </div>
              </Panel>
            );
          },
        )}
      </div>

      {!loading &&
        departments.length ===
          0 && (
          <Panel>
            <div className="text-sm text-muted-foreground">
              No Departments yet.
            </div>
          </Panel>
        )}
    </div>
  );
}
