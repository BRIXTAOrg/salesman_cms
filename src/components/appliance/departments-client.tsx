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

              defaultAuthority:
                newAuthority,
            }),
        },
      );

      setNewName("");
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
        eyebrow="Management"
        title="Departments"
        description="Create company Departments once, then use them as simple approval/review destinations inside any Responsibility."
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
          Create Department
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

          <Field label="Default authority">
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

        <div className="mt-4 flex justify-end">
          <PrimaryButton
            type="button"
            disabled={saving}
            onClick={() =>
              void create()
            }
          >
            Create Department
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
                        {
                          department.memberCount ??
                          0
                        }{" "}
                        member(s)
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

                <div className="mt-4">
                  <Field label="Default authority">
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
