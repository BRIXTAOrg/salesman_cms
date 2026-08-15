
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Blocks,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from "lucide-react";

import type {
  Capability,
  CapabilityRule,
  Employee,
} from "@/lib/appliance-types";
import {
  apiJson,
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
  textareaClass,
} from "./primitives";

type BuilderField = {
  id: string;
  label: string;
  key: string;
  type: string;
  required: boolean;
};

const responsibilityTypes = [
  {
    value: "form",
    label: "Fill a form",
    description:
      "Collect structured information from the field.",
  },
  {
    value: "checklist",
    label: "Complete a checklist",
    description:
      "Step-by-step work with completion evidence.",
  },
  {
    value: "approval_queue",
    label: "Review & approve",
    description:
      "Give the employee an approval inbox.",
  },
  {
    value: "tracking",
    label: "Track something",
    description:
      "Follow shipment, stock or another moving process.",
  },
  {
    value: "data_view",
    label: "View data",
    description:
      "Read-only operational information.",
  },
  {
    value: "status_update",
    label: "Update status",
    description:
      "Simple state changes such as dispatched or received.",
  },
  {
    value: "report",
    label: "View report",
    description:
      "A responsibility that opens a report.",
  },
  {
    value: "upload",
    label: "Upload proof",
    description:
      "Photos, documents or other evidence.",
  },
  {
    value: "native",
    label: "Built-in app feature",
    description:
      "Attendance, GPS, maps, camera or another native engine.",
  },
] as const;

const fieldTypes = [
  "text",
  "number",
  "date",
  "choice",
  "photo",
  "file",
  "checkbox",
];

function keyFromLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldsFromCapability(
  capability: Capability,
): BuilderField[] {
  const raw = capability.config?.fields;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((field: any, index) => ({
    id: `${Date.now()}-${index}`,
    label: String(field?.label ?? field?.key ?? "Field"),
    key: String(field?.key ?? `field_${index + 1}`),
    type: String(field?.type ?? "text"),
    required: Boolean(field?.required),
  }));
}

function toConfig(
  type: string,
  fields: BuilderField[],
  key: string,
) {
  if (
    type === "form" ||
    type === "checklist"
  ) {
    return {
      fields: fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
      })),
    };
  }

  if (type === "native") {
    return {
      nativeKey: key,
    };
  }

  return {};
}

function BuilderFields({
  fields,
  setFields,
}: {
  fields: BuilderField[];
  setFields: Dispatch<
    SetStateAction<
      BuilderField[]
    >
  >;
}) {
  function addField() {
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "",
        key: "",
        type: "text",
        required: false,
      },
    ]);
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">
            Fields
          </div>
          <div className="text-xs text-muted-foreground">
            Build the screen visually. No JSON needed.
          </div>
        </div>
        <SecondaryButton
          type="button"
          onClick={addField}
          className="h-9"
        >
          <Plus className="h-4 w-4" />
          Add field
        </SecondaryButton>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          No fields yet.
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map(
            (field, index) => (
              <div
                key={field.id}
                className="grid gap-2 rounded-xl border bg-background p-3 md:grid-cols-[1.4fr_1fr_120px_auto_auto]"
              >
                <input
                  value={field.label}
                  onChange={(event) => {
                    const label =
                      event.target.value;

                    setFields((current) =>
                      current.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                label,
                                key:
                                  item.key ||
                                  keyFromLabel(
                                    label,
                                  ),
                              }
                            : item,
                      ),
                    );
                  }}
                  placeholder="Field label"
                  className={inputClass}
                />
                <input
                  value={field.key}
                  onChange={(event) =>
                    setFields((current) =>
                      current.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                key: keyFromLabel(
                                  event.target.value,
                                ),
                              }
                            : item,
                      ),
                    )
                  }
                  placeholder="field_key"
                  className={inputClass}
                />
                <select
                  value={field.type}
                  onChange={(event) =>
                    setFields((current) =>
                      current.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                type:
                                  event.target.value,
                              }
                            : item,
                      ),
                    )
                  }
                  className={inputClass}
                >
                  {fieldTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    ),
                  )}
                </select>
                <label className="flex h-10 items-center gap-2 px-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      field.required
                    }
                    onChange={(event) =>
                      setFields(
                        (current) =>
                          current.map(
                            (
                              item,
                              itemIndex,
                            ) =>
                              itemIndex ===
                              index
                                ? {
                                    ...item,
                                    required:
                                      event
                                        .target
                                        .checked,
                                  }
                                : item,
                          ),
                      )
                    }
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFields(
                      (current) =>
                        current.filter(
                          (
                            _,
                            itemIndex,
                          ) =>
                            itemIndex !==
                            index,
                        ),
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-muted"
                  aria-label="Remove field"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function ResponsibilitiesClient() {
  const [capabilities, setCapabilities] =
    useState<Capability[]>([]);
  const [rules, setRules] =
    useState<CapabilityRule[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [showCreate, setShowCreate] =
    useState(false);
  const [editCapability, setEditCapability] =
    useState<Capability | null>(null);
  const [createType, setCreateType] =
    useState("form");
  const [createFields, setCreateFields] =
    useState<BuilderField[]>([]);
  const [editType, setEditType] =
    useState("form");
  const [editFields, setEditFields] =
    useState<BuilderField[]>([]);
  const [ruleType, setRuleType] =
    useState("all");
  const [ruleValue, setRuleValue] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        capabilityBody,
        ruleBody,
        employeeBody,
      ] = await Promise.all([
        apiJson<{
          capabilities: Capability[];
        }>("/api/appliance/capabilities"),
        apiJson<{
          rules: CapabilityRule[];
        }>("/api/appliance/capability-rules"),
        apiJson<{
          employees: Employee[];
        }>("/api/appliance/employees"),
      ]);

      setCapabilities(
        capabilityBody.capabilities ?? [],
      );
      setRules(ruleBody.rules ?? []);
      setEmployees(
        employeeBody.employees ?? [],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load responsibilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount =
    capabilities.filter(
      (item) =>
        item.isActive !== false,
    ).length;

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

  const designations = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map(
              (employee) =>
                employee.designation,
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

  const roles = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map(
              (employee) =>
                employee.role,
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

  async function createResponsibility(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);

    const data = new FormData(
      event.currentTarget,
    );

    const title = String(
      data.get("title") ?? "",
    ).trim();
    const key = keyFromLabel(title);

    try {
      await apiJson(
        "/api/appliance/capabilities",
        {
          method: "POST",
          body: JSON.stringify({
            key,
            title,
            type: createType,
            description:
              String(
                data.get(
                  "description",
                ) ?? "",
              ).trim() || null,
            icon: null,
            config: toConfig(
              createType,
              createFields,
              key,
            ),
          }),
        },
      );

      setShowCreate(false);
      setCreateFields([]);
      setCreateType("form");
      setMessage(
        `"${title}" is ready to assign.`,
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEdit(
    capability: Capability,
  ) {
    setEditCapability(capability);
    setEditType(capability.type);
    setEditFields(
      fieldsFromCapability(
        capability,
      ),
    );
  }

  async function saveEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editCapability) return;

    setSaving(true);
    const data = new FormData(
      event.currentTarget,
    );

    try {
      await apiJson(
        `/api/appliance/capabilities/${editCapability.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: String(
              data.get("title") ?? "",
            ).trim(),
            description:
              String(
                data.get(
                  "description",
                ) ?? "",
              ).trim() || null,
            type: editType,
            config: toConfig(
              editType,
              editFields,
              editCapability.key,
            ),
          }),
        },
      );

      setEditCapability(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleCapability(
    capability: Capability,
  ) {
    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/capabilities/${capability.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive:
              capability.isActive ===
              false,
          }),
        },
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function createRule(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);

    const data = new FormData(
      event.currentTarget,
    );

    try {
      await apiJson(
        "/api/appliance/capability-rules",
        {
          method: "POST",
          body: JSON.stringify({
            capabilityId: Number(
              data.get(
                "capabilityId",
              ),
            ),
            subjectType: ruleType,
            subjectValue:
              ruleType === "all"
                ? null
                : ruleValue,
            effect: String(
              data.get("effect") ??
                "allow",
            ),
            priority: 0,
          }),
        },
      );

      setRuleType("all");
      setRuleValue("");
      (
        event.currentTarget as HTMLFormElement
      ).reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(
    rule: CapabilityRule,
  ) {
    await apiJson(
      `/api/appliance/capability-rules/${rule.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          enabled: !rule.enabled,
        }),
      },
    );

    await load();
  }

  function subjectLabel(
    rule: CapabilityRule,
  ) {
    if (rule.subjectType === "all") {
      return "Everyone";
    }

    if (rule.subjectType === "user") {
      const employee =
        employees.find(
          (item) =>
            String(item.id) ===
            rule.subjectValue,
        );

      return (
        employee?.name ??
        employee?.employeeCode ??
        `Employee ${rule.subjectValue}`
      );
    }

    return `${rule.subjectType}: ${rule.subjectValue ?? "—"}`;
  }

  function valuesForRuleType() {
    if (ruleType === "department") {
      return departments;
    }
    if (
      ruleType === "designation"
    ) {
      return designations;
    }
    if (ruleType === "role") {
      return roles;
    }
    return [];
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Responsibilities"
        description="Create reusable work capabilities and decide who gets them. The app is personalized from these assignments."
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
              Create responsibility
            </PrimaryButton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {activeCount}
          </div>
          <div className="mt-1 text-sm">
            Active responsibilities
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {rules.filter(
              (rule) =>
                rule.enabled,
            ).length}
          </div>
          <div className="mt-1 text-sm">
            Assignment rules
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-2xl font-semibold">
            {capabilities.reduce(
              (sum, item) =>
                sum +
                (item.directAssignments ??
                  0),
              0,
            )}
          </div>
          <div className="mt-1 text-sm">
            Direct employee assignments
          </div>
        </div>
      </div>

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <div className="mb-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Blocks className="h-5 w-5" />
              Responsibility library
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              These are building blocks. No job title is hardcoded to an app screen.
            </div>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : capabilities.length ===
            0 ? (
            <EmptyState
              title="No responsibilities yet"
              description="Create the first reusable responsibility."
            />
          ) : (
            <div className="space-y-2">
              {capabilities.map(
                (capability) => (
                  <div
                    key={
                      capability.id
                    }
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">
                          {
                            capability.title
                          }
                        </div>
                        <Pill
                          tone={
                            capability.isActive ===
                            false
                              ? "neutral"
                              : "good"
                          }
                        >
                          {capability.isActive ===
                          false
                            ? "Off"
                            : "Active"}
                        </Pill>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {
                          responsibilityTypes.find(
                            (item) =>
                              item.value ===
                              capability.type,
                          )?.label ??
                          capability.type
                        }
                        {" · "}
                        {capability.directAssignments ??
                          0} direct
                        {" · "}
                        {capability.assignmentRules ??
                          0} rules
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <SecondaryButton
                        type="button"
                        onClick={() =>
                          openEdit(
                            capability,
                          )
                        }
                        className="h-9"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        onClick={() =>
                          void toggleCapability(
                            capability,
                          )
                        }
                        disabled={saving}
                        className="h-9"
                      >
                        {capability.isActive ===
                        false ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                        {capability.isActive ===
                        false
                          ? "Enable"
                          : "Disable"}
                      </SecondaryButton>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" />
              Assign automatically
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Use a rule when a responsibility belongs to a whole group. Individual exceptions still live in Employees.
            </div>
          </div>

          <form
            onSubmit={createRule}
            className="space-y-4"
          >
            <Field label="Responsibility">
              <select
                name="capabilityId"
                required
                className={inputClass}
              >
                <option value="">
                  Choose responsibility
                </option>
                {capabilities
                  .filter(
                    (item) =>
                      item.isActive !==
                      false,
                  )
                  .map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.title}
                      </option>
                    ),
                  )}
              </select>
            </Field>

            <Field label="Who gets it?">
              <select
                value={ruleType}
                onChange={(event) => {
                  setRuleType(
                    event.target.value,
                  );
                  setRuleValue("");
                }}
                className={inputClass}
              >
                <option value="all">
                  Everyone
                </option>
                <option value="department">
                  A department
                </option>
                <option value="designation">
                  A designation
                </option>
                <option value="role">
                  A role
                </option>
                <option value="user">
                  One employee
                </option>
              </select>
            </Field>

            {ruleType === "user" && (
              <Field label="Employee">
                <select
                  value={ruleValue}
                  onChange={(event) =>
                    setRuleValue(
                      event.target.value,
                    )
                  }
                  required
                  className={inputClass}
                >
                  <option value="">
                    Choose employee
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
                          employee.employeeCode}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            )}

            {![
              "all",
              "user",
            ].includes(ruleType) && (
              <Field
                label={
                  ruleType ===
                  "department"
                    ? "Department"
                    : ruleType ===
                        "designation"
                      ? "Designation"
                      : "Role"
                }
              >
                <input
                  value={ruleValue}
                  onChange={(event) =>
                    setRuleValue(
                      event.target.value,
                    )
                  }
                  required
                  list="rule-values"
                  className={inputClass}
                  placeholder="Type or choose"
                />
                <datalist id="rule-values">
                  {valuesForRuleType().map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      />
                    ),
                  )}
                </datalist>
              </Field>
            )}

            <Field
              label="Rule"
              hint="Allow is normal. Deny is useful for an exception to a broader inherited rule."
            >
              <select
                name="effect"
                className={inputClass}
              >
                <option value="allow">
                  Give responsibility
                </option>
                <option value="deny">
                  Do not give responsibility
                </option>
              </select>
            </Field>

            <PrimaryButton
              type="submit"
              disabled={saving}
              className="w-full"
            >
              Add assignment rule
            </PrimaryButton>
          </form>

          <div className="mt-6 border-t pt-4">
            <div className="mb-3 text-sm font-semibold">
              Current rules
            </div>

            {rules.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No automatic assignment rules yet.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(
                  (rule) => {
                    const capability =
                      capabilities.find(
                        (item) =>
                          item.id ===
                          rule.capabilityId,
                      );

                    return (
                      <div
                        key={
                          rule.id
                        }
                        className="rounded-xl border p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {capability?.title ??
                                `Responsibility ${rule.capabilityId}`}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {rule.effect ===
                              "deny"
                                ? "Exclude"
                                : "Give to"}{" "}
                              {subjectLabel(
                                rule,
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void toggleRule(
                                rule,
                              )
                            }
                          >
                            <Pill
                              tone={
                                rule.enabled
                                  ? "good"
                                  : "neutral"
                              }
                            >
                              {rule.enabled
                                ? "On"
                                : "Off"}
                            </Pill>
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={showCreate}
        title="Create responsibility"
        description="Describe the work in plain language. The system stores the technical configuration for you."
        onClose={() =>
          setShowCreate(false)
        }
        wide
      >
        <form
          onSubmit={createResponsibility}
          className="space-y-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                name="title"
                required
                placeholder="Daily Closing Stock"
                className={inputClass}
              />
            </Field>

            <Field label="What kind of work?">
              <select
                value={createType}
                onChange={(event) =>
                  setCreateType(
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                {responsibilityTypes.map(
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
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              placeholder="What should the employee understand about this responsibility?"
              className={textareaClass}
            />
          </Field>

          {(createType === "form" ||
            createType ===
              "checklist") && (
            <BuilderFields
              fields={createFields}
              setFields={
                setCreateFields
              }
            />
          )}

          <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
            {
              responsibilityTypes.find(
                (item) =>
                  item.value ===
                  createType,
              )?.description
            }
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
              Create responsibility
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={
          editCapability !== null
        }
        title="Edit responsibility"
        description="Existing employee history is preserved when you change the definition."
        onClose={() =>
          setEditCapability(null)
        }
        wide
      >
        {editCapability && (
          <form
            onSubmit={saveEdit}
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <input
                  name="title"
                  required
                  defaultValue={
                    editCapability.title
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Work type">
                <select
                  value={editType}
                  onChange={(event) =>
                    setEditType(
                      event.target.value,
                    )
                  }
                  className={inputClass}
                >
                  {responsibilityTypes.map(
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
              </Field>
            </div>

            <Field label="Description">
              <textarea
                name="description"
                defaultValue={
                  editCapability.description ??
                  ""
                }
                className={textareaClass}
              />
            </Field>

            {(editType === "form" ||
              editType ===
                "checklist") && (
              <BuilderFields
                fields={editFields}
                setFields={
                  setEditFields
                }
              />
            )}

            <div className="flex justify-end gap-2">
              <SecondaryButton
                type="button"
                onClick={() =>
                  setEditCapability(
                    null,
                  )
                }
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                disabled={saving}
              >
                Save changes
              </PrimaryButton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
