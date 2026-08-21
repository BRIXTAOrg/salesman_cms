"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Blocks,
  Camera,
  CheckSquare2,
  ChevronDown,
  CircleDot,
  Edit3,
  FileText,
  GripVertical,
  Hash,
  Image,
  ListChecks,
  Loader2,
  MapPin,
  MousePointerClick,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings2,
  Signature,
  Smartphone,
  TextCursorInput,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
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
import { apiJson, cx } from "./client";
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

type CanvasBlock = {
  id: string;
  kind: "field" | "action";
  refId: string;
};

type BuilderState = {
  title: string;
  description: string;
  outputRenderer: string;
  strict: boolean;
  crud: Record<CrudOperation, boolean>;
  fields: BuilderField[];
  actions: BuilderAction[];
  layout: CanvasBlock[];
};

type SelectedBlock =
  | { kind: "field"; refId: string }
  | { kind: "action"; refId: string }
  | null;

type PaletteDragData =
  | {
      source: "palette";
      kind: "field";
      primitiveKey: string;
      dataType: string;
    }
  | {
      source: "palette";
      kind: "action";
    };

function localId(prefix = "item") {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

function uniqueKey(base: string, used: Set<string>) {
  const normalized = normalizeKey(base) || "field";
  if (!used.has(normalized)) return normalized;

  let counter = 2;
  while (used.has(`${normalized}_${counter}`)) counter += 1;
  return `${normalized}_${counter}`;
}

function primitiveLabel(key: string) {
  const labels: Record<string, string> = {
    text: "Short text",
    textarea: "Long text",
    number: "Number",
    currency: "Amount",
    select: "Single choice",
    multi_select: "Multiple choice",
    toggle: "Yes / No",
    checkbox: "Checkbox",
    date: "Date",
    datetime: "Date & time",
    photo: "Photo",
    image: "Photo",
    file: "File",
    signature: "Signature",
    location_point: "Location",
    location_route: "Route",
    barcode: "Barcode",
    qr: "QR code",
  };
  return labels[key] ?? humanize(key);
}

function primitiveIcon(key: string) {
  const normalized = key.toLowerCase();

  if (["photo", "image", "camera", "upload_photo"].includes(normalized)) {
    return Camera;
  }
  if (normalized.includes("location") || normalized.includes("route")) {
    return MapPin;
  }
  if (normalized.includes("qr") || normalized.includes("barcode")) {
    return QrCode;
  }
  if (normalized.includes("signature")) {
    return Signature;
  }
  if (normalized.includes("file")) {
    return FileText;
  }
  if (normalized.includes("number") || normalized.includes("currency")) {
    return Hash;
  }
  if (
    normalized.includes("select") ||
    normalized.includes("choice") ||
    normalized.includes("dropdown")
  ) {
    return ListChecks;
  }
  if (
    normalized.includes("toggle") ||
    normalized.includes("checkbox") ||
    normalized.includes("boolean")
  ) {
    return CheckSquare2;
  }
  return TextCursorInput;
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
    layout: [],
  };
}

function createField(
  primitiveKey: string,
  dataType: string,
  existingFields: BuilderField[],
): BuilderField {
  const used = new Set(existingFields.map((field) => normalizeKey(field.key)));
  const label = primitiveLabel(primitiveKey);
  const key = uniqueKey(normalizeKey(label), used);

  return {
    localId: localId("field"),
    key,
    label,
    inputType: primitiveKey,
    dataType,
    required: false,
    config: {},
    placeholder: "",
    helpText: "",
    optionsText:
      primitiveKey === "select" || primitiveKey === "multi_select"
        ? "Option 1\nOption 2"
        : "",
  };
}

function blankAction(fields: BuilderField[]): BuilderAction {
  const used = new Set<string>();
  const key = uniqueKey("submit", used);

  return {
    localId: localId("action"),
    key,
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
  const actions = Array.isArray(app.actions) ? app.actions : [];

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
      mode: (visibility.mode ??
        "always") as ResponsibilityActionVisibilityMode,
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
      status: typeof target.status === "string" ? target.status : undefined,
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

function layoutFromDefinition(
  definition: ResponsibilityDefinition,
  fields: BuilderField[],
  actions: BuilderAction[],
): CanvasBlock[] {
  const app = appFromDefinition(definition);
  const config = objectValue(app.config);
  const rawLayout = Array.isArray(config.layout) ? config.layout : [];

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const actionByKey = new Map(actions.map((action) => [action.key, action]));
  const layout: CanvasBlock[] = [];
  const usedRefs = new Set<string>();

  for (const raw of rawLayout) {
    const item = objectValue(raw);
    const kind = item.kind === "action" ? "action" : "field";
    const key = typeof item.key === "string" ? item.key : "";

    if (kind === "field") {
      const field = fieldByKey.get(key);
      if (field && !usedRefs.has(field.localId)) {
        usedRefs.add(field.localId);
        layout.push({
          id: localId("block"),
          kind: "field",
          refId: field.localId,
        });
      }
    } else {
      const action = actionByKey.get(key);
      if (action && !usedRefs.has(action.localId)) {
        usedRefs.add(action.localId);
        layout.push({
          id: localId("block"),
          kind: "action",
          refId: action.localId,
        });
      }
    }
  }

  for (const field of fields) {
    if (!usedRefs.has(field.localId)) {
      layout.push({
        id: localId("block"),
        kind: "field",
        refId: field.localId,
      });
    }
  }

  for (const action of actions) {
    if (!usedRefs.has(action.localId)) {
      layout.push({
        id: localId("block"),
        kind: "action",
        refId: action.localId,
      });
    }
  }

  return layout;
}

function stateFromResponsibility(
  responsibility: Responsibility,
): BuilderState {
  const definition = responsibility.definition;
  const app = appFromDefinition(definition);

  const fields = definition.input.fields
    .filter((field) => objectValue(field.config).hidden !== true)
    .map(fieldFromDefinition);
  const actions = (app.actions ?? []).map(actionFromDefinition);

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
    fields,
    actions,
    layout: layoutFromDefinition(definition, fields, actions),
  };
}

function serializeVisibleField(
  field: BuilderField,
  index: number,
): ResponsibilityField {
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
    label: field.label.trim() || `Field ${index + 1}`,
    inputType: field.inputType,
    dataType: field.dataType,
    required: field.required,
    config,
  };
}

function serializeAction(
  action: BuilderAction,
): ResponsibilityAppAction {
  const key =
    normalizeKey(action.key) ||
    normalizeKey(action.label) ||
    "action";
  const visibilityStatus = action.visibilityStatus.trim();
  const targetStatus = action.targetStatus.trim();
  const locationKey =
    normalizeKey(action.captureLocationKey) ||
    `${key}_location`;

  return {
    key,
    label: action.label.trim() || humanize(key),
    operation: action.operation,
    status: normalizeKey(action.status) || "submitted",
    style: action.style,
    fieldKeys: [
      ...new Set(action.fieldKeys.map(normalizeKey).filter(Boolean)),
    ],
    requiredFieldKeys: [
      ...new Set(
        action.requiredFieldKeys.map(normalizeKey).filter(Boolean),
      ),
    ],
    visibility: {
      mode: action.visibility.mode,
      ...(visibilityStatus ? { status: visibilityStatus } : {}),
    },
    ...(action.operation === "update"
      ? {
          target: {
            strategy: targetStatus
              ? "latest_status"
              : "latest_record",
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

function configFromState(
  state: BuilderState,
): ResponsibilityDefinition {
  const visibleFields = state.fields.map(serializeVisibleField);
  const actions = state.actions.map(serializeAction);

  const serializedFieldByLocal = new Map(
    state.fields.map((field, index) => [
      field.localId,
      visibleFields[index],
    ]),
  );
  const serializedActionByLocal = new Map(
    state.actions.map((action, index) => [
      action.localId,
      actions[index],
    ]),
  );

  const systemFields: ResponsibilityField[] = [];
  const knownKeys = new Set(
    visibleFields.map((field) => field.key),
  );

  for (const action of actions) {
    const locationKey =
      action.capture?.location?.fieldKey;
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

  const layout = state.layout.flatMap((block) => {
    if (block.kind === "field") {
      const field = serializedFieldByLocal.get(block.refId);
      return field
        ? [{ kind: "field", key: field.key }]
        : [];
    }

    const action = serializedActionByLocal.get(block.refId);
    return action
      ? [{ kind: "action", key: action.key }]
      : [];
  });

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
        generatedBy: "responsibility_canvas_builder_v2",
        layout,
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
    return "Give this app a name.";
  }

  const fieldKeys = new Set<string>();

  for (let index = 0; index < state.fields.length; index += 1) {
    const field = state.fields[index];
    const key =
      normalizeKey(field.key) ||
      normalizeKey(field.label);

    if (!field.label.trim()) {
      return `Block ${index + 1} needs a label.`;
    }
    if (!key) {
      return `${field.label} needs an internal key.`;
    }
    if (fieldKeys.has(key)) {
      return `The field key “${key}” is used twice.`;
    }
    fieldKeys.add(key);

    if (
      (field.inputType === "select" ||
        field.inputType === "multi_select") &&
      field.optionsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean).length < 2
    ) {
      return `${field.label} needs at least two choices.`;
    }
  }

  const actionKeys = new Set<string>();

  for (let index = 0; index < state.actions.length; index += 1) {
    const action = state.actions[index];
    const key =
      normalizeKey(action.key) ||
      normalizeKey(action.label);

    if (!action.label.trim()) {
      return `Button ${index + 1} needs a label.`;
    }
    if (!key) {
      return `Button ${index + 1} needs an internal key.`;
    }
    if (actionKeys.has(key)) {
      return `The action key “${key}” is used twice.`;
    }
    actionKeys.add(key);

    for (const fieldKey of action.fieldKeys) {
      if (!fieldKeys.has(normalizeKey(fieldKey))) {
        return `${action.label} references a field that no longer exists.`;
      }
    }

    for (const requiredKey of action.requiredFieldKeys) {
      if (!action.fieldKeys.includes(requiredKey)) {
        return `${action.label}: a required field must also be enabled for that button.`;
      }
    }

    if (
      (action.visibility.mode === "latest_status_is" ||
        action.visibility.mode === "latest_status_is_not") &&
      !action.visibilityStatus.trim()
    ) {
      return `${action.label} needs a state for its visibility rule.`;
    }
  }

  return null;
}

function checkInOutTemplate(
  catalog: PrimitiveCatalog | null,
): BuilderState {
  const photoPrimitive =
    catalog?.input.find((item) => item.key === "photo") ?? {
      key: "photo",
      dataType: "media",
    };

  const checkInPhoto = createField(
    photoPrimitive.key,
    photoPrimitive.dataType,
    [],
  );
  checkInPhoto.key = "check_in_photo";
  checkInPhoto.label = "Check-in photo";
  checkInPhoto.helpText =
    "Take a quick photo before checking in.";

  const checkOutPhoto = createField(
    photoPrimitive.key,
    photoPrimitive.dataType,
    [checkInPhoto],
  );
  checkOutPhoto.key = "check_out_photo";
  checkOutPhoto.label = "Check-out photo";
  checkOutPhoto.helpText =
    "Take a quick photo before checking out.";

  const fields = [checkInPhoto, checkOutPhoto];

  const checkIn: BuilderAction = {
    ...blankAction(fields),
    localId: localId("action"),
    key: "check_in",
    label: "Check in",
    operation: "create",
    status: "checked_in",
    style: "primary",
    fieldKeys: ["check_in_photo"],
    requiredFieldKeys: ["check_in_photo"],
    visibility: {
      mode: "latest_status_is_not",
      status: "checked_in",
    },
    visibilityStatus: "checked_in",
    captureLocation: true,
    captureLocationKey: "check_in_location",
    locationRequired: true,
    successMessage: "Checked in.",
  };

  const checkOut: BuilderAction = {
    ...blankAction(fields),
    localId: localId("action"),
    key: "check_out",
    label: "Check out",
    operation: "create",
    status: "checked_out",
    style: "secondary",
    fieldKeys: ["check_out_photo"],
    requiredFieldKeys: ["check_out_photo"],
    visibility: {
      mode: "latest_status_is",
      status: "checked_in",
    },
    visibilityStatus: "checked_in",
    captureLocation: true,
    captureLocationKey: "check_out_location",
    locationRequired: true,
    successMessage: "Checked out.",
  };

  const layout: CanvasBlock[] = [
    {
      id: localId("block"),
      kind: "field",
      refId: checkInPhoto.localId,
    },
    {
      id: localId("block"),
      kind: "action",
      refId: checkIn.localId,
    },
    {
      id: localId("block"),
      kind: "field",
      refId: checkOutPhoto.localId,
    },
    {
      id: localId("block"),
      kind: "action",
      refId: checkOut.localId,
    },
  ];

  return {
    title: "Attendance",
    description:
      "Check in and check out with photo and location evidence.",
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
    layout,
  };
}

function PaletteBlock({
  label,
  subtitle,
  icon: Icon,
  data,
}: {
  label: string;
  subtitle?: string;
  icon: typeof Blocks;
  data: PaletteDragData;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id:
      data.kind === "field"
        ? `palette-field-${data.primitiveKey}`
        : "palette-action",
    data,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className={cx(
        "flex w-full cursor-grab items-center gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.03] active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      <GripVertical className="ml-auto h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function SortableCanvasBlock({
  block,
  selected,
  field,
  action,
  onSelect,
  onRemove,
}: {
  block: CanvasBlock;
  selected: boolean;
  field?: BuilderField;
  action?: BuilderAction;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: {
      source: "canvas",
      blockId: block.id,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon =
    block.kind === "action"
      ? MousePointerClick
      : primitiveIcon(field?.inputType ?? "text");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        "group relative rounded-xl border bg-background p-4 transition",
        selected
          ? "border-primary ring-2 ring-primary/10"
          : "hover:border-foreground/20",
        isDragging && "z-20 opacity-60 shadow-lg",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-0.5 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          {block.kind === "field" && field ? (
            <>
              <div className="text-sm font-semibold">
                {field.label || primitiveLabel(field.inputType)}
                {field.required ? " *" : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {primitiveLabel(field.inputType)}
              </div>
            </>
          ) : action ? (
            <>
              <div
                className={cx(
                  "inline-flex min-w-32 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold",
                  action.style === "primary"
                    ? "bg-primary text-primary-foreground"
                    : action.style === "danger"
                      ? "bg-destructive text-white"
                      : "border bg-background",
                )}
              >
                {action.label || "Button"}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                After tap → {humanize(action.status || "submitted")}
                {action.captureLocation ? " · captures location" : ""}
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Remove block"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Canvas({
  state,
  selected,
  onSelect,
  onRemove,
}: {
  state: BuilderState;
  selected: SelectedBlock;
  onSelect: (selected: SelectedBlock) => void;
  onRemove: (block: CanvasBlock) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "responsibility-canvas",
  });

  const fieldById = useMemo(
    () => new Map(state.fields.map((field) => [field.localId, field])),
    [state.fields],
  );
  const actionById = useMemo(
    () => new Map(state.actions.map((action) => [action.localId, action])),
    [state.actions],
  );

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "min-h-[600px] rounded-2xl border-2 border-dashed bg-muted/20 p-4 transition md:p-6",
        isOver && "border-primary bg-primary/[0.04]",
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employee app canvas
          </div>
          <div className="mt-1 text-lg font-semibold">
            {state.title.trim() || "Untitled Responsibility"}
          </div>
          <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drag blocks here. Drag existing blocks to reorder them.
          </div>
        </div>
        <Smartphone className="h-5 w-5 text-muted-foreground" />
      </div>

      {state.layout.length === 0 ? (
        <div className="flex min-h-[470px] items-center justify-center rounded-xl border border-dashed bg-background/70 p-8 text-center">
          <div>
            <Blocks className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="mt-4 text-base font-semibold">
              Drop your first block here
            </div>
            <div className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Start with a photo, text field, choice, location, or button.
            </div>
          </div>
        </div>
      ) : (
        <SortableContext
          items={state.layout.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {state.layout.map((block) => {
              const field =
                block.kind === "field"
                  ? fieldById.get(block.refId)
                  : undefined;
              const action =
                block.kind === "action"
                  ? actionById.get(block.refId)
                  : undefined;
              const isSelected =
                selected?.kind === block.kind &&
                selected.refId === block.refId;

              return (
                <SortableCanvasBlock
                  key={block.id}
                  block={block}
                  selected={isSelected}
                  field={field}
                  action={action}
                  onSelect={() =>
                    onSelect({
                      kind: block.kind,
                      refId: block.refId,
                    })
                  }
                  onRemove={() => onRemove(block)}
                />
              );
            })}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function PhonePreview({ state }: { state: BuilderState }) {
  const fieldById = new Map(
    state.fields.map((field) => [field.localId, field]),
  );
  const actionById = new Map(
    state.actions.map((action) => [action.localId, action]),
  );

  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[32px] border-[6px] border-foreground/90 bg-background p-3 shadow-sm">
      <div className="rounded-[22px] bg-card p-4">
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-foreground/20" />
        <div className="text-lg font-semibold">
          {state.title.trim() || "Your app"}
        </div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          {state.description.trim() ||
            "The employee sees what you build on the canvas."}
        </div>

        <div className="mt-5 space-y-3">
          {state.layout.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Drag blocks onto the canvas.
            </div>
          ) : (
            state.layout.map((block) => {
              if (block.kind === "field") {
                const field = fieldById.get(block.refId);
                if (!field) return null;
                const Icon = primitiveIcon(field.inputType);

                if (
                  ["photo", "image", "camera", "upload_photo"].includes(
                    field.inputType,
                  )
                ) {
                  return (
                    <div key={block.id}>
                      <div className="mb-1 text-[11px] font-medium">
                        {field.label}
                        {field.required ? " *" : ""}
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg border bg-muted/40 text-xs text-muted-foreground">
                        <Camera className="mr-2 h-4 w-4" />
                        Take photo
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={block.id}>
                    <div className="mb-1 text-[11px] font-medium">
                      {field.label}
                      {field.required ? " *" : ""}
                    </div>
                    <div className="flex h-10 items-center rounded-md border bg-background px-3 text-xs text-muted-foreground">
                      <Icon className="mr-2 h-3.5 w-3.5" />
                      {field.placeholder || primitiveLabel(field.inputType)}
                    </div>
                  </div>
                );
              }

              const action = actionById.get(block.refId);
              if (!action) return null;

              return (
                <div key={block.id}>
                  {action.captureLocation && (
                    <div className="mb-2 flex items-center rounded-md bg-muted/50 px-2 py-2 text-[11px] text-muted-foreground">
                      <MapPin className="mr-1.5 h-3.5 w-3.5" />
                      Location captured automatically
                    </div>
                  )}
                  <div
                    className={cx(
                      "rounded-md px-3 py-2.5 text-center text-xs font-semibold",
                      action.style === "primary"
                        ? "bg-primary text-primary-foreground"
                        : action.style === "danger"
                          ? "bg-destructive text-white"
                          : "border bg-background",
                    )}
                  >
                    {action.label || "Button"}
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

function FieldProperties({
  field,
  state,
  onChange,
}: {
  field: BuilderField;
  state: BuilderState;
  onChange: (state: BuilderState) => void;
}) {
  function patch(patchValue: Partial<BuilderField>) {
    onChange({
      ...state,
      fields: state.fields.map((item) =>
        item.localId === field.localId
          ? { ...item, ...patchValue }
          : item,
      ),
    });
  }

  function updateLabel(label: string) {
    const previousKey = field.key;
    const nextKey =
      !field.key || field.key === normalizeKey(field.label)
        ? normalizeKey(label)
        : field.key;

    onChange({
      ...state,
      fields: state.fields.map((item) =>
        item.localId === field.localId
          ? { ...item, label, key: nextKey }
          : item,
      ),
      actions: state.actions.map((action) => ({
        ...action,
        fieldKeys: action.fieldKeys.map((key) =>
          key === previousKey ? nextKey : key,
        ),
        requiredFieldKeys: action.requiredFieldKeys.map((key) =>
          key === previousKey ? nextKey : key,
        ),
      })),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Field
        </div>
        <div className="mt-1 text-lg font-semibold">
          {field.label || primitiveLabel(field.inputType)}
        </div>
      </div>

      <Field label="Label">
        <input
          value={field.label}
          onChange={(event) => updateLabel(event.target.value)}
          className={inputClass}
          placeholder="What should the employee see?"
        />
      </Field>

      <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) =>
            patch({ required: event.target.checked })
          }
        />
        <div>
          <div className="font-medium">Required</div>
          <div className="text-xs text-muted-foreground">
            Employee must provide this value when used.
          </div>
        </div>
      </label>

      <Field label="Placeholder">
        <input
          value={field.placeholder}
          onChange={(event) =>
            patch({ placeholder: event.target.value })
          }
          className={inputClass}
          placeholder="Optional hint"
        />
      </Field>

      <Field label="Help text">
        <textarea
          value={field.helpText}
          onChange={(event) =>
            patch({ helpText: event.target.value })
          }
          className={textareaClass}
          placeholder="Optional explanation"
        />
      </Field>

      {(field.inputType === "select" ||
        field.inputType === "multi_select") && (
        <Field label="Choices" hint="One choice per line.">
          <textarea
            value={field.optionsText}
            onChange={(event) =>
              patch({ optionsText: event.target.value })
            }
            className={textareaClass}
          />
        </Field>
      )}

      <details className="rounded-lg border">
        <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
          <Settings2 className="h-4 w-4" />
          Advanced
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="space-y-4 border-t p-3">
          <Field
            label="Data key"
            hint="Stable machine-readable key. Usually leave this alone."
          >
            <input
              value={field.key}
              onChange={(event) =>
                patch({ key: normalizeKey(event.target.value) })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Primitive">
            <input
              value={`${field.inputType} · ${field.dataType}`}
              readOnly
              className={`${inputClass} bg-muted/40`}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

function ActionProperties({
  action,
  state,
  onChange,
}: {
  action: BuilderAction;
  state: BuilderState;
  onChange: (state: BuilderState) => void;
}) {
  function patch(patchValue: Partial<BuilderAction>) {
    onChange({
      ...state,
      actions: state.actions.map((item) =>
        item.localId === action.localId
          ? { ...item, ...patchValue }
          : item,
      ),
    });
  }

  function setFieldEnabled(field: BuilderField, enabled: boolean) {
    const next = enabled
      ? [...new Set([...action.fieldKeys, field.key])]
      : action.fieldKeys.filter((key) => key !== field.key);

    patch({
      fieldKeys: next,
      requiredFieldKeys: enabled
        ? action.requiredFieldKeys
        : action.requiredFieldKeys.filter(
            (key) => key !== field.key,
          ),
    });
  }

  function setFieldRequired(field: BuilderField, required: boolean) {
    patch({
      fieldKeys: [
        ...new Set([...action.fieldKeys, field.key]),
      ],
      requiredFieldKeys: required
        ? [
            ...new Set([
              ...action.requiredFieldKeys,
              field.key,
            ]),
          ]
        : action.requiredFieldKeys.filter(
            (key) => key !== field.key,
          ),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Button
        </div>
        <div className="mt-1 text-lg font-semibold">
          {action.label || "Button"}
        </div>
      </div>

      <Field label="Button text">
        <input
          value={action.label}
          onChange={(event) => {
            const label = event.target.value;
            const nextKey =
              !action.key ||
              action.key === normalizeKey(action.label)
                ? normalizeKey(label)
                : action.key;
            patch({ label, key: nextKey });
          }}
          className={inputClass}
          placeholder="Check in"
        />
      </Field>

      <Field label="After success, call this state">
        <input
          value={action.status}
          onChange={(event) =>
            patch({ status: normalizeKey(event.target.value) })
          }
          className={inputClass}
          placeholder="checked_in"
        />
      </Field>

      <Field label="Show this button">
        <select
          value={action.visibility.mode}
          onChange={(event) =>
            patch({
              visibility: {
                mode: event.target
                  .value as ResponsibilityActionVisibilityMode,
              },
            })
          }
          className={inputClass}
        >
          <option value="always">Always</option>
          <option value="no_record">Only before first record</option>
          <option value="latest_status_is">
            When latest state IS...
          </option>
          <option value="latest_status_is_not">
            When latest state IS NOT...
          </option>
        </select>
      </Field>

      {(action.visibility.mode === "latest_status_is" ||
        action.visibility.mode === "latest_status_is_not") && (
        <Field label="State">
          <input
            value={action.visibilityStatus}
            onChange={(event) =>
              patch({
                visibilityStatus: normalizeKey(
                  event.target.value,
                ),
              })
            }
            className={inputClass}
            placeholder="checked_in"
          />
        </Field>
      )}

      <div>
        <div className="text-xs font-medium uppercase tracking-wide">
          What this button collects
        </div>
        <div className="mt-3 space-y-2">
          {state.fields.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Drag input blocks onto the canvas first.
            </div>
          ) : (
            state.fields.map((field) => {
              const enabled =
                action.fieldKeys.includes(field.key);
              const required =
                action.requiredFieldKeys.includes(field.key);

              return (
                <div
                  key={field.localId}
                  className="rounded-lg border p-3"
                >
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) =>
                        setFieldEnabled(
                          field,
                          event.target.checked,
                        )
                      }
                    />
                    {field.label || field.key}
                  </label>

                  {enabled && (
                    <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={required}
                        onChange={(event) =>
                          setFieldRequired(
                            field,
                            event.target.checked,
                          )
                        }
                      />
                      Must be completed before this button works
                    </label>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={action.captureLocation}
          onChange={(event) =>
            patch({
              captureLocation: event.target.checked,
              captureLocationKey:
                action.captureLocationKey ||
                `${normalizeKey(action.key) || "action"}_location`,
            })
          }
        />
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">
            Capture current location automatically
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            The employee does not type anything. The app captures GPS when the button is pressed.
          </div>
        </div>
      </label>

      {action.captureLocation && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={action.locationRequired}
            onChange={(event) =>
              patch({
                locationRequired: event.target.checked,
              })
            }
          />
          Block the button if location is unavailable
        </label>
      )}

      <Field label="Success message">
        <input
          value={action.successMessage ?? ""}
          onChange={(event) =>
            patch({
              successMessage: event.target.value,
            })
          }
          className={inputClass}
          placeholder="Recorded."
        />
      </Field>

      <details className="rounded-lg border">
        <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
          <Settings2 className="h-4 w-4" />
          Advanced
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="space-y-4 border-t p-3">
          <Field label="Operation">
            <select
              value={action.operation}
              onChange={(event) =>
                patch({
                  operation: event.target.value as
                    | "create"
                    | "update",
                })
              }
              className={inputClass}
            >
              <option value="create">Create record</option>
              <option value="update">Update record</option>
            </select>
          </Field>

          <Field label="Button style">
            <select
              value={action.style}
              onChange={(event) =>
                patch({
                  style:
                    event.target
                      .value as ResponsibilityActionStyle,
                })
              }
              className={inputClass}
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="danger">Danger</option>
            </select>
          </Field>

          <Field label="Action key">
            <input
              value={action.key}
              onChange={(event) =>
                patch({
                  key: normalizeKey(event.target.value),
                })
              }
              className={inputClass}
            />
          </Field>

          {action.operation === "update" && (
            <Field
              label="Update only record with state"
              hint="Leave blank to update the latest record."
            >
              <input
                value={action.targetStatus}
                onChange={(event) =>
                  patch({
                    targetStatus: normalizeKey(
                      event.target.value,
                    ),
                  })
                }
                className={inputClass}
              />
            </Field>
          )}

          {action.captureLocation && (
            <Field label="Location data key">
              <input
                value={action.captureLocationKey}
                onChange={(event) =>
                  patch({
                    captureLocationKey: normalizeKey(
                      event.target.value,
                    ),
                  })
                }
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </details>
    </div>
  );
}

function BuilderDialog({
  open,
  mode,
  initialState,
  catalog,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialState: BuilderState;
  catalog: PrimitiveCatalog | null;
  saving: boolean;
  onClose: () => void;
  onSave: (state: BuilderState) => Promise<void>;
}) {
  const [state, setState] = useState<BuilderState>(initialState);
  const [selected, setSelected] =
    useState<SelectedBlock>(null);
  const [activeLabel, setActiveLabel] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  useEffect(() => {
    if (open) {
      setState(initialState);
      setSelected(null);
      setError(null);
    }
  }, [open, initialState]);

  const selectedField =
    selected?.kind === "field"
      ? state.fields.find(
          (field) => field.localId === selected.refId,
        ) ?? null
      : null;

  const selectedAction =
    selected?.kind === "action"
      ? state.actions.find(
          (action) => action.localId === selected.refId,
        ) ?? null
      : null;

  function addPaletteItem(
    data: PaletteDragData,
    overId?: string | null,
  ) {
    if (data.kind === "field") {
      const field = createField(
        data.primitiveKey,
        data.dataType,
        state.fields,
      );
      const block: CanvasBlock = {
        id: localId("block"),
        kind: "field",
        refId: field.localId,
      };
      const nextLayout = [...state.layout];
      const overIndex = overId
        ? nextLayout.findIndex(
            (item) => item.id === overId,
          )
        : -1;
      nextLayout.splice(
        overIndex >= 0 ? overIndex : nextLayout.length,
        0,
        block,
      );
      setState({
        ...state,
        fields: [...state.fields, field],
        layout: nextLayout,
      });
      setSelected({
        kind: "field",
        refId: field.localId,
      });
      return;
    }

    const action = blankAction(state.fields);
    const used = new Set(
      state.actions.map((item) => normalizeKey(item.key)),
    );
    action.key = uniqueKey("submit", used);
    action.label =
      state.actions.length === 0 ? "Submit" : "Action";
    const block: CanvasBlock = {
      id: localId("block"),
      kind: "action",
      refId: action.localId,
    };
    const nextLayout = [...state.layout];
    const overIndex = overId
      ? nextLayout.findIndex((item) => item.id === overId)
      : -1;
    nextLayout.splice(
      overIndex >= 0 ? overIndex : nextLayout.length,
      0,
      block,
    );
    setState({
      ...state,
      actions: [...state.actions, action],
      layout: nextLayout,
    });
    setSelected({
      kind: "action",
      refId: action.localId,
    });
  }

  function removeBlock(block: CanvasBlock) {
    if (block.kind === "field") {
      const field = state.fields.find(
        (item) => item.localId === block.refId,
      );
      setState({
        ...state,
        fields: state.fields.filter(
          (item) => item.localId !== block.refId,
        ),
        actions: field
          ? state.actions.map((action) => ({
              ...action,
              fieldKeys: action.fieldKeys.filter(
                (key) => key !== field.key,
              ),
              requiredFieldKeys:
                action.requiredFieldKeys.filter(
                  (key) => key !== field.key,
                ),
            }))
          : state.actions,
        layout: state.layout.filter(
          (item) => item.id !== block.id,
        ),
      });
    } else {
      setState({
        ...state,
        actions: state.actions.filter(
          (item) => item.localId !== block.refId,
        ),
        layout: state.layout.filter(
          (item) => item.id !== block.id,
        ),
      });
    }

    if (
      selected?.kind === block.kind &&
      selected.refId === block.refId
    ) {
      setSelected(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | PaletteDragData
      | undefined;

    if (data?.source === "palette") {
      setActiveLabel(
        data.kind === "field"
          ? primitiveLabel(data.primitiveKey)
          : "Button",
      );
      return;
    }

    const canvasBlock = state.layout.find(
      (item) => item.id === event.active.id,
    );
    if (!canvasBlock) return;

    if (canvasBlock.kind === "field") {
      const field = state.fields.find(
        (item) => item.localId === canvasBlock.refId,
      );
      setActiveLabel(field?.label ?? "Field");
    } else {
      const action = state.actions.find(
        (item) => item.localId === canvasBlock.refId,
      );
      setActiveLabel(action?.label ?? "Button");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null);

    const data = event.active.data.current as
      | PaletteDragData
      | undefined;
    const overId = event.over?.id
      ? String(event.over.id)
      : null;

    if (data?.source === "palette") {
      if (!event.over) return;
      addPaletteItem(
        data,
        overId === "responsibility-canvas"
          ? null
          : overId,
      );
      return;
    }

    if (
      event.active.id === event.over?.id ||
      !event.over
    ) {
      return;
    }

    const oldIndex = state.layout.findIndex(
      (item) => item.id === event.active.id,
    );
    const newIndex =
      overId === "responsibility-canvas"
        ? state.layout.length - 1
        : state.layout.findIndex(
            (item) => item.id === event.over?.id,
          );

    if (oldIndex < 0 || newIndex < 0) return;

    setState({
      ...state,
      layout: arrayMove(
        state.layout,
        oldIndex,
        newIndex,
      ),
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateState(state);

    if (validation) {
      setError(validation);
      return;
    }

    setError(null);

    try {
      await onSave(state);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this Responsibility.",
      );
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <form
        onSubmit={submit}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {mode === "create"
                ? "Create Responsibility"
                : "Edit Responsibility"}
            </div>
            <div className="mt-1 truncate text-lg font-semibold">
              {state.title.trim() || "Build employee app"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecondaryButton
              type="button"
              onClick={() => {
                const template =
                  checkInOutTemplate(catalog);
                setState({
                  ...template,
                  title:
                    state.title.trim() ||
                    template.title,
                  description:
                    state.description.trim() ||
                    template.description,
                });
                setSelected(null);
              }}
              className="hidden sm:inline-flex"
            >
              Attendance starter
            </SecondaryButton>

            <SecondaryButton
              type="button"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              Close
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {mode === "create"
                ? "Create app"
                : "Save app"}
            </PrimaryButton>
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid min-h-0 flex-1 xl:grid-cols-[250px_minmax(520px,1fr)_360px]">
          <aside className="overflow-y-auto border-r p-4">
            <div className="mb-4">
              <div className="text-sm font-semibold">
                Blocks
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Drag anything onto the canvas.
              </div>
            </div>

            <div className="space-y-2">
              {(catalog?.input ?? []).map((primitive) => {
                const Icon = primitiveIcon(primitive.key);
                return (
                  <PaletteBlock
                    key={primitive.key}
                    label={primitiveLabel(primitive.key)}
                    subtitle={humanize(primitive.dataType)}
                    icon={Icon}
                    data={{
                      source: "palette",
                      kind: "field",
                      primitiveKey: primitive.key,
                      dataType: primitive.dataType,
                    }}
                  />
                );
              })}

              <div className="my-4 border-t" />

              <PaletteBlock
                label="Button"
                subtitle="Submit, check in, approve, finish..."
                icon={MousePointerClick}
                data={{
                  source: "palette",
                  kind: "action",
                }}
              />
            </div>
          </aside>

          <main className="min-w-0 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <Field label="App name">
                  <input
                    value={state.title}
                    onChange={(event) =>
                      setState({
                        ...state,
                        title: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Attendance"
                  />
                </Field>

                <Field label="What is this for?">
                  <input
                    value={state.description}
                    onChange={(event) =>
                      setState({
                        ...state,
                        description:
                          event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Check in and check out with evidence"
                  />
                </Field>
              </div>

              <Canvas
                state={state}
                selected={selected}
                onSelect={setSelected}
                onRemove={removeBlock}
              />

              <details className="mt-5 rounded-xl border bg-card">
                <summary className="flex cursor-pointer items-center gap-2 p-4 text-sm font-semibold">
                  <Settings2 className="h-4 w-4" />
                  App settings
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    Output + advanced record controls
                  </span>
                </summary>

                <div className="grid gap-5 border-t p-4 md:grid-cols-2">
                  <Field label="Dashboard output">
                    <select
                      value={state.outputRenderer}
                      onChange={(event) =>
                        setState({
                          ...state,
                          outputRenderer:
                            event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      {(catalog?.output ?? []).map(
                        (item) => (
                          <option
                            key={item.key}
                            value={item.key}
                          >
                            {humanize(item.key)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide">
                      Record operations
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {(
                        [
                          "create",
                          "read",
                          "update",
                          "delete",
                        ] as CrudOperation[]
                      ).map((operation) => (
                        <label
                          key={operation}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={
                              state.crud[operation]
                            }
                            onChange={(event) =>
                              setState({
                                ...state,
                                crud: {
                                  ...state.crud,
                                  [operation]:
                                    event.target
                                      .checked,
                                },
                              })
                            }
                          />
                          {humanize(operation)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-lg border p-3 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={state.strict}
                      onChange={(event) =>
                        setState({
                          ...state,
                          strict:
                            event.target.checked,
                        })
                      }
                    />
                    <div>
                      <div className="font-medium">
                        Strict payload validation
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Reject data the app definition does not declare. Recommended.
                      </div>
                    </div>
                  </label>
                </div>
              </details>
            </div>
          </main>

          <aside className="overflow-y-auto border-l p-4">
            {selectedField ? (
              <FieldProperties
                field={selectedField}
                state={state}
                onChange={setState}
              />
            ) : selectedAction ? (
              <ActionProperties
                action={selectedAction}
                state={state}
                onChange={setState}
              />
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold">
                    Preview
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Click a block to edit it. This preview updates while you build.
                  </div>
                </div>

                <PhonePreview state={state} />

                <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                  Drag blocks from the left, reorder them in the middle, then click any block to edit its simple properties here.
                </div>
              </div>
            )}
          </aside>
          </div>

          <DragOverlay>
            {activeLabel ? (
              <div className="rounded-lg border bg-background px-4 py-3 text-sm font-semibold shadow-xl">
                {activeLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </form>
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

  const [builderOpen, setBuilderOpen] =
    useState(false);
  const [editing, setEditing] =
    useState<Responsibility | null>(null);
  const [builderInitial, setBuilderInitial] =
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
        apiJson<{
          responsibilities: Responsibility[];
        }>("/api/appliance/responsibilities"),
        apiJson<{
          rules: ResponsibilityRule[];
        }>("/api/appliance/responsibility-rules"),
        apiJson<{ employees: Employee[] }>(
          "/api/appliance/employees",
        ),
        apiJson<{ roles: Role[] }>(
          "/api/appliance/roles",
        ),
        apiJson<MeResponse>("/api/me"),
      ]);

      setCatalog(primitiveBody.primitives);
      setResponsibilities(
        responsibilityBody.responsibilities ?? [],
      );
      setRules(ruleBody.rules ?? []);
      setEmployees(employeeBody.employees ?? []);
      setRoles(roleBody.roles ?? []);
      setCanCreate(
        me.entitlements?.[
          RESPONSIBILITY_CREATE_ENTITLEMENT
        ] === true,
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

  const totalActions = responsibilities.reduce(
    (total, responsibility) =>
      total +
      appFromDefinition(
        responsibility.definition,
      ).actions.length,
    0,
  );

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((employee) => employee.department)
            .filter(
              (value): value is string =>
                Boolean(value),
            ),
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
            .filter(
              (value): value is string =>
                Boolean(value),
            ),
        ),
      ].sort(),
    [employees],
  );

  function openCreate() {
    setEditing(null);
    setBuilderInitial(blankState(catalog));
    setBuilderOpen(true);
    setMessage(null);
  }

  function openEdit(
    responsibility: Responsibility,
  ) {
    setEditing(responsibility);
    setBuilderInitial(
      stateFromResponsibility(responsibility),
    );
    setBuilderOpen(true);
    setMessage(null);
  }

  async function saveBuilder(state: BuilderState) {
    if (!editing && !canCreate) {
      setMessage(
        "Responsibility customization is not enabled for this company.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editing) {
        await apiJson(
          `/api/appliance/responsibilities/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: state.title.trim(),
              description:
                state.description.trim() || null,
              config: configFromState(state),
            }),
          },
        );

        setMessage(
          `“${state.title.trim()}” updated. Employees receive the new app definition on workspace refresh.`,
        );
      } else {
        await apiJson(
          "/api/appliance/responsibilities",
          {
            method: "POST",
            body: JSON.stringify({
              key: normalizeKey(state.title),
              title: state.title.trim(),
              description:
                state.description.trim() || null,
              icon: "blocks",
              config: configFromState(state),
            }),
          },
        );

        setMessage(
          `“${state.title.trim()}” app is ready to assign.`,
        );
      }

      setBuilderOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw error;
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
            isActive:
              responsibility.isActive === false,
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
      return departments.map((value) => ({
        value,
        label: value,
      }));
    }
    if (ruleType === "designation") {
      return designations.map((value) => ({
        value,
        label: value,
      }));
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
      setMessage(
        "Choose who this assignment rule applies to.",
      );
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
            responsibilityId:
              ruleResponsibilityId,
            subjectType: ruleType,
            subjectValue:
              ruleType === "all"
                ? null
                : ruleValue,
            roleId:
              ruleType === "role"
                ? Number(ruleValue)
                : undefined,
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

  async function toggleRule(
    rule: ResponsibilityRule,
  ) {
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
        description="Build employee apps visually. Drag inputs and buttons onto a canvas, assign the Responsibility, then connect it to a Workflow."
        action={
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>

            {canCreate && (
              <PrimaryButton
                type="button"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" />
                Build Responsibility
              </PrimaryButton>
            )}
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

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">
            {activeCount}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Active apps
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">
            {catalog?.input.length ?? 0}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Input blocks
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">
            {catalog?.output.length ?? 0}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Output views
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-2xl font-semibold">
            {totalActions}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            App buttons
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : responsibilities.length === 0 ? (
        <EmptyState
          title="No Responsibilities yet"
          description="Build the first employee app. Drag blocks onto the canvas, save it, then assign it to employees."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {responsibilities.map(
            (responsibility) => {
              const definition =
                responsibility.definition;
              const app =
                appFromDefinition(definition);
              const responsibilityRules =
                rules.filter(
                  (rule) =>
                    rule.capabilityId ===
                    responsibility.id,
                );

              return (
                <Panel key={responsibility.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Blocks className="h-5 w-5" />
                        <div className="text-lg font-semibold">
                          {responsibility.title}
                        </div>
                        <Pill
                          tone={
                            responsibility.isActive ===
                            false
                              ? "neutral"
                              : "good"
                          }
                        >
                          {responsibility.isActive ===
                          false
                            ? "Disabled"
                            : "Active"}
                        </Pill>
                      </div>

                      {responsibility.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {
                            responsibility.description
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <SecondaryButton
                        type="button"
                        className="h-9 px-3"
                        onClick={() =>
                          openEdit(
                            responsibility,
                          )
                        }
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit app
                      </SecondaryButton>

                      <SecondaryButton
                        type="button"
                        className="h-9 px-3"
                        disabled={saving}
                        onClick={() =>
                          void toggleResponsibility(
                            responsibility,
                          )
                        }
                        aria-label={
                          responsibility.isActive ===
                          false
                            ? "Enable"
                            : "Disable"
                        }
                      >
                        {responsibility.isActive ===
                        false ? (
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
                        {
                          definition.input.fields.filter(
                            (field) =>
                              objectValue(
                                field.config,
                              ).hidden !== true,
                          ).length
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        blocks
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="text-xl font-semibold">
                        {app.actions.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        buttons
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">
                        {humanize(
                          definition.output.renderer,
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        output
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="text-xl font-semibold">
                        {responsibility.directAssignments ??
                          0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        assigned
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">
                          Assignment rules
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {
                            responsibilityRules.filter(
                              (rule) =>
                                rule.enabled,
                            ).length
                          }{" "}
                          active
                        </div>
                      </div>

                      <SecondaryButton
                        type="button"
                        className="h-9"
                        onClick={() => {
                          setRuleResponsibilityId(
                            responsibility.id,
                          );
                          setRuleType("all");
                          setRuleValue("");
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Rule
                      </SecondaryButton>
                    </div>

                    {responsibilityRules.length >
                      0 && (
                      <div className="mt-3 space-y-2">
                        {responsibilityRules.map(
                          (rule) => (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="font-medium">
                                  {rule.effect}
                                </span>{" "}
                                {
                                  rule.subjectType
                                }
                                {rule.subjectValue
                                  ? ` · ${rule.subjectValue}`
                                  : ""}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleRule(
                                    rule,
                                  )
                                }
                                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                {rule.enabled
                                  ? "Disable"
                                  : "Enable"}
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              );
            },
          )}
        </div>
      )}

      <BuilderDialog
        open={builderOpen}
        mode={editing ? "edit" : "create"}
        initialState={builderInitial}
        catalog={catalog}
        saving={saving}
        onClose={() => {
          setBuilderOpen(false);
          setEditing(null);
        }}
        onSave={saveBuilder}
      />

      <Modal
        open={Boolean(ruleResponsibilityId)}
        title="Assignment rule"
        description="Choose who automatically receives this Responsibility."
        onClose={() =>
          setRuleResponsibilityId(null)
        }
      >
        <form
          onSubmit={createRule}
          className="space-y-4"
        >
          <Field label="Who">
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
              <option value="user">
                Specific employee
              </option>
              <option value="department">
                Department
              </option>
              <option value="designation">
                Designation
              </option>
              <option value="role">
                Organization role
              </option>
            </select>
          </Field>

          {ruleType !== "all" && (
            <Field label="Value">
              <select
                value={ruleValue}
                onChange={(event) =>
                  setRuleValue(
                    event.target.value,
                  )
                }
                className={inputClass}
                required
              >
                <option value="">
                  Choose...
                </option>
                {ruleOptions().map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </Field>
          )}

          <Field label="Effect">
            <select
              value={ruleEffect}
              onChange={(event) =>
                setRuleEffect(
                  event.target.value,
                )
              }
              className={inputClass}
            >
              <option value="allow">
                Allow
              </option>
              <option value="deny">
                Deny
              </option>
            </select>
          </Field>

          <div className="flex justify-end gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setRuleResponsibilityId(null)
              }
            >
              Cancel
            </SecondaryButton>

            <PrimaryButton
              type="submit"
              disabled={saving}
            >
              Create rule
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
