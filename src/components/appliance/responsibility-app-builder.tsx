"use client";

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
  Camera,
  Check,
  ChevronDown,
  CirclePlay,
  FileText,
  GripVertical,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  MousePointerClick,
  Plus,
  RotateCcw,
  Smartphone,
  SquarePen,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { PlatformDataSource } from "@/lib/platform-vnext-types";
import type {
  KernelAction,
  KernelCapture,
  KernelConditionGroup,
  KernelEffect,
  KernelPossibility,
  KernelRule,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import {
  ACTION_CATALOG,
  CAPTURE_CATALOG,
  STARTER_TEMPLATES,
} from "@/lib/responsibility-kernel-catalog";
import { cx } from "./client";
import {
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function configString(config: Record<string, unknown>, key: string) {
  return typeof config[key] === "string" ? String(config[key]) : "";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureIcon(kind: string) {
  if (["photo", "video"].includes(kind)) return Camera;
  if (["gps", "route"].includes(kind)) return MapPin;
  if (kind === "person_reference") return UserRound;
  if (["choice", "checklist"].includes(kind)) return ListChecks;
  if (["file", "signature", "audio"].includes(kind)) return FileText;
  return SquarePen;
}

function initialState(kernel: ResponsibilityKernel) {
  return kernel.runtimeWorld.states.find((state) => state.initial)?.id ?? kernel.runtimeWorld.states[0]?.id ?? "";
}

function actionEventRule(kernel: ResponsibilityKernel, actionId: string) {
  const event = kernel.events.find((item) => item.kind === "action" && item.actionId === actionId);
  const rule = event ? kernel.rules.find((item) => item.eventId === event.id) : undefined;
  return { event, rule };
}

function ensureActionBehavior(
  kernel: ResponsibilityKernel,
  actionId: string,
  settings: {
    resultingState?: string;
    assignActorId?: string;
    notifyActorId?: string;
  },
) {
  const next = clone(kernel);
  let event = next.events.find((item) => item.kind === "action" && item.actionId === actionId);
  if (!event) {
    event = {
      id: randomKey("event"),
      label: `${humanize(actionId)} happened`,
      kind: "action",
      actionId,
    };
    next.events.push(event);
  }

  let rule = next.rules.find((item) => item.eventId === event!.id);
  if (!rule) {
    rule = {
      id: randomKey("rule"),
      label: `${humanize(actionId)} behavior`,
      eventId: event.id,
      when: { mode: "all", conditions: [] },
      effects: [],
      priority: 100,
      enabled: true,
    };
    next.rules.push(rule);
  }

  const preserved = rule.effects.filter(
    (effect) => !["change_state", "assign_actor", "notify_actor", "append_history"].includes(effect.kind),
  );
  const effects: KernelEffect[] = [...preserved];

  if (settings.resultingState) {
    effects.push({
      id: randomKey("effect"),
      kind: "change_state",
      targetKey: "process",
      value: { kind: "literal", value: settings.resultingState },
      config: {},
    });
  }
  if (settings.assignActorId) {
    effects.push({ id: randomKey("effect"), kind: "assign_actor", actorId: settings.assignActorId, config: {} });
  }
  if (settings.notifyActorId) {
    effects.push({ id: randomKey("effect"), kind: "notify_actor", actorId: settings.notifyActorId, config: { channel: "app" } });
  }
  effects.push({ id: randomKey("effect"), kind: "append_history", config: { label: humanize(actionId) } });
  rule.effects = effects;
  return next;
}

function updatePossibility(
  kernel: ResponsibilityKernel,
  possibilityId: string,
  updater: (item: KernelPossibility) => KernelPossibility,
) {
  return {
    ...kernel,
    possibilities: kernel.possibilities.map((item) =>
      item.id === possibilityId ? updater(item) : item,
    ),
  };
}

function possibilityTitle(possibility: KernelPossibility) {
  return possibility.type === "capture"
    ? possibility.capture.label
    : possibility.type === "action"
      ? possibility.action.label
      : possibility.output.label;
}

function possibilitySubtitle(possibility: KernelPossibility) {
  return possibility.type === "capture"
    ? humanize(possibility.capture.kind)
    : possibility.type === "action"
      ? `Action · ${humanize(possibility.action.kind)}`
      : `Output · ${humanize(possibility.output.kind)}`;
}

function PaletteItem({ id, label, subtitle }: { id: string; label: string; subtitle?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { source: "palette" },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cx(
        "flex w-full cursor-grab items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/40 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {subtitle && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </button>
  );
}

function SortableCanvasItem({
  possibility,
  selected,
  onSelect,
}: {
  possibility: KernelPossibility;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: possibility.id,
    data: { source: "canvas" },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const Icon = possibility.type === "capture" ? captureIcon(possibility.capture.kind) : MousePointerClick;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        "rounded-xl border bg-background p-3 transition",
        selected && "border-primary ring-1 ring-primary/30",
        isDragging && "opacity-50",
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <button type="button" {...listeners} {...attributes} className="cursor-grab text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{possibilityTitle(possibility)}</div>
          <div className="truncate text-[11px] text-muted-foreground">{possibilitySubtitle(possibility)}</div>
        </div>
      </div>
    </div>
  );
}

function PhoneDropZone({
  kernel,
  selectedId,
  onSelect,
}: {
  kernel: ResponsibilityKernel;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "phone-canvas" });
  const layout = kernel.metadata.ui?.layout ?? [];
  const items = layout
    .map((id) => kernel.possibilities.find((item) => item.id === id))
    .filter((item): item is KernelPossibility => Boolean(item && item.type !== "output"));

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "min-h-[530px] rounded-[38px] border-[6px] border-foreground/90 bg-background p-4 shadow-sm",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-muted-foreground/40" />
      <div className="px-1 pb-2">
        <div className="text-lg font-semibold">{kernel.metadata.ui?.title || "Employee app"}</div>
        {kernel.metadata.ui?.description && (
          <div className="mt-1 text-xs text-muted-foreground">{kernel.metadata.ui.description}</div>
        )}
      </div>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium">Drag something here</div>
              <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                Start from a template or drag captures/actions from the left.
              </div>
            </div>
          ) : (
            items.map((item) => (
              <SortableCanvasItem
                key={item.id}
                possibility={item}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function ReferenceFiltersEditor({
  capture,
  onChange,
}: {
  capture: KernelCapture;
  onChange: (capture: KernelCapture) => void;
}) {
  const filters = Array.isArray(capture.config.filters)
    ? (capture.config.filters as Array<Record<string, unknown>>)
    : [];

  function setFilters(next: Array<Record<string, unknown>>) {
    onChange({ ...capture, config: { ...capture.config, filters: next } });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Filters</div>
        <button
          type="button"
          className="text-xs text-primary"
          onClick={() => setFilters([...filters, { field: "", operator: "eq", value: "" }])}
        >
          + Filter
        </button>
      </div>
      {filters.length === 0 && (
        <div className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
          No filters. The picker can show every permitted record from its source.
        </div>
      )}
      {filters.map((filter, index) => {
        const fromContext = typeof filter.valueFrom === "string";
        return (
          <div key={index} className="grid gap-2 rounded-md border p-2">
            <div className="grid grid-cols-[1fr_110px_auto] gap-2">
              <input
                className={inputClass}
                placeholder="field"
                value={String(filter.field ?? "")}
                onChange={(event) => {
                  const next = [...filters];
                  next[index] = { ...filter, field: event.target.value };
                  setFilters(next);
                }}
              />
              <select
                className={inputClass}
                value={String(filter.operator ?? "eq")}
                onChange={(event) => {
                  const next = [...filters];
                  next[index] = { ...filter, operator: event.target.value };
                  setFilters(next);
                }}
              >
                <option value="eq">equals</option>
                <option value="neq">not equal</option>
                <option value="contains">contains</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
              </select>
              <button
                type="button"
                onClick={() => setFilters(filters.filter((_, i) => i !== index))}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <select
                className={inputClass}
                value={fromContext ? "context" : "literal"}
                onChange={(event) => {
                  const next = [...filters];
                  next[index] = event.target.value === "context"
                    ? { ...filter, valueFrom: "current_employee.id", value: undefined }
                    : { ...filter, value: "", valueFrom: undefined };
                  setFilters(next);
                }}
              >
                <option value="literal">Value</option>
                <option value="context">From context</option>
              </select>
              <input
                className={inputClass}
                placeholder={fromContext ? "current_employee.id" : "active"}
                value={String(fromContext ? filter.valueFrom ?? "" : filter.value ?? "")}
                onChange={(event) => {
                  const next = [...filters];
                  next[index] = fromContext
                    ? { ...filter, valueFrom: event.target.value }
                    : { ...filter, value: event.target.value };
                  setFilters(next);
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaptureInspector({
  kernel,
  possibility,
  dataSources,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "capture" }>;
  dataSources: PlatformDataSource[];
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const capture = possibility.capture;
  const options = Array.isArray(capture.config.options) ? capture.config.options.map(String) : [];

  function patch(nextCapture: KernelCapture) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "capture" ? { ...item, capture: nextCapture } : item,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{capture.label}</div>
          <div className="text-xs text-muted-foreground">{humanize(capture.kind)}</div>
        </div>
        <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Field label="What should the employee see?">
        <input className={inputClass} value={capture.label} onChange={(event) => patch({ ...capture, label: event.target.value })} />
      </Field>

      <Field label="Store answer as">
        <input
          className={inputClass}
          value={capture.storeAs ?? capture.id}
          onChange={(event) => patch({ ...capture, storeAs: normalizeKey(event.target.value) })}
          placeholder="leave_reason"
        />
      </Field>

      <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          checked={capture.required === true}
          onChange={(event) => patch({ ...capture, required: event.target.checked })}
        />
        Must be completed
      </label>

      {capture.kind === "choice" && (
        <Field label="Choices — one per line">
          <textarea
            className={textareaClass}
            rows={6}
            value={options.join("\n")}
            onChange={(event) =>
              patch({
                ...capture,
                config: {
                  ...capture.config,
                  options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                },
              })
            }
          />
        </Field>
      )}

      {["person_reference", "entity_reference", "responsibility_reference"].includes(capture.kind) && (
        <>
          <Field label="Get options from">
            <select
              className={inputClass}
              value={configString(capture.config, "source")}
              onChange={(event) => patch({ ...capture, config: { ...capture.config, source: event.target.value } })}
            >
              <option value="">Choose a source...</option>
              {capture.kind === "person_reference" && <option value="employees">Employees</option>}
              {dataSources.map((source) => (
                <option key={source.id} value={source.key}>{source.title}</option>
              ))}
            </select>
          </Field>
          <ReferenceFiltersEditor capture={capture} onChange={patch} />
        </>
      )}

      <Field label="Help text">
        <textarea
          className={textareaClass}
          rows={2}
          value={configString(capture.config, "helpText")}
          onChange={(event) => patch({ ...capture, config: { ...capture.config, helpText: event.target.value } })}
        />
      </Field>
    </div>
  );
}

function ActionInspector({
  kernel,
  possibility,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "action" }>;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const action = possibility.action;
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> => item.type === "capture",
  );
  const availableState = configString(action.config, "availableState");
  const resultingState = configString(action.config, "resultingState");
  const assignActorId = configString(action.config, "assignActorId");
  const notifyActorId = configString(action.config, "notifyActorId");

  function patchAction(patch: Partial<KernelAction>) {
    const next = updatePossibility(kernel, possibility.id, (item) =>
      item.type === "action" ? { ...item, action: { ...item.action, ...patch } } : item,
    );
    const nextAction = (next.possibilities.find((item) => item.id === possibility.id) as Extract<KernelPossibility, { type: "action" }>).action;
    onChange(
      ensureActionBehavior(next, nextAction.id, {
        resultingState: configString(nextAction.config, "resultingState"),
        assignActorId: configString(nextAction.config, "assignActorId"),
        notifyActorId: configString(nextAction.config, "notifyActorId"),
      }),
    );
  }

  function patchConfig(configPatch: Record<string, unknown>) {
    patchAction({ config: { ...action.config, ...configPatch } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{action.label}</div>
          <div className="text-xs text-muted-foreground">Action · {humanize(action.kind)}</div>
        </div>
        <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Field label="Button text">
        <input className={inputClass} value={action.label} onChange={(event) => patchAction({ label: event.target.value })} />
      </Field>

      <Field label="Who can do this?">
        <select className={inputClass} value={action.actorId ?? ""} onChange={(event) => patchAction({ actorId: event.target.value })}>
          <option value="">Choose actor...</option>
          {kernel.runtimeWorld.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
        </select>
      </Field>

      <Field label="What is this acting on?">
        <select className={inputClass} value={action.objectId ?? ""} onChange={(event) => patchAction({ objectId: event.target.value })}>
          <option value="">Choose object...</option>
          {kernel.runtimeWorld.objects.map((object) => <option key={object.id} value={object.id}>{object.label}</option>)}
        </select>
      </Field>

      <div>
        <div className="mb-2 text-xs font-medium">Collect when pressed</div>
        <div className="space-y-1 rounded-md border p-2">
          {captures.length === 0 && <div className="text-xs text-muted-foreground">No capture blocks on this app yet.</div>}
          {captures.map((item) => (
            <label key={item.capture.id} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30">
              <input
                type="checkbox"
                checked={action.captureIds.includes(item.capture.id)}
                onChange={(event) =>
                  patchAction({
                    captureIds: event.target.checked
                      ? [...new Set([...action.captureIds, item.capture.id])]
                      : action.captureIds.filter((id) => id !== item.capture.id),
                  })
                }
              />
              {item.capture.label}
              {item.capture.required && <span className="text-destructive">*</span>}
            </label>
          ))}
        </div>
      </div>

      <Field label="Available when process state is">
        <select className={inputClass} value={availableState} onChange={(event) => patchConfig({ availableState: event.target.value })}>
          <option value="">Any state</option>
          {kernel.runtimeWorld.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
        </select>
      </Field>

      <Field label="After success, process state becomes">
        <select className={inputClass} value={resultingState} onChange={(event) => patchConfig({ resultingState: event.target.value })}>
          <option value="">Do not change state</option>
          {kernel.runtimeWorld.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
        </select>
      </Field>

      <Field label="Assign to actor after success">
        <select className={inputClass} value={assignActorId} onChange={(event) => patchConfig({ assignActorId: event.target.value })}>
          <option value="">Nobody / unchanged</option>
          {kernel.runtimeWorld.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
        </select>
      </Field>

      <Field label="Notify actor after success">
        <select className={inputClass} value={notifyActorId} onChange={(event) => patchConfig({ notifyActorId: event.target.value })}>
          <option value="">Nobody</option>
          {kernel.runtimeWorld.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
        </select>
      </Field>

      <Field label="Success message">
        <input
          className={inputClass}
          value={configString(action.config, "successMessage")}
          onChange={(event) => patchConfig({ successMessage: event.target.value })}
          placeholder={`${action.label} completed.`}
        />
      </Field>
    </div>
  );
}

function PlayPhone({ kernel }: { kernel: ResponsibilityKernel }) {
  const [actorId, setActorId] = useState(kernel.metadata.ui?.previewActorId ?? "current_employee");
  const [stateId, setStateId] = useState(kernel.metadata.ui?.previewStateId ?? initialState(kernel));
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<string[]>([]);
  const layout = kernel.metadata.ui?.layout ?? [];

  useEffect(() => {
    setStateId(kernel.metadata.ui?.previewStateId ?? initialState(kernel));
    setValues({});
    setHistory([]);
  }, [kernel]);

  const visible = layout
    .map((id) => kernel.possibilities.find((item) => item.id === id))
    .filter((item): item is KernelPossibility => Boolean(item && item.type !== "output"))
    .filter((item) => {
      if (item.type !== "action") return true;
      if (item.action.actorId && item.action.actorId !== actorId) return false;
      const requiredState = configString(item.action.config, "availableState");
      return !requiredState || requiredState === stateId;
    });

  function execute(action: KernelAction) {
    const captures = kernel.possibilities.filter(
      (item): item is Extract<KernelPossibility, { type: "capture" }> => item.type === "capture",
    );
    const missing = action.captureIds
      .map((id) => captures.find((item) => item.capture.id === id)?.capture)
      .filter((capture): capture is KernelCapture => Boolean(capture?.required))
      .filter((capture) => {
        const value = values[capture.id];
        return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      });
    if (missing.length) {
      setHistory((current) => [`Missing: ${missing.map((item) => item.label).join(", ")}`, ...current]);
      return;
    }

    const { rule } = actionEventRule(kernel, action.id);
    if (rule) {
      for (const effect of rule.effects) {
        if (effect.kind === "change_state" && effect.value?.kind === "literal" && typeof effect.value.value === "string") {
          setStateId(effect.value.value);
        }
      }
    } else {
      const nextState = configString(action.config, "resultingState");
      if (nextState) setStateId(nextState);
    }
    setHistory((current) => [`${action.label} · simulated`, ...current]);
  }

  function renderCapture(capture: KernelCapture) {
    const value = values[capture.id] ?? "";
    const set = (next: unknown) => setValues((current) => ({ ...current, [capture.id]: next }));

    if (capture.kind === "choice") {
      const options = Array.isArray(capture.config.options) ? capture.config.options.map(String) : ["Option 1", "Option 2"];
      return (
        <select className={inputClass} value={String(value)} onChange={(event) => set(event.target.value)}>
          <option value="">Choose...</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    if (capture.kind === "long_text") {
      return <textarea className={textareaClass} rows={3} value={String(value)} onChange={(event) => set(event.target.value)} />;
    }
    if (["date", "datetime"].includes(capture.kind)) {
      return <input className={inputClass} type={capture.kind === "date" ? "date" : "datetime-local"} value={String(value)} onChange={(event) => set(event.target.value)} />;
    }
    if (["number", "amount", "rating", "timer"].includes(capture.kind)) {
      return <input className={inputClass} type="number" value={String(value)} onChange={(event) => set(event.target.value)} />;
    }
    if (capture.kind === "boolean") {
      return <label className="flex items-center gap-2 rounded-md border p-3 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(event) => set(event.target.checked)} /> Yes</label>;
    }
    if (["photo", "video", "file", "signature", "audio", "gps", "route", "qr", "barcode", "nfc"].includes(capture.kind)) {
      return (
        <button type="button" onClick={() => set(`simulated:${capture.kind}`)} className="flex w-full items-center justify-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/40">
          {value ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {value ? `${capture.label} captured` : `Simulate ${capture.label}`}
        </button>
      );
    }
    if (["person_reference", "entity_reference", "responsibility_reference"].includes(capture.kind)) {
      return (
        <select className={inputClass} value={String(value)} onChange={(event) => set(event.target.value)}>
          <option value="">Search/select...</option>
          <option value="demo_1">Sample record 1</option>
          <option value="demo_2">Sample record 2</option>
        </select>
      );
    }
    return <input className={inputClass} value={String(value)} onChange={(event) => set(event.target.value)} />;
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <Field label="Preview as">
            <select className={inputClass} value={actorId} onChange={(event) => setActorId(event.target.value)}>
              {kernel.runtimeWorld.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
            </select>
          </Field>
          <Field label="Current state">
            <select className={inputClass} value={stateId} onChange={(event) => setStateId(event.target.value)}>
              {kernel.runtimeWorld.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="mx-auto max-w-[410px] rounded-[42px] border-[7px] border-foreground/90 bg-background p-5">
          <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-muted-foreground/40" />
          <div className="text-lg font-semibold">{kernel.metadata.ui?.title || "Employee app"}</div>
          <div className="mt-1 text-xs text-muted-foreground">State: {kernel.runtimeWorld.states.find((state) => state.id === stateId)?.label ?? stateId}</div>
          <div className="mt-5 space-y-4">
            {visible.map((item) =>
              item.type === "capture" ? (
                <div key={item.id}>
                  <div className="mb-1.5 text-sm font-medium">{item.capture.label}{item.capture.required && <span className="text-destructive"> *</span>}</div>
                  {renderCapture(item.capture)}
                </div>
              ) : item.type === "action" ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => execute(item.action)}
                  className={cx(
                    "w-full rounded-lg px-4 py-3 text-sm font-semibold",
                    ["reject", "delete", "cancel"].includes(item.action.kind)
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {item.action.label}
                </button>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <Panel>
        <div className="flex items-center justify-between">
          <div className="font-semibold">Simulation log</div>
          <button type="button" onClick={() => { setStateId(initialState(kernel)); setValues({}); setHistory([]); }} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Use the phone. Actions apply the configured event/effect rules locally.</div>
          ) : history.map((item, index) => <div key={`${item}-${index}`} className="rounded-md border p-2 text-xs">{item}</div>)}
        </div>
      </Panel>
    </div>
  );
}

export default function ResponsibilityAppBuilder({
  kernel,
  dataSources,
  onChange,
}: {
  kernel: ResponsibilityKernel;
  dataSources: PlatformDataSource[];
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selected = kernel.possibilities.find((item) => item.id === selectedId) ?? null;
  const layout = kernel.metadata.ui?.layout ?? [];

  function setLayout(nextLayout: string[]) {
    onChange({
      ...kernel,
      metadata: {
        ...kernel.metadata,
        ui: { ...(kernel.metadata.ui ?? { layout: [] }), layout: nextLayout },
      },
    });
  }

  function addCapture(kind: (typeof CAPTURE_CATALOG)[number]["kind"], index?: number) {
    const catalog = CAPTURE_CATALOG.find((item) => item.kind === kind);
    const captureId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const capture: KernelCapture = {
      id: captureId,
      label: catalog?.label ?? humanize(kind),
      kind,
      required: false,
      storeAs: normalizeKey(catalog?.label ?? kind),
      config: kind === "choice" ? { options: ["Option 1", "Option 2"] } : {},
    };
    const next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "capture", capture });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = { ...(next.metadata.ui ?? { layout: [] }), layout: nextLayout };
    onChange(next);
    setSelectedId(possibilityId);
  }

  function addAction(kind: (typeof ACTION_CATALOG)[number]["kind"], index?: number) {
    const catalog = ACTION_CATALOG.find((item) => item.kind === kind);
    const actionId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const action: KernelAction = {
      id: actionId,
      label: catalog?.label ?? humanize(kind),
      kind,
      actorId: kernel.runtimeWorld.actors[0]?.id,
      objectId: kernel.runtimeWorld.objects[0]?.id,
      captureIds: [],
      config: {},
    };
    let next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "action", action });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = { ...(next.metadata.ui ?? { layout: [] }), layout: nextLayout };
    next = ensureActionBehavior(next, actionId, {});
    onChange(next);
    setSelectedId(possibilityId);
  }

  function removeSelected() {
    if (!selectedId) return;
    const next = clone(kernel);
    const possibility = next.possibilities.find((item) => item.id === selectedId);
    if (possibility?.type === "action") {
      const eventIds = next.events.filter((event) => event.actionId === possibility.action.id).map((event) => event.id);
      next.events = next.events.filter((event) => event.actionId !== possibility.action.id);
      next.rules = next.rules.filter((rule) => !rule.eventId || !eventIds.includes(rule.eventId));
    }
    if (possibility?.type === "capture") {
      for (const item of next.possibilities) {
        if (item.type === "action") {
          item.action.captureIds = item.action.captureIds.filter((id) => id !== possibility.capture.id);
        }
      }
    }
    next.possibilities = next.possibilities.filter((item) => item.id !== selectedId);
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: (next.metadata.ui?.layout ?? []).filter((id) => id !== selectedId),
    };
    onChange(next);
    setSelectedId(null);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveDragId(null);
    if (!overId) return;

    if (activeId.startsWith("palette:capture:")) {
      const kind = activeId.replace("palette:capture:", "") as (typeof CAPTURE_CATALOG)[number]["kind"];
      const index = overId === "phone-canvas" ? layout.length : Math.max(0, layout.indexOf(overId));
      addCapture(kind, index);
      return;
    }
    if (activeId.startsWith("palette:action:")) {
      const kind = activeId.replace("palette:action:", "") as (typeof ACTION_CATALOG)[number]["kind"];
      const index = overId === "phone-canvas" ? layout.length : Math.max(0, layout.indexOf(overId));
      addAction(kind, index);
      return;
    }
    if (layout.includes(activeId) && layout.includes(overId) && activeId !== overId) {
      setLayout(arrayMove(layout, layout.indexOf(activeId), layout.indexOf(overId)));
    }
  }

  if (play) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <SecondaryButton type="button" onClick={() => setPlay(false)}><SquarePen className="h-4 w-4" /> Back to edit</SecondaryButton>
        </div>
        <PlayPhone kernel={kernel} />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5">
        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-base font-semibold">Start from something familiar</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Starters are editable compositions, not special business modules. Pick one, then change anything.
              </div>
            </div>
            <PrimaryButton type="button" onClick={() => setPlay(true)}>
              <CirclePlay className="h-4 w-4" /> Play app
            </PrimaryButton>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {STARTER_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => {
                  if (kernel.possibilities.length && !window.confirm(`Replace this draft with the ${template.label} starter?`)) return;
                  onChange(template.create());
                  setSelectedId(null);
                }}
                className="rounded-lg border p-3 text-left hover:bg-muted/40"
              >
                <WandSparkles className="h-4 w-4" />
                <div className="mt-2 text-sm font-medium">{template.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{template.description}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid min-w-0 gap-4 2xl:grid-cols-[280px_minmax(360px,520px)_minmax(300px,1fr)]">
          <Panel className="min-w-0">
            <div className="font-semibold">Blocks</div>
            <div className="mt-1 text-xs text-muted-foreground">Drag to the phone. Templates first; primitives below.</div>

            <div className="mt-5 space-y-5">
              {(["Ask", "Reference", "Evidence", "Device", "Structure"] as const).map((group) => (
                <div key={group}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                  <div className="space-y-2">
                    {CAPTURE_CATALOG.filter((item) => item.group === group).map((item) => (
                      <PaletteItem key={item.kind} id={`palette:capture:${item.kind}`} label={item.label} />
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Buttons / actions</div>
                <div className="space-y-2">
                  {ACTION_CATALOG.map((item) => (
                    <PaletteItem key={item.kind} id={`palette:action:${item.kind}`} label={item.label} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Employee app</div>
                <div className="text-xs text-muted-foreground">Same blocks = same Kernel IDs = same published contract.</div>
              </div>
              <Pill>{layout.length} blocks</Pill>
            </div>
            <PhoneDropZone kernel={kernel} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          <Panel className="min-w-0">
            <div className="mb-4">
              <div className="font-semibold">Properties</div>
              <div className="text-xs text-muted-foreground">Click a phone block. Configure meaning here—no separate duplicate setup.</div>
            </div>
            {!selected ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Select a block on the phone. Its data source, actor, state behavior and output bindings are edited here.
              </div>
            ) : selected.type === "capture" ? (
              <CaptureInspector kernel={kernel} possibility={selected} dataSources={dataSources} onChange={onChange} onDelete={removeSelected} />
            ) : selected.type === "action" ? (
              <ActionInspector kernel={kernel} possibility={selected} onChange={onChange} onDelete={removeSelected} />
            ) : null}
          </Panel>
        </div>
      </div>

      <DragOverlay>
        {activeDragId ? (
          <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-lg">
            <GripVertical className="mr-2 inline h-4 w-4" /> Drag to app
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
