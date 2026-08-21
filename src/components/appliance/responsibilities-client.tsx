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
  Camera,
  Edit3,
  Loader2,
  MapPin,
  MousePointerClick,
  Plus,
  RefreshCw,
  Settings2,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

import type {
  CrudOperation,
  Employee,
  PrimitiveCatalog,
  Responsibility,
  ResponsibilityActionStyle,
  ResponsibilityActionVisibilityMode,
  ResponsibilityAppAction,
  ResponsibilityDefinition,
  ResponsibilityField,
  ResponsibilityRule,
  Role,
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

const RESPONSIBILITY_CREATE_ENTITLEMENT = "responsibility.create";

type MeResponse = {
  entitlements?: Record<string, boolean>;
};

type BuilderField = ResponsibilityField & {
  localId: string;
  placeholder: string;
  helpText: string;
  optionsText: string;
};

type BuilderAction = ResponsibilityAppAction & {
  localId: string;
  visibilityStatus: string;
  targetStatus: string;
  captureLocation: boolean;
  captureLocationKey: string;
  locationRequired: boolean;
};

type BuilderState = {
  title: string;
  description: string;
  outputRenderer: string;
  strict: boolean;
  crud: Record<CrudOperation, boolean>;
  fields: BuilderField[];
  actions: BuilderAction[];
};

function localId(prefix = "item") {
  return globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function blankState(catalog?: PrimitiveCatalog | null): BuilderState {
  return {
    title: "",
    description: "",
    outputRenderer: catalog?.output?.[0]?.key ?? "detail",
    strict: true,
    crud: {
      create: true,
      read: true,
      update: true,
      delete: false,
    },
    fields: [],
    actions: [],
  };
}

function blankField(catalog: PrimitiveCatalog | null): BuilderField {
  const primitive = catalog?.input?.[0] ?? {
    key: "text",
    dataType: "string",
  };

  return {
    localId: localId("field"),
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

function blankAction(fields: BuilderField[]): BuilderAction {
  return {
    localId: localId("action"),
    key: "submit",
    label: "Submit",
    operation: "create",
    status: "submitted",
    style: "primary",
    fieldKeys: fields.map((field) => field.key).filter(Boolean),
    requiredFieldKeys: fields
      .filter((field) => field.required)
      .map((field) => field.key)
      .filter(Boolean),
    visibility: { mode: "always" },
    visibilityStatus: "",
    target: {
      strategy: "latest_record",
    },
    targetStatus: "",
    capture: {},
    captureLocation: false,
    captureLocationKey: "location",
    locationRequired: false,
    successMessage: "Recorded.",
  };
}

function fieldFromDefinition(field: ResponsibilityField): BuilderField {
  const config = objectValue(field.config);
  const options = Array.isArray(config.options)
    ? config.options.map(String)
    : [];

  return {
    ...field,
    localId: localId("field"),
    config,
    placeholder:
      typeof config.placeholder === "string" ? config.placeholder : "",
    helpText: typeof config.helpText === "string" ? config.helpText : "",
    optionsText: options.join("\n"),
  };
}

function appFromDefinition(definition: ResponsibilityDefinition) {
  if (definition.app) return definition.app;

  const raw = objectValue(definition.raw);
  const app = objectValue(raw.app);
  const actions = Array.isArray(app.actions)
    ? app.actions
    : [];

  return {
    renderer:
      typeof app.renderer === "string" ? app.renderer : "action_form_v1",
    actions: actions as ResponsibilityAppAction[],
    config: objectValue(app.config),
  };
}

function actionFromDefinition(action: ResponsibilityAppAction): BuilderAction {
  const visibility = objectValue(action.visibility);
  const target = objectValue(action.target);
  const capture = objectValue(action.capture);
  const location = objectValue(capture.location);

  return {
    ...action,
    localId: localId("action"),
    fieldKeys: stringArray(action.fieldKeys),
    requiredFieldKeys: stringArray(action.requiredFieldKeys),
    style: (action.style ?? "primary") as ResponsibilityActionStyle,
    visibility: {
      mode: (visibility.mode ?? "always") as ResponsibilityActionVisibilityMode,
      status:
        typeof visibility.status === "string"
          ? visibility.status
          : undefined,
    },
    visibilityStatus:
      typeof visibility.status === "string" ? visibility.status : "",
    target: {
      strategy:
        target.strategy === "latest_status"
          ? "latest_status"
          : "latest_record",
      status:
        typeof target.status === "string" ? target.status : undefined,
    },
    targetStatus: typeof target.status === "string" ? target.status : "",
    capture: action.capture ?? {},
    captureLocation: Boolean(location.fieldKey),
    captureLocationKey:
      typeof location.fieldKey === "string" ? location.fieldKey : "location",
    locationRequired: location.required === true,
    successMessage: action.successMessage ?? "Recorded.",
  };
}

function stateFromResponsibility(responsibility: Responsibility): BuilderState {
  const definition = responsibility.definition;
  const app = appFromDefinition(definition);

  return {
    title: responsibility.title,
    description: responsibility.description ?? "",
    outputRenderer: definition.output.renderer || "detail",
    strict: definition.input.strict,
    crud: {
      create: definition.crud.create,
      read: definition.crud.read,
      update: definition.crud.update,
      delete: definition.crud.delete,
    },
    // System-captured fields are stored in the same schema so backend strict
    // validation still knows them, but the admin edits them through Actions.
    fields: definition.input.fields
      .filter((field) => objectValue(field.config).hidden !== true)
      .map(fieldFromDefinition),
    actions: (app.actions ?? []).map(actionFromDefinition),
  };
}

function serializeVisibleField(field: BuilderField, index: number): ResponsibilityField {
  const options = field.optionsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const config: Record<string, unknown> = {
    ...field.config,
  };

  delete config.hidden;
  delete config.system;

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

  if (field.inputType === "select" || field.inputType === "multi_select") {
    config.options = options;
  } else {
    delete config.options;
  }

  return {
    key:
      normalizeKey(field.key) ||
      normalizeKey(field.label) ||
      `field_${index + 1}`,
    label: field.label.trim() || `Field ${index + 1}`,
    inputType: field.inputType,
    dataType: field.dataType,
    required: field.required,
    config,
  };
}

function serializeAction(action: BuilderAction): ResponsibilityAppAction {
  const key = normalizeKey(action.key) || normalizeKey(action.label) || "action";
  const visibilityStatus = action.visibilityStatus.trim();
  const targetStatus = action.targetStatus.trim();
  const locationKey = normalizeKey(action.captureLocationKey) || `${key}_location`;

  return {
    key,
    label: action.label.trim() || humanize(key),
    operation: action.operation,
    status: normalizeKey(action.status) || "submitted",
    style: action.style,
    fieldKeys: [...new Set(action.fieldKeys.map(normalizeKey).filter(Boolean))],
    requiredFieldKeys: [
      ...new Set(action.requiredFieldKeys.map(normalizeKey).filter(Boolean)),
    ],
    visibility: {
      mode: action.visibility.mode,
      ...(visibilityStatus ? { status: visibilityStatus } : {}),
    },
    ...(action.operation === "update"
      ? {
          target: {
            strategy: targetStatus ? "latest_status" : "latest_record",
            ...(targetStatus ? { status: targetStatus } : {}),
          } as const,
        }
      : {}),
    ...(action.captureLocation
      ? {
          capture: {
            location: {
              fieldKey: locationKey,
              required: action.locationRequired,
            },
          },
        }
      : {}),
    ...(action.successMessage?.trim()
      ? { successMessage: action.successMessage.trim() }
      : {}),
  };
}

function configFromState(state: BuilderState): ResponsibilityDefinition {
  const visibleFields = state.fields.map(serializeVisibleField);
  const actions = state.actions.map(serializeAction);

  const systemFields: ResponsibilityField[] = [];
  const knownKeys = new Set(visibleFields.map((field) => field.key));

  for (const action of actions) {
    const locationKey = action.capture?.location?.fieldKey;
    if (locationKey && !knownKeys.has(locationKey)) {
      knownKeys.add(locationKey);
      systemFields.push({
        key: locationKey,
        label: `${action.label} location`,
        inputType: "location_point",
        dataType: "geo_point",
        required: false,
        config: {
          hidden: true,
          system: "current_location",
        },
      });
    }
  }

  const crud = { ...state.crud };
  for (const action of actions) {
    crud[action.operation] = true;
  }

  return {
    schemaVersion: 2,
    input: {
      renderer: "form",
      strict: state.strict,
      fields: [...visibleFields, ...systemFields],
    },
    app: {
      renderer: "action_form_v1",
      actions,
      config: {
        generatedBy: "responsibility_app_builder_v1",
      },
    },
    output: {
      renderer: state.outputRenderer || "detail",
      config: {},
    },
    crud,
  };
}

function validateState(state: BuilderState) {
  if (!state.title.trim()) {
    return "Responsibility name is required.";
  }

  const fieldKeys = new Set<string>();

  for (let index = 0; index < state.fields.length; index += 1) {
    const field = state.fields[index];
    const key = normalizeKey(field.key) || normalizeKey(field.label);

    if (!field.label.trim()) return `Field ${index + 1} needs a label.`;
    if (!key) return `${field.label} needs a data key.`;
    if (fieldKeys.has(key)) return `Data key “${key}” is used more than once.`;
    fieldKeys.add(key);

    if (
      (field.inputType === "select" || field.inputType === "multi_select") &&
      field.optionsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean).length < 2
    ) {
      return `${field.label} needs at least two options.`;
    }
  }

  const actionKeys = new Set<string>();

  for (let index = 0; index < state.actions.length; index += 1) {
    const action = state.actions[index];
    const key = normalizeKey(action.key) || normalizeKey(action.label);

    if (!action.label.trim()) return `App action ${index + 1} needs a button label.`;
    if (!key) return `App action ${index + 1} needs an action key.`;
    if (actionKeys.has(key)) return `Action key “${key}” is used more than once.`;
    actionKeys.add(key);

    for (const fieldKey of action.fieldKeys) {
      if (!fieldKeys.has(normalizeKey(fieldKey))) {
        return `${action.label} references a field that no longer exists.`;
      }
    }

    for (const requiredKey of action.requiredFieldKeys) {
      if (!action.fieldKeys.includes(requiredKey)) {
        return `${action.label}: required fields must also be included in that action.`;
      }
    }

    if (
      (action.visibility.mode === "latest_status_is" ||
        action.visibility.mode === "latest_status_is_not") &&
      !action.visibilityStatus.trim()
    ) {
      return `${action.label} needs a status for its visibility rule.`;
    }

    if (action.captureLocation && !normalizeKey(action.captureLocationKey)) {
      return `${action.label} needs a data key for captured location.`;
    }
  }

  return null;
}

function checkInOutTemplate(catalog: PrimitiveCatalog | null): BuilderState {
  const photoPrimitive = catalog?.input.find((item) => item.key === "photo") ?? {
    key: "photo",
    dataType: "media",
  };

  const fields: BuilderField[] = [
    {
      ...blankField(catalog),
      key: "check_in_photo",
      label: "Check-in photo evidence",
      inputType: photoPrimitive.key,
      dataType: photoPrimitive.dataType,
      required: false,
      helpText: "Take a quick photo before checking in.",
    },
    {
      ...blankField(catalog),
      key: "check_out_photo",
      label: "Check-out photo evidence",
      inputType: photoPrimitive.key,
      dataType: photoPrimitive.dataType,
      required: false,
      helpText: "Take a quick photo before checking out.",
    },
  ];

  const checkIn: BuilderAction = {
    ...blankAction(fields),
    key: "check_in",
    label: "Check in",
    operation: "create",
    status: "checked_in",
    style: "primary",
    fieldKeys: ["check_in_photo"],
    requiredFieldKeys: ["check_in_photo"],
    visibility: { mode: "latest_status_is_not", status: "checked_in" },
    visibilityStatus: "checked_in",
    captureLocation: true,
    captureLocationKey: "check_in_location",
    locationRequired: true,
    successMessage: "Checked in.",
  };

  const checkOut: BuilderAction = {
    ...blankAction(fields),
    key: "check_out",
    label: "Check out",
    operation: "create",
    status: "checked_out",
    style: "secondary",
    fieldKeys: ["check_out_photo"],
    requiredFieldKeys: ["check_out_photo"],
    visibility: { mode: "latest_status_is", status: "checked_in" },
    visibilityStatus: "checked_in",
    captureLocation: true,
    captureLocationKey: "check_out_location",
    locationRequired: true,
    successMessage: "Checked out.",
  };

  return {
    title: "Attendance",
    description: "Check in and check out with photo and location evidence.",
    outputRenderer: "snapshot",
    strict: true,
    crud: {
      create: true,
      read: true,
      update: false,
      delete: false,
    },
    fields,
    actions: [checkIn, checkOut],
  };
}

function PhonePreview({ state }: { state: BuilderState }) {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[28px] border bg-background p-3 shadow-sm">
      <div className="rounded-[22px] border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          Employee app preview
        </div>
        <div className="mt-5 text-xl font-semibold">
          {state.title.trim() || "Responsibility"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {state.description.trim() || "The employee sees the app you define here."}
        </div>

        <div className="mt-5 space-y-3">
          {state.actions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Add an app action such as Submit, Check in or Check out.
            </div>
          ) : (
            state.actions.map((action) => {
              const selected = state.fields.filter((field) =>
                action.fieldKeys.includes(field.key),
              );
              return (
                <div key={action.localId} className="rounded-xl border p-3">
                  {selected.map((field) => (
                    <div key={field.localId} className="mb-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                      {field.inputType === "photo" && <Camera className="mr-1 inline h-3.5 w-3.5" />}
                      {field.label || field.key || "Field"}
                      {action.requiredFieldKeys.includes(field.key) ? " *" : ""}
                    </div>
                  ))}
                  {action.captureLocation && (
                    <div className="mb-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                      <MapPin className="mr-1 inline h-3.5 w-3.5" />
                      Current location captured automatically
                    </div>
                  )}
                  <div
                    className={[
                      "rounded-md px-3 py-2 text-center text-sm font-semibold",
                      action.style === "primary"
                        ? "bg-primary text-primary-foreground"
                        : action.style === "danger"
                          ? "bg-destructive text-white"
                          : "border bg-background",
                    ].join(" ")}
                  >
                    {action.label || "Action"}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {humanize(action.operation)} → {action.status || "submitted"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
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
  function updateField(index: number, patch: Partial<BuilderField>) {
    onChange({
      ...state,
      fields: state.fields.map((field, itemIndex) =>
        itemIndex === index ? { ...field, ...patch } : field,
      ),
    });
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= state.fields.length) return;
    const fields = [...state.fields];
    const [item] = fields.splice(index, 1);
    fields.splice(target, 0, item);
    onChange({ ...state, fields });
  }

  function updateAction(index: number, patch: Partial<BuilderAction>) {
    onChange({
      ...state,
      actions: state.actions.map((action, itemIndex) =>
        itemIndex === index ? { ...action, ...patch } : action,
      ),
    });
  }

  function removeField(index: number) {
    const removed = state.fields[index];
    onChange({
      ...state,
      fields: state.fields.filter((_, itemIndex) => itemIndex !== index),
      actions: state.actions.map((action) => ({
        ...action,
        fieldKeys: action.fieldKeys.filter((key) => key !== removed.key),
        requiredFieldKeys: action.requiredFieldKeys.filter(
          (key) => key !== removed.key,
        ),
      })),
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            value={state.title}
            onChange={(event) => onChange({ ...state, title: event.target.value })}
            className={inputClass}
            placeholder="Machine inspection"
            required
          />
        </Field>

        <Field label="Dashboard output" hint="How stored records are projected to the office.">
          <select
            value={state.outputRenderer}
            onChange={(event) =>
              onChange({ ...state, outputRenderer: event.target.value })
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
            onChange({ ...state, description: event.target.value })
          }
          className={textareaClass}
          placeholder="What work does this Responsibility represent?"
        />
      </Field>

      <Panel className="border-primary/25 bg-primary/[0.03]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <Smartphone className="h-5 w-5" />
              Employee app
            </div>
            <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Build the actual employee screen here. Fields collect data; actions become buttons. The phone renders this metadata without a new business route.
            </div>
          </div>
          <SecondaryButton
            type="button"
            onClick={() => {
              const template = checkInOutTemplate(catalog);
              onChange({
                ...template,
                title: state.title.trim() || template.title,
                description: state.description.trim() || template.description,
              });
            }}
          >
            Use check-in / check-out example
          </SecondaryButton>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel className="bg-muted/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Data fields</div>
                <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  These are reusable inputs. Each button below chooses which fields it needs.
                </div>
              </div>
              <SecondaryButton
                type="button"
                onClick={() =>
                  onChange({
                    ...state,
                    fields: [...state.fields, blankField(catalog)],
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
                  title="No employee fields"
                  description="A button can still record a timestamp/status with no manual input."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {state.fields.map((field, index) => (
                  <div key={field.localId} className="rounded-lg border bg-background p-4">
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
                          onClick={() => removeField(index)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border"
                          aria-label="Remove field"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Label">
                        <input
                          value={field.label}
                          onChange={(event) => {
                            const previousAuto = normalizeKey(field.label);
                            const label = event.target.value;
                            const followsLabel = !field.key || field.key === previousAuto;
                            const nextKey = followsLabel ? normalizeKey(label) : field.key;

                            updateField(index, { label, key: nextKey });

                            if (field.key && nextKey !== field.key) {
                              onChange({
                                ...state,
                                fields: state.fields.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, label, key: nextKey }
                                    : item,
                                ),
                                actions: state.actions.map((action) => ({
                                  ...action,
                                  fieldKeys: action.fieldKeys.map((key) =>
                                    key === field.key ? nextKey : key,
                                  ),
                                  requiredFieldKeys: action.requiredFieldKeys.map((key) =>
                                    key === field.key ? nextKey : key,
                                  ),
                                })),
                              });
                            }
                          }}
                          className={inputClass}
                          placeholder="Photo evidence"
                        />
                      </Field>

                      <Field label="Input primitive">
                        <select
                          value={field.inputType}
                          onChange={(event) => {
                            const inputType = event.target.value;
                            const primitive = catalog?.input.find(
                              (item) => item.key === inputType,
                            );
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

                      <Field label="Data key" hint="Stable machine-readable key.">
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

                      <Field label="Storage type">
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
                            updateField(index, { placeholder: event.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Help text">
                        <input
                          value={field.helpText}
                          onChange={(event) =>
                            updateField(index, { helpText: event.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    {(field.inputType === "select" ||
                      field.inputType === "multi_select") && (
                      <div className="mt-4">
                        <Field label="Options" hint="One option per line.">
                          <textarea
                            value={field.optionsText}
                            onChange={(event) =>
                              updateField(index, { optionsText: event.target.value })
                            }
                            className={textareaClass}
                          />
                        </Field>
                      </div>
                    )}

                    <label className="mt-4 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          updateField(index, { required: event.target.checked })
                        }
                      />
                      Required when this field is used by a simple/default form
                    </label>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MousePointerClick className="h-4 w-4" />
                  App actions / buttons
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  One Responsibility can have several buttons. Each button decides what to collect, what CRUD operation to run and when it is visible.
                </div>
              </div>
              <SecondaryButton
                type="button"
                onClick={() =>
                  onChange({
                    ...state,
                    actions: [...state.actions, blankAction(state.fields)],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add action
              </SecondaryButton>
            </div>

            {state.actions.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="No app buttons"
                  description="Add an action to make this Responsibility executable from the phone."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {state.actions.map((action, index) => (
                  <div key={action.localId} className="rounded-lg border bg-muted/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {action.label.trim() || `Action ${index + 1}`}
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {normalizeKey(action.key) || "action_key"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...state,
                            actions: state.actions.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-md border"
                        aria-label="Remove action"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Button label">
                        <input
                          value={action.label}
                          onChange={(event) => {
                            const previousAuto = normalizeKey(action.label);
                            const label = event.target.value;
                            updateAction(index, {
                              label,
                              key:
                                !action.key || action.key === previousAuto
                                  ? normalizeKey(label)
                                  : action.key,
                            });
                          }}
                          className={inputClass}
                          placeholder="Check in"
                        />
                      </Field>

                      <Field label="Action key">
                        <input
                          value={action.key}
                          onChange={(event) =>
                            updateAction(index, {
                              key: normalizeKey(event.target.value),
                            })
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="CRUD operation">
                        <select
                          value={action.operation}
                          onChange={(event) =>
                            updateAction(index, {
                              operation: event.target.value as "create" | "update",
                            })
                          }
                          className={inputClass}
                        >
                          <option value="create">Create new record</option>
                          <option value="update">Update latest record</option>
                        </select>
                      </Field>

                      <Field
                        label="Record status after action"
                        hint="Useful for state such as checked_in / checked_out / completed."
                      >
                        <input
                          value={action.status}
                          onChange={(event) =>
                            updateAction(index, {
                              status: normalizeKey(event.target.value),
                            })
                          }
                          className={inputClass}
                          placeholder="submitted"
                        />
                      </Field>

                      <Field label="Button style">
                        <select
                          value={action.style}
                          onChange={(event) =>
                            updateAction(index, {
                              style: event.target.value as ResponsibilityActionStyle,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                          <option value="danger">Danger</option>
                        </select>
                      </Field>

                      <Field label="Show button when">
                        <select
                          value={action.visibility.mode}
                          onChange={(event) =>
                            updateAction(index, {
                              visibility: {
                                mode: event.target.value as ResponsibilityActionVisibilityMode,
                              },
                            })
                          }
                          className={inputClass}
                        >
                          <option value="always">Always</option>
                          <option value="no_record">No record exists yet</option>
                          <option value="latest_status_is">Latest status IS...</option>
                          <option value="latest_status_is_not">Latest status IS NOT...</option>
                        </select>
                      </Field>
                    </div>

                    {(action.visibility.mode === "latest_status_is" ||
                      action.visibility.mode === "latest_status_is_not") && (
                      <div className="mt-4">
                        <Field label="Visibility status">
                          <input
                            value={action.visibilityStatus}
                            onChange={(event) =>
                              updateAction(index, {
                                visibilityStatus: normalizeKey(event.target.value),
                              })
                            }
                            className={inputClass}
                            placeholder="checked_in"
                          />
                        </Field>
                      </div>
                    )}

                    {action.operation === "update" && (
                      <div className="mt-4">
                        <Field
                          label="Target record status (optional)"
                          hint="Blank = latest record. A value such as open updates the latest matching record."
                        >
                          <input
                            value={action.targetStatus}
                            onChange={(event) =>
                              updateAction(index, {
                                targetStatus: normalizeKey(event.target.value),
                              })
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Fields shown for this action
                      </div>
                      {state.fields.length === 0 ? (
                        <div className="mt-2 text-sm text-muted-foreground">No manual fields configured.</div>
                      ) : (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {state.fields.map((field) => {
                            const selected = action.fieldKeys.includes(field.key);
                            const required = action.requiredFieldKeys.includes(field.key);
                            return (
                              <div key={field.localId} className="rounded-md border p-3">
                                <label className="flex items-center gap-2 text-sm font-medium">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(event) => {
                                      const fieldKeys = event.target.checked
                                        ? [...new Set([...action.fieldKeys, field.key])]
                                        : action.fieldKeys.filter((key) => key !== field.key);
                                      updateAction(index, {
                                        fieldKeys,
                                        requiredFieldKeys: event.target.checked
                                          ? action.requiredFieldKeys
                                          : action.requiredFieldKeys.filter(
                                              (key) => key !== field.key,
                                            ),
                                      });
                                    }}
                                  />
                                  {field.label || field.key}
                                </label>
                                {selected && (
                                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      checked={required}
                                      onChange={(event) =>
                                        updateAction(index, {
                                          requiredFieldKeys: event.target.checked
                                            ? [
                                                ...new Set([
                                                  ...action.requiredFieldKeys,
                                                  field.key,
                                                ]),
                                              ]
                                            : action.requiredFieldKeys.filter(
                                                (key) => key !== field.key,
                                              ),
                                        })
                                      }
                                    />
                                    Required before pressing this button
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 rounded-lg border bg-background p-4">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={action.captureLocation}
                          onChange={(event) =>
                            updateAction(index, {
                              captureLocation: event.target.checked,
                              captureLocationKey:
                                action.captureLocationKey ||
                                `${normalizeKey(action.key) || "action"}_location`,
                            })
                          }
                        />
                        <MapPin className="h-4 w-4" />
                        Capture current location automatically
                      </label>

                      {action.captureLocation && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <Field label="Location data key">
                            <input
                              value={action.captureLocationKey}
                              onChange={(event) =>
                                updateAction(index, {
                                  captureLocationKey: normalizeKey(event.target.value),
                                })
                              }
                              className={inputClass}
                            />
                          </Field>
                          <label className="flex items-center gap-2 self-end pb-3 text-sm">
                            <input
                              type="checkbox"
                              checked={action.locationRequired}
                              onChange={(event) =>
                                updateAction(index, {
                                  locationRequired: event.target.checked,
                                })
                              }
                            />
                            Block action if location is unavailable
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <Field label="Success message">
                        <input
                          value={action.successMessage ?? ""}
                          onChange={(event) =>
                            updateAction(index, {
                              successMessage: event.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Recorded."
                        />
                      </Field>
                    </div>
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
              {(["create", "read", "update", "delete"] as CrudOperation[]).map(
                (operation) => (
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
                ),
              )}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.strict}
                onChange={(event) =>
                  onChange({ ...state, strict: event.target.checked })
                }
              />
              Reject undeclared payload fields
            </label>
          </Panel>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <PhonePreview state={state} />
        </div>
      </div>
    </div>
  );
}

export default function ResponsibilitiesClient() {
  const [catalog, setCatalog] = useState<PrimitiveCatalog | null>(null);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [rules, setRules] = useState<ResponsibilityRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createState, setCreateState] = useState<BuilderState>(blankState());
  const [editing, setEditing] = useState<Responsibility | null>(null);
  const [editState, setEditState] = useState<BuilderState>(blankState());

  const [ruleResponsibilityId, setRuleResponsibilityId] = useState<number | null>(null);
  const [ruleType, setRuleType] = useState("all");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleEffect, setRuleEffect] = useState("allow");

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
        apiJson<{ primitives: PrimitiveCatalog }>("/api/appliance/primitives"),
        apiJson<{ responsibilities: Responsibility[] }>(
          "/api/appliance/responsibilities",
        ),
        apiJson<{ rules: ResponsibilityRule[] }>(
          "/api/appliance/responsibility-rules",
        ),
        apiJson<{ employees: Employee[] }>("/api/appliance/employees"),
        apiJson<{ roles: Role[] }>("/api/appliance/roles"),
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
        error instanceof Error ? error.message : "Unable to load Responsibilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = responsibilities.filter((item) => item.isActive !== false).length;

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((employee) => employee.department)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [employees],
  );

  const designations = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((employee) => employee.designation)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [employees],
  );

  function openCreate() {
    setCreateState(blankState(catalog));
    setShowCreate(true);
    setMessage(null);
  }

  async function createResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setMessage("Responsibility customization is not enabled for this company.");
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
      setMessage(`“${createState.title.trim()}” app is ready to assign.`);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create Responsibility.",
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

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
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
      await apiJson(`/api/appliance/responsibilities/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editState.title.trim(),
          description: editState.description.trim() || null,
          config: configFromState(editState),
        }),
      });

      setEditing(null);
      setMessage(
        "Responsibility app updated. Employees receive the new definition on workspace refresh; existing records and Workflow history are preserved.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update Responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleResponsibility(responsibility: Responsibility) {
    setSaving(true);
    setMessage(null);

    try {
      await apiJson(`/api/appliance/responsibilities/${responsibility.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: responsibility.isActive === false,
        }),
      });
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
          employee.name ?? employee.employeeCode ?? `Employee ${employee.id}`,
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

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ruleResponsibilityId) return;

    if (ruleType !== "all" && !ruleValue) {
      setMessage("Choose who this assignment rule applies to.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiJson("/api/appliance/responsibility-rules", {
        method: "POST",
        body: JSON.stringify({
          responsibilityId: ruleResponsibilityId,
          subjectType: ruleType,
          subjectValue: ruleType === "all" ? null : ruleValue,
          roleId: ruleType === "role" ? Number(ruleValue) : undefined,
          effect: ruleEffect,
          priority: 0,
          config: {},
        }),
      });

      setRuleValue("");
      setRuleType("all");
      setRuleEffect("allow");
      setRuleResponsibilityId(null);
      setMessage("Assignment rule created.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create assignment rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: ResponsibilityRule) {
    setSaving(true);
    try {
      await apiJson(`/api/appliance/responsibility-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
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
        description="A Responsibility is now an employee micro-app: data fields + buttons + record state + dashboard output. Workflows decide when its CRUD operations are allowed."
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

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Active apps</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{catalog?.input.length ?? 0}</div>
          <div className="mt-1 text-sm text-muted-foreground">Input primitives</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">{catalog?.output.length ?? 0}</div>
          <div className="mt-1 text-sm text-muted-foreground">Output renderers</div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">
            {responsibilities.reduce(
              (total, item) => total + appFromDefinition(item.definition).actions.length,
              0,
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">App actions</div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : responsibilities.length === 0 ? (
        <EmptyState
          title="No Responsibilities yet"
          description="Create the first employee app. The mobile workspace and dashboard Work surface are generated from it."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {responsibilities.map((responsibility) => {
            const definition = responsibility.definition;
            const app = appFromDefinition(definition);
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
                      Edit app
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

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <div className="text-xl font-semibold">
                      {definition.input.fields.filter(
                        (field) => objectValue(field.config).hidden !== true,
                      ).length}
                    </div>
                    <div className="text-xs text-muted-foreground">fields</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xl font-semibold">{app.actions.length}</div>
                    <div className="text-xs text-muted-foreground">buttons</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-semibold">
                      {humanize(definition.output.renderer)}
                    </div>
                    <div className="text-xs text-muted-foreground">output</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xl font-semibold">
                      {responsibility.directAssignments ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">assigned</div>
                  </div>
                </div>

                {app.actions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {app.actions.map((action) => (
                      <Pill key={action.key} tone="info">
                        {action.label}
                      </Pill>
                    ))}
                  </div>
                )}

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
        title="Create Responsibility App"
        description="Build the employee experience here: inputs, action buttons, state and dashboard output."
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
              Create app
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.title}` : "Edit Responsibility"}
        description="The stable Responsibility key and historical records stay intact while the app definition evolves."
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
              Save app
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(ruleResponsibilityId)}
        title="Assignment rule"
        description="Rules decide who receives this Responsibility app."
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
