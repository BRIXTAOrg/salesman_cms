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
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
  UserPlus,
} from "lucide-react";

type Capability = {
  id: number;
  key: string;
  title: string;
  type: string;
  description?: string | null;
  icon?: string | null;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

type Employee = {
  id: number;
  employeeCode?: string | null;
  name?: string | null;
  username?: string | null;
  department?: string | null;
  designation?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  area?: string | null;
  zone?: string | null;
  status?: string | null;
};

const CAPABILITY_TYPES = [
  {
    value: "form",
    label: "Form",
  },
  {
    value: "approval_queue",
    label: "Approval Queue",
  },
  {
    value: "tracking",
    label: "Tracking",
  },
  {
    value: "report",
    label: "Report",
  },
  {
    value: "checklist",
    label: "Checklist",
  },
  {
    value: "data_view",
    label: "Data View",
  },
  {
    value: "status_update",
    label: "Status Update",
  },
  {
    value: "upload",
    label: "Upload",
  },
  {
    value: "native",
    label: "Native Mobile Capability",
  },
] as const;

function capabilityKeyFromTitle(
  title: string,
) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function readJson(
  response: Response,
) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: "Invalid server response.",
    };
  }
}

export default function MobileWorkspace() {
  const [
    capabilities,
    setCapabilities,
  ] = useState<Capability[]>([]);

  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);

  const [
    selectedCapabilities,
    setSelectedCapabilities,
  ] = useState<number[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingCapability,
    setSavingCapability,
  ] = useState(false);

  const [
    savingEmployee,
    setSavingEmployee,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadWorkspace =
    useCallback(async () => {
      setLoading(true);
      setMessage(null);

      try {
        const [
          capabilityResponse,
          employeeResponse,
        ] = await Promise.all([
          fetch(
            "/api/mobileWorkspace/capabilities",
            {
              cache: "no-store",
            },
          ),
          fetch(
            "/api/mobileWorkspace/employees",
            {
              cache: "no-store",
            },
          ),
        ]);

        const capabilityBody =
          await readJson(
            capabilityResponse,
          );

        const employeeBody =
          await readJson(
            employeeResponse,
          );

        if (
          !capabilityResponse.ok
        ) {
          throw new Error(
            capabilityBody.error ??
              "Unable to load capabilities.",
          );
        }

        if (!employeeResponse.ok) {
          throw new Error(
            employeeBody.error ??
              "Unable to load employees.",
          );
        }

        setCapabilities(
          Array.isArray(
            capabilityBody.capabilities,
          )
            ? capabilityBody.capabilities
            : [],
        );

        setEmployees(
          Array.isArray(
            employeeBody.employees,
          )
            ? employeeBody.employees
            : [],
        );
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to load mobile workspace.",
        });
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeCapabilities =
    useMemo(
      () =>
        capabilities.filter(
          (capability) =>
            capability.isActive !==
            false,
        ),
      [capabilities],
    );

  async function createCapability(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSavingCapability(true);
    setMessage(null);

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const title = String(
      data.get("title") ?? "",
    ).trim();

    const type = String(
      data.get("type") ?? "",
    );

    const description = String(
      data.get("description") ?? "",
    ).trim();

    const icon = String(
      data.get("icon") ?? "",
    ).trim();

    const rawConfig = String(
      data.get("config") ?? "",
    ).trim();

    let config:
      | Record<string, unknown>
      | undefined;

    if (rawConfig) {
      try {
        const parsed =
          JSON.parse(rawConfig);

        if (
          !parsed ||
          typeof parsed !==
            "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error();
        }

        config = parsed;
      } catch {
        setMessage({
          type: "error",
          text:
            "Capability config must be a valid JSON object.",
        });
        setSavingCapability(false);
        return;
      }
    }

    try {
      const response =
        await fetch(
          "/api/mobileWorkspace/capabilities",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              key:
                capabilityKeyFromTitle(
                  title,
                ),
              title,
              type,
              description:
                description || null,
              icon: icon || null,
              config: config ?? {},
            }),
          },
        );

      const body =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to create responsibility.",
        );
      }

      form.reset();

      setMessage({
        type: "success",
        text: `Responsibility "${title}" created.`,
      });

      await loadWorkspace();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to create responsibility.",
      });
    } finally {
      setSavingCapability(false);
    }
  }

  async function createEmployee(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSavingEmployee(true);
    setMessage(null);

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const payload = {
      employeeCode: String(
        data.get("employeeCode") ??
          "",
      ).trim(),

      password: String(
        data.get("password") ?? "",
      ),

      name: String(
        data.get("name") ?? "",
      ).trim(),

      department: String(
        data.get("department") ??
          "",
      ).trim(),

      designation: String(
        data.get("designation") ??
          "",
      ).trim(),

      phoneNumber: String(
        data.get("phoneNumber") ??
          "",
      ).trim(),

      email: String(
        data.get("email") ?? "",
      ).trim(),

      role: String(
        data.get("role") ?? "",
      ).trim(),

      area: String(
        data.get("area") ?? "",
      ).trim(),

      zone: String(
        data.get("zone") ?? "",
      ).trim(),

      capabilityIds:
        selectedCapabilities,
    };

    try {
      const response =
        await fetch(
          "/api/mobileWorkspace/employees",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify(payload),
          },
        );

      const body =
        await readJson(response);

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to create employee.",
        );
      }

      form.reset();
      setSelectedCapabilities([]);

      setMessage({
        type: "success",
        text:
          `${payload.employeeCode} created with ` +
          `${selectedCapabilities.length} assigned responsibilit` +
          `${selectedCapabilities.length === 1 ? "y" : "ies"}.`,
      });

      await loadWorkspace();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to create employee.",
      });
    } finally {
      setSavingEmployee(false);
    }
  }

  function toggleCapability(
    capabilityId: number,
  ) {
    setSelectedCapabilities(
      (current) =>
        current.includes(
          capabilityId,
        )
          ? current.filter(
              (id) =>
                id !==
                capabilityId,
            )
          : [
              ...current,
              capabilityId,
            ],
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading mobile workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            <h3 className="text-xl font-semibold">
              Mobile Workspace
            </h3>
          </div>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Create any employee and assign exactly which responsibilities
            appear after they log into the mobile app.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadWorkspace()
          }
          className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={
            message.type ===
            "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={
            createCapability
          }
          className="space-y-4 rounded-xl border bg-background p-5"
        >
          <div>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              <h4 className="text-lg font-semibold">
                Create Responsibility
              </h4>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Responsibilities are reusable. Job titles do not control the
              mobile app; assigned capabilities do.
            </p>
          </div>

          <Field
            label="Responsibility name"
            name="title"
            placeholder="Approve Shipments"
            required
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Capability type
            </span>

            <select
              name="type"
              required
              defaultValue="form"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {CAPABILITY_TYPES.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <Field
            label="Icon key (optional)"
            name="icon"
            placeholder="local_shipping"
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Description
            </span>

            <textarea
              name="description"
              rows={3}
              placeholder="What this responsibility lets the employee do"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Config JSON (optional)
            </span>

            <textarea
              name="config"
              rows={6}
              placeholder={'{\n  "fields": []\n}'}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
            />

            <span className="block text-xs text-muted-foreground">
              Flow 1 stores this configuration. Later generic form,
              approval and tracking engines will consume it.
            </span>
          </label>

          <button
            type="submit"
            disabled={
              savingCapability
            }
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {savingCapability ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}

            Create Responsibility
          </button>
        </form>

        <form
          onSubmit={createEmployee}
          className="space-y-4 rounded-xl border bg-background p-5"
        >
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <h4 className="text-lg font-semibold">
                Create Mobile Employee
              </h4>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Department, designation and role are free-form. The selected
              responsibilities decide what appears in the app.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Employee ID"
              name="employeeCode"
              placeholder="SS-1001"
              required
            />

            <Field
              label="Initial password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />

            <Field
              label="Full name"
              name="name"
              placeholder="Rakesh Kumar"
              required
            />

            <Field
              label="Department"
              name="department"
              placeholder="Distribution"
            />

            <Field
              label="Designation"
              name="designation"
              placeholder="Super Stockist"
            />

            <Field
              label="Role code (optional)"
              name="role"
              placeholder="SUPER_STOCKIST"
            />

            <Field
              label="Phone"
              name="phoneNumber"
              placeholder="9876543210"
            />

            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="employee@company.com"
            />

            <Field
              label="Area"
              name="area"
              placeholder="Guwahati"
            />

            <Field
              label="Zone"
              name="zone"
              placeholder="North East"
            />
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-sm font-medium">
                Responsibilities shown in app
              </div>

              <div className="text-xs text-muted-foreground">
                Select any combination. These are sent to the backend as
                capability assignments.
              </div>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
              {activeCapabilities.length ===
              0 ? (
                <div className="py-5 text-center text-sm text-muted-foreground">
                  Create a responsibility first.
                </div>
              ) : (
                activeCapabilities.map(
                  (
                    capability,
                  ) => {
                    const selected =
                      selectedCapabilities.includes(
                        capability.id,
                      );

                    return (
                      <label
                        key={
                          capability.id
                        }
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={
                            selected
                          }
                          onChange={() =>
                            toggleCapability(
                              capability.id,
                            )
                          }
                          className="mt-1"
                        />

                        <span className="min-w-0">
                          <span className="block font-medium">
                            {
                              capability.title
                            }
                          </span>

                          <span className="block text-xs text-muted-foreground">
                            {
                              capability.type
                            }{" "}
                            ·{" "}
                            {
                              capability.key
                            }
                          </span>

                          {capability.description && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {
                                capability.description
                              }
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  },
                )
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={
              savingEmployee
            }
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {savingEmployee ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}

            Create Employee
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-background p-5">
          <h4 className="text-lg font-semibold">
            Available Responsibilities
          </h4>

          <p className="mt-1 text-sm text-muted-foreground">
            {capabilities.length} configured capability
            {capabilities.length === 1
              ? ""
              : "ies"}
          </p>

          <div className="mt-4 space-y-2">
            {capabilities.length ===
            0 ? (
              <EmptyText>
                No responsibilities created yet.
              </EmptyText>
            ) : (
              capabilities.map(
                (
                  capability,
                ) => (
                  <div
                    key={
                      capability.id
                    }
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                    <div className="min-w-0">
                      <div className="font-medium">
                        {
                          capability.title
                        }
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {
                          capability.type
                        }{" "}
                        ·{" "}
                        {
                          capability.key
                        }
                      </div>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-background p-5">
          <h4 className="text-lg font-semibold">
            Mobile Employees
          </h4>

          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length} employee
            {employees.length === 1
              ? ""
              : "s"}{" "}
            currently enabled for the mobile app
          </p>

          <div className="mt-4 space-y-2">
            {employees.length ===
            0 ? (
              <EmptyText>
                No mobile employees created yet.
              </EmptyText>
            ) : (
              employees.map(
                (employee) => (
                  <div
                    key={
                      employee.id
                    }
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {employee.name ??
                            employee.username ??
                            employee.employeeCode ??
                            `Employee ${employee.id}`}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {[
                            employee.employeeCode,
                            employee.department,
                            employee.designation,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              " · ",
                            )}
                        </div>
                      </div>

                      <span
                        className={
                          employee.status ===
                          "active"
                            ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {employee.status ??
                          "unknown"}
                      </span>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        placeholder={
          placeholder
        }
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      />
    </label>
  );
}

function EmptyText({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
