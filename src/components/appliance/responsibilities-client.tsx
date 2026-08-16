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
  ArrowDown,
  ArrowUp,
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
import { apiJson } from "./client";
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
  placeholder: string;
  helpText: string;
  options: string[];
  min: number | null;
  max: number | null;
  minSelections: number | null;
  maxSelections: number | null;
};

type FieldType = {
  value: string;
  label: string;
  description: string;
};

const responsibilityTypes = [
  {
    value: "form",
    label: "Guided work screen",
    description:
      "Build a focused employee workflow from reusable field blocks.",
  },
  {
    value: "checklist",
    label: "Checklist / inspection",
    description:
      "Step-by-step field work with completion evidence.",
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
    label: "View operational data",
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
    label: "Upload evidence",
    description:
      "Photos, documents or other proof from the field.",
  },
  {
    value: "native",
    label: "Built-in app feature",
    description:
      "Attendance, GPS, maps, camera or another native engine.",
  },
] as const;

const fieldTypes: FieldType[] = [
  {
    value: "text",
    label: "Short text",
    description: "A concise answer such as contact person or visit remark.",
  },
  {
    value: "long_text",
    label: "Long note",
    description: "A larger note area for instructions or observations.",
  },
  {
    value: "number",
    label: "Number",
    description: "A measured quantity, amount, stock count or target.",
  },
  {
    value: "counter",
    label: "Counter",
    description: "Fast plus/minus entry for visits, units or pieces.",
  },
  {
    value: "date",
    label: "Date",
    description: "Choose a calendar date.",
  },
  {
    value: "datetime",
    label: "Date & time",
    description: "Choose a date and time together.",
  },
  {
    value: "yes_no",
    label: "Yes / No",
    description: "A fast two-choice decision.",
  },
  {
    value: "choice",
    label: "Single choice",
    description: "Choose exactly one option from an admin-defined list.",
  },
  {
    value: "multi_choice",
    label: "Multiple choice",
    description: "Choose one or more options from an admin-defined list.",
  },
  {
    value: "dealer",
    label: "Dealer",
    description: "Search and choose one dealer from the existing dealer directory.",
  },
  {
    value: "dealer_multi",
    label: "Multiple dealers",
    description: "Search and choose several dealers for a journey or visit plan.",
  },
  {
    value: "photo",
    label: "Photo",
    description: "Capture one photo as evidence.",
  },
  {
    value: "photo_multi",
    label: "Multiple photos",
    description: "Capture several evidence photos.",
  },
  {
    value: "checkbox",
    label: "Confirmation checkbox",
    description: "A deliberate acknowledgement or completion confirmation.",
  },
  {
    value: "section",
    label: "Section heading",
    description: "A visual divider that groups related questions.",
  },
  {
    value: "instruction",
    label: "Instruction",
    description: "Read-only guidance shown inside the employee workflow.",
  },
];

function builderId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `field-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function keyFromLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function blankField(): BuilderField {
  return {
    id: builderId(),
    label: "",
    key: "",
    type: "text",
    required: false,
    placeholder: "",
    helpText: "",
    options: [],
    min: null,
    max: null,
    minSelections: null,
    maxSelections: null,
  };
}

function needsOptions(type: string) {
  return type === "choice" || type === "multi_choice";
}

function supportsNumberRange(type: string) {
  return type === "number" || type === "counter";
}

function supportsSelectionRange(type: string) {
  return (
    type === "multi_choice" ||
    type === "dealer_multi" ||
    type === "photo_multi"
  );
}

function isDisplayOnly(type: string) {
  return type === "section" || type === "instruction";
}

function typeLabel(type: string) {
  return fieldTypes.find((item) => item.value === type)?.label ?? type;
}

function fieldsFromCapability(
  capability: Capability,
): BuilderField[] {
  const raw = capability.config?.fields;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((field: any, index) => ({
    id: builderId(),
    label: String(field?.label ?? field?.key ?? `Field ${index + 1}`),
    key: String(field?.key ?? `field_${index + 1}`),
    type: String(field?.type ?? "text"),
    required: Boolean(field?.required),
    placeholder: String(field?.placeholder ?? ""),
    helpText: String(field?.helpText ?? field?.help ?? ""),
    options: Array.isArray(field?.options)
      ? field.options.map((item: unknown) => String(item))
      : [],
    min: optionalNumber(field?.min),
    max: optionalNumber(field?.max),
    minSelections: optionalNumber(field?.minSelections),
    maxSelections: optionalNumber(field?.maxSelections),
  }));
}

function toConfig(
  type: string,
  fields: BuilderField[],
  key: string,
) {
  if (type === "form" || type === "checklist") {
    return {
      version: 1,
      renderer: "dynamic_v1",
      fields: fields.map((field, index) => {
        const normalizedKey =
          field.key.trim() ||
          keyFromLabel(field.label) ||
          `field_${index + 1}`;

        const result: Record<string, unknown> = {
          key: normalizedKey,
          label: field.label.trim() || `Field ${index + 1}`,
          type: field.type,
          required: isDisplayOnly(field.type)
            ? false
            : field.required,
        };

        if (field.placeholder.trim()) {
          result.placeholder = field.placeholder.trim();
        }

        if (field.helpText.trim()) {
          result.helpText = field.helpText.trim();
        }

        if (needsOptions(field.type)) {
          result.options = field.options
            .map((item) => item.trim())
            .filter(Boolean);
        }

        if (supportsNumberRange(field.type)) {
          if (field.min !== null) result.min = field.min;
          if (field.max !== null) result.max = field.max;
        }

        if (supportsSelectionRange(field.type)) {
          if (field.minSelections !== null) {
            result.minSelections = field.minSelections;
          }
          if (field.maxSelections !== null) {
            result.maxSelections = field.maxSelections;
          }
        }

        if (field.type === "dealer" || field.type === "dealer_multi") {
          result.source = "dealers";
        }

        return result;
      }),
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
  setFields: Dispatch<SetStateAction<BuilderField[]>>;
}) {
  function addField() {
    setFields((current) => [...current, blankField()]);
  }

  function updateField(
    index: number,
    patch: Partial<BuilderField>,
  ) {
    setFields((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function removeField(index: number) {
    setFields((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
            Employee screen
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
            Build the work interaction
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
            Add only what the employee must actively answer. Identity, assignment,
            date, time and other known context should stay automatic.
          </p>
        </div>
        <SecondaryButton
          type="button"
          onClick={addField}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add field
        </SecondaryButton>
      </div>

      {fields.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-6">
          <div className="text-[14px] font-medium text-foreground">
            No employee inputs yet.
          </div>
          <div className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
            Example: for a Journey Plan, add “Multiple dealers”, “Single choice”
            for visit objective, and an optional instruction note.
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {fields.map((field, index) => {
            const currentType = fieldTypes.find(
              (item) => item.value === field.type,
            );
            const generatedKey = keyFromLabel(field.label);

            return (
              <div
                key={field.id}
                className="rounded-lg border border-border bg-background p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
                      Field {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-1 text-[14px] font-medium text-foreground">
                      {field.label.trim() || "Untitled field"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:-translate-y-px hover:bg-muted hover:text-foreground active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Move field up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:-translate-y-px hover:bg-muted hover:text-foreground active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Move field down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:-translate-y-px hover:bg-red-500/10 hover:text-red-600 active:translate-y-0"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Question / label">
                    <input
                      value={field.label}
                      onChange={(event) => {
                        const previousGenerated = keyFromLabel(field.label);
                        const label = event.target.value;
                        const nextGenerated = keyFromLabel(label);
                        const shouldFollowLabel =
                          !field.key || field.key === previousGenerated;

                        updateField(index, {
                          label,
                          key: shouldFollowLabel
                            ? nextGenerated
                            : field.key,
                        });
                      }}
                      placeholder="Dealers to visit"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Interaction type">
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateField(index, {
                          type: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      {fieldTypes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] leading-[18px] text-muted-foreground">
                  {currentType?.description ?? "Employee input field."}
                </div>

                {!isDisplayOnly(field.type) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Placeholder" hint="Optional hint shown before the employee answers.">
                      <input
                        value={field.placeholder}
                        onChange={(event) =>
                          updateField(index, {
                            placeholder: event.target.value,
                          })
                        }
                        placeholder="Search or enter a value"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Help text" hint="Optional short instruction below the control.">
                      <input
                        value={field.helpText}
                        onChange={(event) =>
                          updateField(index, {
                            helpText: event.target.value,
                          })
                        }
                        placeholder="Choose dealers planned for today"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}

                {needsOptions(field.type) && (
                  <div className="mt-4">
                    <Field
                      label="Options"
                      hint="One option per line. These become tappable choices in the mobile app."
                    >
                      <textarea
                        value={field.options.join("\n")}
                        onChange={(event) =>
                          updateField(index, {
                            options: event.target.value.split("\n"),
                          })
                        }
                        placeholder={
                          "Order collection\nPayment follow-up\nStock check\nRelationship visit"
                        }
                        className={textareaClass}
                      />
                    </Field>
                  </div>
                )}

                {supportsNumberRange(field.type) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Minimum" hint="Optional lower bound.">
                      <input
                        type="number"
                        value={field.min ?? ""}
                        onChange={(event) =>
                          updateField(index, {
                            min: optionalNumber(event.target.value),
                          })
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Maximum" hint="Optional upper bound.">
                      <input
                        type="number"
                        value={field.max ?? ""}
                        onChange={(event) =>
                          updateField(index, {
                            max: optionalNumber(event.target.value),
                          })
                        }
                        placeholder="30"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}

                {supportsSelectionRange(field.type) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Minimum selections" hint="Leave empty when there is no minimum.">
                      <input
                        type="number"
                        min="0"
                        value={field.minSelections ?? ""}
                        onChange={(event) =>
                          updateField(index, {
                            minSelections: optionalNumber(event.target.value),
                          })
                        }
                        placeholder="1"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Maximum selections" hint="Useful for journey plans and evidence limits.">
                      <input
                        type="number"
                        min="1"
                        value={field.maxSelections ?? ""}
                        onChange={(event) =>
                          updateField(index, {
                            maxSelections: optionalNumber(event.target.value),
                          })
                        }
                        placeholder="12"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
                  <Field
                    label="Data key"
                    hint="Generated automatically. Change only when an integration requires a stable key."
                  >
                    <input
                      value={field.key}
                      onChange={(event) =>
                        updateField(index, {
                          key: keyFromLabel(event.target.value),
                        })
                      }
                      placeholder={generatedKey || `field_${index + 1}`}
                      className={`${inputClass} sm:w-72`}
                    />
                  </Field>

                  {!isDisplayOnly(field.type) && (
                    <label className="flex h-10 items-center gap-2 text-[14px] font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          updateField(index, {
                            required: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded-[3px] border-input accent-primary"
                      />
                      Employee must answer
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ResponsibilitiesClient() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [rules, setRules] = useState<CapabilityRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCapability, setEditCapability] =
    useState<Capability | null>(null);
  const [createType, setCreateType] = useState("form");
  const [createFields, setCreateFields] = useState<BuilderField[]>([]);
  const [editType, setEditType] = useState("form");
  const [editFields, setEditFields] = useState<BuilderField[]>([]);
  const [ruleType, setRuleType] = useState("all");
  const [ruleValue, setRuleValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [capabilityBody, ruleBody, employeeBody] = await Promise.all([
        apiJson<{ capabilities: Capability[] }>(
          "/api/appliance/capabilities",
        ),
        apiJson<{ rules: CapabilityRule[] }>(
          "/api/appliance/capability-rules",
        ),
        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),
      ]);

      setCapabilities(capabilityBody.capabilities ?? []);
      setRules(ruleBody.rules ?? []);
      setEmployees(employeeBody.employees ?? []);
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

  const activeCount = capabilities.filter(
    (item) => item.isActive !== false,
  ).length;

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.department)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [employees],
  );

  const designations = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.designation)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [employees],
  );

  const roles = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.role)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [employees],
  );

  function validateBuilder(fields: BuilderField[]) {
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      const displayIndex = index + 1;

      if (!field.label.trim()) {
        return `Field ${displayIndex} needs a label.`;
      }

      if (
        needsOptions(field.type) &&
        field.options.map((item) => item.trim()).filter(Boolean).length < 2
      ) {
        return `${field.label} needs at least two options.`;
      }

      if (
        field.min !== null &&
        field.max !== null &&
        field.min > field.max
      ) {
        return `${field.label}: minimum cannot exceed maximum.`;
      }

      if (
        field.minSelections !== null &&
        field.maxSelections !== null &&
        field.minSelections > field.maxSelections
      ) {
        return `${field.label}: minimum selections cannot exceed maximum selections.`;
      }
    }

    return null;
  }

  async function createResponsibility(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const builderError = validateBuilder(createFields);
    if (
      (createType === "form" || createType === "checklist") &&
      builderError
    ) {
      setMessage(builderError);
      return;
    }

    setSaving(true);
    setMessage(null);

    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const key = keyFromLabel(title);

    try {
      await apiJson("/api/appliance/capabilities", {
        method: "POST",
        body: JSON.stringify({
          key,
          title,
          type: createType,
          description:
            String(data.get("description") ?? "").trim() || null,
          icon: null,
          config: toConfig(createType, createFields, key),
        }),
      });

      setShowCreate(false);
      setCreateFields([]);
      setCreateType("form");
      setMessage(`“${title}” is ready to assign.`);
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

  function openEdit(capability: Capability) {
    setEditCapability(capability);
    setEditType(capability.type);
    setEditFields(fieldsFromCapability(capability));
    setMessage(null);
  }

  async function saveEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editCapability) return;

    const builderError = validateBuilder(editFields);
    if (
      (editType === "form" || editType === "checklist") &&
      builderError
    ) {
      setMessage(builderError);
      return;
    }

    setSaving(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);

    try {
      await apiJson(
        `/api/appliance/capabilities/${editCapability.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: String(data.get("title") ?? "").trim(),
            description:
              String(data.get("description") ?? "").trim() || null,
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
      setEditFields([]);
      setMessage("Responsibility updated. Existing employee history is preserved.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCapability(capability: Capability) {
    setSaving(true);

    try {
      await apiJson(`/api/appliance/capabilities/${capability.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: capability.isActive === false,
        }),
      });
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

    const data = new FormData(event.currentTarget);

    const form = event.currentTarget;

    try {
      await apiJson("/api/appliance/capability-rules", {
        method: "POST",
        body: JSON.stringify({
          capabilityId: Number(data.get("capabilityId")),
          subjectType: ruleType,
          subjectValue: ruleType === "all" ? null : ruleValue,
          effect: String(data.get("effect") ?? "allow"),
          priority: 0,
        }),
      });

      setRuleType("all");
      setRuleValue("");
      form.reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: CapabilityRule) {
    await apiJson(`/api/appliance/capability-rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        enabled: !rule.enabled,
      }),
    });

    await load();
  }

  function subjectLabel(rule: CapabilityRule) {
    if (rule.subjectType === "all") {
      return "Everyone";
    }

    if (rule.subjectType === "user") {
      const employee = employees.find(
        (item) => String(item.id) === rule.subjectValue,
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
    if (ruleType === "department") return departments;
    if (ruleType === "designation") return designations;
    if (ruleType === "role") return roles;
    return [];
  }

  const builderEnabled = (type: string) =>
    type === "form" || type === "checklist";

  return (
    <div className="mx-auto w-full max-w-[1500px] p-6">
      <div className="space-y-12">
        <PageIntro
          eyebrow="Workspace"
          title="Responsibilities"
          description="Create reusable work interactions and decide who receives them. Keep the employee experience focused on the real task; the app handles known context automatically."
          action={
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                onClick={() => void load()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={() => {
                  setCreateFields([]);
                  setCreateType("form");
                  setShowCreate(true);
                  setMessage(null);
                }}
              >
                <Plus className="h-4 w-4" />
                Create responsibility
              </PrimaryButton>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-2xl font-semibold tracking-[-0.02em]">
              {activeCount}
            </div>
            <div className="mt-2 text-[14px] font-medium">
              Active responsibilities
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-2xl font-semibold tracking-[-0.02em]">
              {rules.filter((rule) => rule.enabled).length}
            </div>
            <div className="mt-2 text-[14px] font-medium">
              Assignment rules
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-2xl font-semibold tracking-[-0.02em]">
              {capabilities.reduce(
                (sum, item) => sum + (item.directAssignments ?? 0),
                0,
              )}
            </div>
            <div className="mt-2 text-[14px] font-medium">
              Direct employee assignments
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-[14px] leading-6 text-foreground">
            {message}
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[1.45fr_1fr]">
          <Panel>
            <div className="mb-6">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
                <Blocks className="h-5 w-5" />
                Responsibility library
              </div>
              <div className="mt-2 text-[14px] leading-6 text-muted-foreground">
                Reusable work building blocks. Job titles do not hardcode the mobile workspace.
              </div>
            </div>

            {loading ? (
              <div className="flex h-52 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : capabilities.length === 0 ? (
              <EmptyState
                title="No responsibilities yet"
                description="Create the first responsibility, then assign it directly or with an automatic rule."
              />
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {capabilities.map((capability) => {
                  const configuredFields = capability.config?.fields;
                  const fieldCount = Array.isArray(configuredFields)
                    ? configuredFields.length
                    : 0;

                  return (
                    <div
                      key={capability.id}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-foreground">
                            {capability.title}
                          </div>
                          <Pill
                            tone={
                              capability.isActive === false
                                ? "neutral"
                                : "good"
                            }
                          >
                            {capability.isActive === false ? "Off" : "Active"}
                          </Pill>
                        </div>
                        <div className="mt-2 text-[12px] leading-[18px] text-muted-foreground">
                          {responsibilityTypes.find(
                            (item) => item.value === capability.type,
                          )?.label ?? capability.type}
                          {builderEnabled(capability.type)
                            ? ` · ${fieldCount} field${fieldCount === 1 ? "" : "s"}`
                            : ""}
                          {` · ${capability.directAssignments ?? 0} direct · ${capability.assignmentRules ?? 0} rules`}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <SecondaryButton
                          type="button"
                          onClick={() => openEdit(capability)}
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </SecondaryButton>
                        <SecondaryButton
                          type="button"
                          onClick={() => void toggleCapability(capability)}
                          disabled={saving}
                        >
                          {capability.isActive === false ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                          {capability.isActive === false ? "Enable" : "Disable"}
                        </SecondaryButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <div className="mb-6">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
                <Users className="h-5 w-5" />
                Assign automatically
              </div>
              <div className="mt-2 text-[14px] leading-6 text-muted-foreground">
                Use a rule when a responsibility belongs to a group. Individual exceptions remain available in Employees.
              </div>
            </div>

            <form onSubmit={createRule} className="space-y-5">
              <Field label="Responsibility">
                <select
                  name="capabilityId"
                  required
                  className={inputClass}
                >
                  <option value="">Choose responsibility</option>
                  {capabilities
                    .filter((item) => item.isActive !== false)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Who gets it?">
                <select
                  value={ruleType}
                  onChange={(event) => {
                    setRuleType(event.target.value);
                    setRuleValue("");
                  }}
                  className={inputClass}
                >
                  <option value="all">Everyone</option>
                  <option value="department">A department</option>
                  <option value="designation">A designation</option>
                  <option value="role">An employee type / role</option>
                  <option value="user">One employee</option>
                </select>
              </Field>

              {ruleType === "user" && (
                <Field label="Employee">
                  <select
                    value={ruleValue}
                    onChange={(event) => setRuleValue(event.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Choose employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name ?? employee.employeeCode}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {!['all', 'user'].includes(ruleType) && (
                <Field
                  label={
                    ruleType === "department"
                      ? "Department"
                      : ruleType === "designation"
                        ? "Designation"
                        : "Employee type / role"
                  }
                >
                  <input
                    value={ruleValue}
                    onChange={(event) => setRuleValue(event.target.value)}
                    required
                    list="rule-values"
                    className={inputClass}
                    placeholder="Type or choose"
                  />
                  <datalist id="rule-values">
                    {valuesForRuleType().map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </Field>
              )}

              <Field
                label="Rule"
                hint="Allow is normal. Deny creates an exception to a broader inherited rule."
              >
                <select name="effect" className={inputClass}>
                  <option value="allow">Give responsibility</option>
                  <option value="deny">Do not give responsibility</option>
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

            <div className="mt-8 border-t border-border pt-6">
              <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
                Current rules
              </div>

              {rules.length === 0 ? (
                <div className="text-[14px] leading-6 text-muted-foreground">
                  No automatic assignment rules yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const capability = capabilities.find(
                      (item) => item.id === rule.capabilityId,
                    );

                    return (
                      <div
                        key={rule.id}
                        className="rounded-md border border-border p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[14px] font-medium text-foreground">
                              {capability?.title ??
                                `Responsibility ${rule.capabilityId}`}
                            </div>
                            <div className="mt-2 text-[12px] leading-[18px] text-muted-foreground">
                              {rule.effect === "deny" ? "Exclude" : "Give to"}{" "}
                              {subjectLabel(rule)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleRule(rule)}
                            className="transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0"
                          >
                            <Pill tone={rule.enabled ? "good" : "neutral"}>
                              {rule.enabled ? "On" : "Off"}
                            </Pill>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={showCreate}
        title="Create responsibility"
        description="Describe the real work first, then build only the employee interactions that are genuinely needed."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={createResponsibility} className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                name="title"
                required
                placeholder="Daily Dealer Visit"
                className={inputClass}
              />
            </Field>

            <Field label="Work type">
              <select
                value={createType}
                onChange={(event) => setCreateType(event.target.value)}
                className={inputClass}
              >
                {responsibilityTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              placeholder="Visit assigned dealers, record the outcome and attach evidence only when needed."
              className={textareaClass}
            />
          </Field>

          {builderEnabled(createType) && (
            <BuilderFields
              fields={createFields}
              setFields={setCreateFields}
            />
          )}

          <div className="rounded-md border border-border bg-muted/30 p-4 text-[14px] leading-6 text-muted-foreground">
            {responsibilityTypes.find((item) => item.value === createType)?.description}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-6">
            <SecondaryButton
              type="button"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create responsibility
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={editCapability !== null}
        title="Edit responsibility"
        description="Existing employee history is preserved when you change the definition."
        onClose={() => setEditCapability(null)}
        wide
      >
        {editCapability && (
          <form onSubmit={saveEdit} className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <input
                  name="title"
                  required
                  defaultValue={editCapability.title}
                  className={inputClass}
                />
              </Field>

              <Field label="Work type">
                <select
                  value={editType}
                  onChange={(event) => setEditType(event.target.value)}
                  className={inputClass}
                >
                  {responsibilityTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                name="description"
                defaultValue={editCapability.description ?? ""}
                className={textareaClass}
              />
            </Field>

            {builderEnabled(editType) && (
              <BuilderFields
                fields={editFields}
                setFields={setEditFields}
              />
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-6">
              <SecondaryButton
                type="button"
                onClick={() => setEditCapability(null)}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </PrimaryButton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
