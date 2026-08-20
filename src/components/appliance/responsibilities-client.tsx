"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

import type {
  CrudOperation,
  Employee,
  PrimitiveCatalog,
  Responsibility,
  ResponsibilityDefinition,
  ResponsibilityField,
  ResponsibilityRule,
  Role,
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

const RESPONSIBILITY_CREATE_ENTITLEMENT =
  "responsibility.create";

type MeResponse = {
  entitlements?: Record<string, boolean>;
};

type BuilderField = ResponsibilityField & {
  localId: string;
  placeholder: string;
  helpText: string;
  optionsText: string;
};

type BuilderState = {
  title: string;
  description: string;
  outputRenderer: string;
  strict: boolean;
  crud: Record<CrudOperation, boolean>;
  fields: BuilderField[];
};

function localId() {
  return globalThis.crypto?.randomUUID?.() ??
    `field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function blankState(
  catalog?: PrimitiveCatalog | null,
): BuilderState {
  return {
    title: "",
    description: "",
    outputRenderer:
      catalog?.output?.[0]?.key ??
      "table",
    strict: true,
    crud: {
      create: true,
      read: true,
      update: true,
      delete: false,
    },
    fields: [],
  };
}

function blankField(
  catalog: PrimitiveCatalog | null,
): BuilderField {
  const primitive = catalog?.input?.[0] ?? {
    key: "text",
    dataType: "string",
  };

  return {
    localId: localId(),
    key: "",
    label: "",
    inputType: primitive.key,
    dataType: primitive.dataType,
    required: false,
    config: {},
    placeholder: "",
    helpText: "",
    optionsText: "",
  };
}

function fieldFromDefinition(
  field: ResponsibilityField,
): BuilderField {
  const config = objectValue(field.config);
  const options = Array.isArray(config.options)
    ? config.options.map(String)
    : [];

  return {
    ...field,
    localId: localId(),
    config,
    placeholder:
      typeof config.placeholder === "string"
        ? config.placeholder
        : "",
    helpText:
      typeof config.helpText === "string"
        ? config.helpText
        : "",
    optionsText: options.join("\n"),
  };
}

function stateFromResponsibility(
  responsibility: Responsibility,
): BuilderState {
  const definition = responsibility.definition;

  return {
    title: responsibility.title,
    description: responsibility.description ?? "",
    outputRenderer:
      definition.output.renderer || "table",
    strict: definition.input.strict,
    crud: {
      create: definition.crud.create,
      read: definition.crud.read,
      update: definition.crud.update,
      delete: definition.crud.delete,
    },
    fields: definition.input.fields.map(fieldFromDefinition),
  };
}

function configFromState(
  state: BuilderState,
): ResponsibilityDefinition {
  return {
    schemaVersion: 1,
    input: {
      renderer: "form",
      strict: state.strict,
      fields: state.fields.map((field, index) => {
        const options = field.optionsText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);

        const config: Record<string, unknown> = {
          ...field.config,
        };

        if (field.placeholder.trim()) {
          config.placeholder = field.placeholder.trim();
        } else {
          delete config.placeholder;
        }

        if (field.helpText.trim()) {
          config.helpText = field.helpText.trim();
        } else {
          delete config.helpText;
        }

        if (
          field.inputType === "select" ||
          field.inputType === "multi_select"
        ) {
          config.options = options;
        } else {
          delete config.options;
        }

        return {
          key:
            normalizeKey(field.key) ||
            normalizeKey(field.label) ||
            `field_${index + 1}`,
          label:
            field.label.trim() ||
            `Field ${index + 1}`,
          inputType: field.inputType,
          dataType: field.dataType,
          required: field.required,
          config,
        };
      }),
    },
    output: {
      renderer: state.outputRenderer || "table",
      config: {},
    },
    crud: state.crud,
  };
}

function validateState(
  state: BuilderState,
) {
  if (!state.title.trim()) {
    return "Responsibility name is required.";
  }

  const seen = new Set<string>();

  for (let index = 0; index < state.fields.length; index += 1) {
    const field = state.fields[index];
    const key =
      normalizeKey(field.key) ||
      normalizeKey(field.label);

    if (!field.label.trim()) {
      return `Field ${index + 1} needs a label.`;
    }

    if (!key) {
      return `${field.label} needs a data key.`;
    }

    if (seen.has(key)) {
      return `Data key “${key}” is used more than once.`;
    }

    seen.add(key);

    if (
      (field.inputType === "select" ||
        field.inputType === "multi_select") &&
      field.optionsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean).length < 2
    ) {
      return `${field.label} needs at least two options.`;
    }
  }

  return null;
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DefinitionBuilder({
  state,
  onChange,
  catalog,
}: {
  state: BuilderState;
  onChange: (state: BuilderState) => void;
  catalog: PrimitiveCatalog | null;
}) {
  function updateField(
    index: number,
    patch: Partial<BuilderField>,
  ) {
    onChange({
      ...state,
      fields: state.fields.map((field, itemIndex) =>
        itemIndex === index
          ? { ...field, ...patch }
          : field,
      ),
    });
  }

  function moveField(
    index: number,
    direction: -1 | 1,
  ) {
    const target = index + direction;
    if (target < 0 || target >= state.fields.length) return;

    const fields = [...state.fields];
    const [item] = fields.splice(index, 1);
    fields.splice(target, 0, item);
    onChange({ ...state, fields });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            value={state.title}
            onChange={(event) =>
              onChange({
                ...state,
                title: event.target.value,
              })
            }
            className={inputClass}
            placeholder="Machine inspection"
            required
          />
        </Field>

        <Field
          label="Output view"
          hint="How records should be projected in the dashboard."
        >
          <select
            value={state.outputRenderer}
            onChange={(event) =>
              onChange({
                ...state,
                outputRenderer: event.target.value,
              })
            }
            className={inputClass}
          >
            {(catalog?.output ?? []).map((item) => (
              <option key={item.key} value={item.key}>
                {humanize(item.key)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={state.description}
          onChange={(event) =>
            onChange({
              ...state,
              description: event.target.value,
            })
          }
          className={textareaClass}
          placeholder="What work does this Responsibility represent?"
        />
      </Field>

      <Panel className="bg-muted/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Employee input</div>
            <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Fields are built from the primitive catalog returned by the backend. Adding a new primitive does not require a new business route.
            </div>
          </div>
          <SecondaryButton
            type="button"
            onClick={() =>
              onChange({
                ...state,
                fields: [
                  ...state.fields,
                  blankField(catalog),
                ],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add field
          </SecondaryButton>
        </div>

        {state.fields.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No employee input fields"
              description="This is valid for a Responsibility that represents a simple event or confirmation."
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {state.fields.map((field, index) => (
              <div
                key={field.localId}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {field.label.trim() || `Field ${index + 1}`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, 1)}
                      disabled={index === state.fields.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...state,
                          fields: state.fields.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-md border"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Question / label">
                    <input
                      value={field.label}
                      onChange={(event) => {
                        const previousAuto = normalizeKey(field.label);
                        const label = event.target.value;
                        const followsLabel =
                          !field.key ||
                          field.key === previousAuto;

                        updateField(index, {
                          label,
                          key: followsLabel
                            ? normalizeKey(label)
                            : field.key,
                        });
                      }}
                      className={inputClass}
                      placeholder="Temperature"
                    />
                  </Field>

                  <Field label="Input primitive">
                    <select
                      value={field.inputType}
                      onChange={(event) => {
                        const inputType = event.target.value;
                        const primitive = catalog?.input.find((item) => item.key === inputType);
                        updateField(index, {
                          inputType,
                          dataType: primitive?.dataType ?? "any",
                        });
                      }}
                      className={inputClass}
                    >
                      {(catalog?.input ?? []).map((item) => (
                        <option key={item.key} value={item.key}>
                          {humanize(item.key)} · {item.dataType}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Data key"
                    hint="Stable machine-readable key."
                  >
                    <input
                      value={field.key}
                      onChange={(event) =>
                        updateField(index, {
                          key: normalizeKey(event.target.value),
                        })
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Storage type"
                    hint="Derived from the primitive catalog."
                  >
                    <input
                      value={field.dataType}
                      readOnly
                      className={`${inputClass} bg-muted/40`}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Placeholder">
                    <input
                      value={field.placeholder}
                      onChange={(event) =>
                        updateField(index, {
                          placeholder: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Help text">
                    <input
                      value={field.helpText}
                      onChange={(event) =>
                        updateField(index, {
                          helpText: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                {(field.inputType === "select" ||
                  field.inputType === "multi_select") && (
                  <div className="mt-4">
                    <Field
                      label="Options"
                      hint="One option per line."
                    >
                      <textarea
                        value={field.optionsText}
                        onChange={(event) =>
                          updateField(index, {
                            optionsText: event.target.value,
                          })
                        }
                        className={textareaClass}
                      />
                    </Field>
                  </div>
                )}

                <label className="mt-4 flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateField(index, {
                        required: event.target.checked,
                      })
                    }
                  />
                  Employee must provide this value
                </label>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="h-4 w-4" />
          Record operations
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(["create", "read", "update", "delete"] as CrudOperation[]).map((operation) => (
            <label
              key={operation}
              className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium"
            >
              <input
                type="checkbox"
                checked={state.crud[operation]}
                onChange={(event) =>
                  onChange({
                    ...state,
                    crud: {
                      ...state.crud,
                      [operation]: event.target.checked,
                    },
                  })
                }
              />
              {humanize(operation)}
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.strict}
            onChange={(event) =>
              onChange({
                ...state,
                strict: event.target.checked,
              })
            }
          />
          Reject undeclared payload fields
        </label>
      </Panel>
    </div>
  );
}

export default function ResponsibilitiesClient() {
  const [catalog, setCatalog] =
    useState<PrimitiveCatalog | null>(null);
  const [responsibilities, setResponsibilities] =
    useState<Responsibility[]>([]);
  const [rules, setRules] =
    useState<ResponsibilityRule[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [roles, setRoles] =
    useState<Role[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [canCreate, setCanCreate] =
    useState(false);

  const [showCreate, setShowCreate] =
    useState(false);
  const [createState, setCreateState] =
    useState<BuilderState>(blankState());
  const [editing, setEditing] =
    useState<Responsibility | null>(null);
  const [editState, setEditState] =
    useState<BuilderState>(blankState());

  const [ruleResponsibilityId, setRuleResponsibilityId] =
    useState<number | null>(null);
  const [ruleType, setRuleType] =
    useState("all");
  const [ruleValue, setRuleValue] =
    useState("");
  const [ruleEffect, setRuleEffect] =
    useState("allow");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [
        primitiveBody,
        responsibilityBody,
        ruleBody,
        employeeBody,
        roleBody,
        me,
      ] = await Promise.all([
        apiJson<{ primitives: PrimitiveCatalog }>(
          "/api/appliance/primitives",
        ),
        apiJson<{ responsibilities: Responsibility[] }>(
          "/api/appliance/responsibilities",
        ),
        apiJson<{ rules: ResponsibilityRule[] }>(
          "/api/appliance/responsibility-rules",
        ),
        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),
        apiJson<{ roles: Role[] }>(
          "/api/appliance/roles",
        ),
        apiJson<MeResponse>("/api/me"),
      ]);

      setCatalog(primitiveBody.primitives);
      setResponsibilities(responsibilityBody.responsibilities ?? []);
      setRules(ruleBody.rules ?? []);
      setEmployees(employeeBody.employees ?? []);
      setRoles(roleBody.roles ?? []);
      setCanCreate(
        me.entitlements?.[RESPONSIBILITY_CREATE_ENTITLEMENT] === true,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = responsibilities.filter(
    (item) => item.isActive !== false,
  ).length;

  const departments = useMemo(
    () => [...new Set(
      employees
        .map((employee) => employee.department)
        .filter((value): value is string => Boolean(value)),
    )].sort(),
    [employees],
  );

  const designations = useMemo(
    () => [...new Set(
      employees
        .map((employee) => employee.designation)
        .filter((value): value is string => Boolean(value)),
    )].sort(),
    [employees],
  );

  function openCreate() {
    setCreateState(blankState(catalog));
    setShowCreate(true);
    setMessage(null);
  }

  async function createResponsibility(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canCreate) {
      setMessage(
        "Responsibility customization is not enabled for this company.",
      );
      return;
    }

    const validation = validateState(createState);
    if (validation) {
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiJson("/api/appliance/responsibilities", {
        method: "POST",
        body: JSON.stringify({
          key: normalizeKey(createState.title),
          title: createState.title.trim(),
          description: createState.description.trim() || null,
          icon: "blocks",
          config: configFromState(createState),
        }),
      });

      setShowCreate(false);
      setMessage(`“${createState.title.trim()}” is ready to assign.`);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create Responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEdit(responsibility: Responsibility) {
    setEditing(responsibility);
    setEditState(stateFromResponsibility(responsibility));
    setMessage(null);
  }

  async function saveEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editing) return;

    const validation = validateState(editState);
    if (validation) {
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        `/api/appliance/responsibilities/${editing.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: editState.title.trim(),
            description: editState.description.trim() || null,
            config: configFromState(editState),
          }),
        },
      );

      setEditing(null);
      setMessage("Responsibility updated. Existing records and Workflow history are preserved.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update Responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleResponsibility(
    responsibility: Responsibility,
  ) {
    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        `/api/appliance/responsibilities/${responsibility.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: responsibility.isActive === false,
          }),
        },
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change Responsibility status.",
      );
    } finally {
      setSaving(false);
    }
  }

  function ruleOptions() {
    if (ruleType === "department") {
      return departments.map((value) => ({ value, label: value }));
    }
    if (ruleType === "designation") {
      return designations.map((value) => ({ value, label: value }));
    }
    if (ruleType === "user") {
      return employees.map((employee) => ({
        value: String(employee.id),
        label:
          employee.name ??
          employee.employeeCode ??
          `Employee ${employee.id}`,
      }));
    }
    if (ruleType === "role") {
      return roles.map((role) => ({
        value: String(role.id),
        label: role.label,
      }));
    }
    return [];
  }

  async function createRule(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!ruleResponsibilityId) return;

    if (ruleType !== "all" && !ruleValue) {
      setMessage("Choose who this assignment rule applies to.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        "/api/appliance/responsibility-rules",
        {
          method: "POST",
          body: JSON.stringify({
            responsibilityId: ruleResponsibilityId,
            subjectType: ruleType,
            subjectValue:
              ruleType === "all" ? null : ruleValue,
            roleId:
              ruleType === "role" ? Number(ruleValue) : undefined,
            effect: ruleEffect,
            priority: 0,
            config: {},
          }),
        },
      );

      setRuleValue("");
      setRuleType("all");
      setRuleEffect("allow");
      setRuleResponsibilityId(null);
      setMessage("Assignment rule created.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create assignment rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: ResponsibilityRule) {
    setSaving(true);
    try {
      await apiJson(
        `/api/appliance/responsibility-rules/${rule.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled: !rule.enabled,
          }),
        },
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workspace"
        title="Responsibilities"
        description="Define work once: employee input, dashboard output and allowed record operations. Workflows decide when those operations are allowed."
        action={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            {canCreate && (
              <PrimaryButton type="button" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create Responsibility
              </PrimaryButton>
            )}
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Active Responsibilities</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{catalog?.input.length ?? 0}</div>
          <div className="mt-1 text-sm text-muted-foreground">Input primitives</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{catalog?.output.length ?? 0}</div>
          <div className="mt-1 text-sm text-muted-foreground">Output renderers</div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : responsibilities.length === 0 ? (
        <EmptyState
          title="No Responsibilities yet"
          description="Create the first unit of work. The sidebar will generate its Work surface automatically."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {responsibilities.map((responsibility) => {
            const definition = responsibility.definition;
            const responsibilityRules = rules.filter(
              (rule) => rule.capabilityId === responsibility.id,
            );

            return (
              <Panel key={responsibility.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Blocks className="h-5 w-5" />
                      <div className="text-lg font-semibold">{responsibility.title}</div>
                      <Pill tone={responsibility.isActive === false ? "neutral" : "good"}>
                        {responsibility.isActive === false ? "Disabled" : "Active"}
                      </Pill>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {responsibility.key}
                    </div>
                    {responsibility.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {responsibility.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      className="h-9 px-3"
                      onClick={() => openEdit(responsibility)}
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className="h-9 px-3"
                      disabled={saving}
                      onClick={() => void toggleResponsibility(responsibility)}
                    >
                      {responsibility.isActive === false ? (
                        <ToggleLeft className="h-4 w-4" />
                      ) : (
                        <ToggleRight className="h-4 w-4" />
                      )}
                    </SecondaryButton>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xl font-semibold">{definition.input.fields.length}</div>
                    <div className="text-xs text-muted-foreground">input fields</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-semibold">{humanize(definition.output.renderer)}</div>
                    <div className="text-xs text-muted-foreground">output</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xl font-semibold">
                      {responsibility.directAssignments ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">direct assignments</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["create", "read", "update", "delete"] as CrudOperation[])
                    .filter((operation) => definition.crud[operation])
                    .map((operation) => (
                      <Pill key={operation}>{operation}</Pill>
                    ))}
                </div>

                <div className="mt-5 border-t pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Assignment rules</div>
                      <div className="text-xs text-muted-foreground">
                        {responsibilityRules.filter((rule) => rule.enabled).length} active rule(s)
                      </div>
                    </div>
                    <SecondaryButton
                      type="button"
                      className="h-9"
                      onClick={() => {
                        setRuleResponsibilityId(responsibility.id);
                        setRuleType("all");
                        setRuleValue("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Rule
                    </SecondaryButton>
                  </div>

                  {responsibilityRules.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {responsibilityRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{rule.effect}</span>{" "}
                            {rule.subjectType}
                            {rule.subjectValue ? ` · ${rule.subjectValue}` : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleRule(rule)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            {rule.enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        title="Create Responsibility"
        description="Define work as metadata. No backend route type is selected here."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={createResponsibility}>
          <DefinitionBuilder
            state={createState}
            onChange={setCreateState}
            catalog={catalog}
          />
          <div className="mt-6 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.title}` : "Edit Responsibility"}
        description="Changing the definition does not rename the stable Responsibility key or delete historical records."
        onClose={() => setEditing(null)}
        wide
      >
        <form onSubmit={saveEdit}>
          <DefinitionBuilder
            state={editState}
            onChange={setEditState}
            catalog={catalog}
          />
          <div className="mt-6 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save definition
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(ruleResponsibilityId)}
        title="Assignment rule"
        description="Rules resolve who receives a Responsibility. Direct employee assignments remain available from Assignments."
        onClose={() => setRuleResponsibilityId(null)}
      >
        <form onSubmit={createRule} className="space-y-4">
          <Field label="Who">
            <select
              value={ruleType}
              onChange={(event) => {
                setRuleType(event.target.value);
                setRuleValue("");
              }}
              className={inputClass}
            >
              <option value="all">Everyone</option>
              <option value="user">Specific employee</option>
              <option value="department">Department</option>
              <option value="designation">Designation</option>
              <option value="role">Dashboard / organization role</option>
            </select>
          </Field>

          {ruleType !== "all" && (
            <Field label="Value">
              <select
                value={ruleValue}
                onChange={(event) => setRuleValue(event.target.value)}
                className={inputClass}
                required
              >
                <option value="">Choose...</option>
                {ruleOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Effect">
            <select
              value={ruleEffect}
              onChange={(event) => setRuleEffect(event.target.value)}
              className={inputClass}
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </Field>

          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setRuleResponsibilityId(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              Create rule
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
