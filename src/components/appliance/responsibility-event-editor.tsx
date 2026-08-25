"use client";

import { GitBranch, Plus, Trash2 } from "lucide-react";

import type {
  KernelCondition,
  KernelEffect,
  KernelEffectKind,
  KernelEventKind,
  KernelRule,
  KernelValueRef,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import { EFFECT_CATALOG } from "@/lib/responsibility-kernel-catalog";
import { Field, inputClass, Panel, SecondaryButton } from "./primitives";

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function refDisplay(ref?: KernelValueRef) {
  if (!ref) return "";
  if (ref.kind === "literal") return String(ref.value ?? "");
  const path = "path" in ref && typeof ref.path === "string" ? ref.path : "";
  return `${ref.key}${path ? `.${path}` : ""}`;
}

function refKind(ref?: KernelValueRef) {
  return ref?.kind ?? "literal";
}

function makeRef(kind: KernelValueRef["kind"], value: string): KernelValueRef {
  if (kind === "literal") return { kind, value };
  if (kind === "state") return { kind, key: value || "process" };
  return { kind, key: value } as KernelValueRef;
}

const EVENT_KINDS: Array<{ value: KernelEventKind; label: string }> = [
  { value: "action", label: "An app action happens" },
  { value: "record_created", label: "Record created" },
  { value: "record_updated", label: "Record updated" },
  { value: "state_changed", label: "State changed" },
  { value: "time_reached", label: "Time reached" },
  { value: "timer_expired", label: "Timer expired" },
  { value: "location_entered", label: "Entered location / geofence" },
  { value: "location_exited", label: "Exited location / geofence" },
  { value: "responsibility_completed", label: "Another Responsibility completed" },
  { value: "device_online", label: "Device came online" },
  { value: "device_offline", label: "Device went offline" },
  { value: "sync_completed", label: "Sync completed" },
  { value: "schedule", label: "Schedule fired" },
  { value: "external", label: "External event" },
];

function EffectEditor({
  kernel,
  effect,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  effect: KernelEffect;
  onChange: (effect: KernelEffect) => void;
  onDelete: () => void;
}) {
  const actions = kernel.possibilities.filter((item) => item.type === "action");
  const captures = kernel.possibilities.filter((item) => item.type === "capture");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          className={inputClass}
          value={effect.kind}
          onChange={(event) => onChange({ ...effect, kind: event.target.value as KernelEffectKind, targetKey: undefined, value: undefined, actorId: undefined, config: {} })}
        >
          {EFFECT_CATALOG.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
        </select>
        <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>

      {effect.kind === "change_state" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="State dimension">
            <input className={inputClass} value={effect.targetKey ?? "process"} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })} />
          </Field>
          <Field label="New state">
            <select
              className={inputClass}
              value={effect.value?.kind === "literal" ? String(effect.value.value ?? "") : ""}
              onChange={(event) => onChange({ ...effect, targetKey: effect.targetKey || "process", value: { kind: "literal", value: event.target.value } })}
            >
              <option value="">Choose state...</option>
              {kernel.runtimeWorld.states.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
            </select>
          </Field>
        </div>
      )}

      {["assign_actor", "notify_actor"].includes(effect.kind) && (
        <Field label={effect.kind === "assign_actor" ? "Assign to" : "Notify"}>
          <select className={inputClass} value={effect.actorId ?? ""} onChange={(event) => onChange({ ...effect, actorId: event.target.value })}>
            <option value="">Choose actor...</option>
            {kernel.runtimeWorld.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
          </select>
        </Field>
      )}

      {["set_context", "remove_context"].includes(effect.kind) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Context">
            <select className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })}>
              <option value="">Choose context...</option>
              {kernel.runtimeWorld.contexts.map((context) => <option key={context.id} value={context.id}>{context.label}</option>)}
            </select>
          </Field>
          {effect.kind === "set_context" && (
            <Field label="Value / source">
              <input
                className={inputClass}
                value={effect.value ? refDisplay(effect.value) : ""}
                onChange={(event) => onChange({ ...effect, value: { kind: "literal", value: event.target.value } })}
                placeholder="literal value or use Advanced later"
              />
            </Field>
          )}
        </div>
      )}

      {["create_record", "update_record", "delete_record"].includes(effect.kind) && (
        <Field label="Business object / record">
          <select className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })}>
            <option value="">Choose object...</option>
            {kernel.runtimeWorld.objects.map((object) => <option key={object.id} value={object.id}>{object.label}</option>)}
          </select>
        </Field>
      )}

      {effect.kind === "query_data" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Store query result as">
            <input className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })} placeholder="available_manager" />
          </Field>
          <Field label="Data source / query key">
            <input className={inputClass} value={String(effect.config.source ?? "")} onChange={(event) => onChange({ ...effect, config: { ...effect.config, source: event.target.value } })} />
          </Field>
        </div>
      )}

      {effect.kind === "set_computed" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Store computed value as">
            <input className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })} placeholder="total" />
          </Field>
          <Field label="Expression">
            <input className={inputClass} value={String(effect.config.expression ?? "")} onChange={(event) => onChange({ ...effect, config: { ...effect.config, expression: event.target.value } })} placeholder="food + lodging + transport" />
          </Field>
        </div>
      )}

      {effect.kind === "freeze_data" && (
        <Field label="Freeze">
          <select className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })}>
            <option value="">Choose data/context...</option>
            {kernel.runtimeWorld.contexts.map((context) => <option key={context.id} value={context.id}>{context.label}</option>)}
            {captures.map((item) => item.type === "capture" && <option key={item.capture.id} value={item.capture.id}>{item.capture.label}</option>)}
          </select>
        </Field>
      )}

      {effect.kind === "trigger_action" && (
        <Field label="Trigger action">
          <select className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })}>
            <option value="">Choose action...</option>
            {actions.map((item) => item.type === "action" && <option key={item.action.id} value={item.action.id}>{item.action.label}</option>)}
          </select>
        </Field>
      )}

      {effect.kind === "trigger_responsibility" && (
        <Field label="Responsibility key">
          <input className={inputClass} value={effect.targetKey ?? ""} onChange={(event) => onChange({ ...effect, targetKey: event.target.value })} placeholder="handover_task" />
        </Field>
      )}

      {effect.kind === "append_history" && (
        <Field label="History message">
          <input className={inputClass} value={String(effect.config.label ?? "")} onChange={(event) => onChange({ ...effect, config: { ...effect.config, label: event.target.value } })} placeholder="Leave submitted" />
        </Field>
      )}
    </div>
  );
}

function ConditionEditor({
  condition,
  onChange,
  onDelete,
}: {
  condition: KernelCondition;
  onChange: (condition: KernelCondition) => void;
  onDelete: () => void;
}) {
  const right = condition.right ?? { kind: "literal", value: "" } as KernelValueRef;
  return (
    <div className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[130px_1fr_130px_130px_1fr_auto]">
      <select
        className={inputClass}
        value={refKind(condition.left)}
        onChange={(event) => onChange({ ...condition, left: makeRef(event.target.value as KernelValueRef["kind"], "") })}
      >
        <option value="state">State</option>
        <option value="context">Context</option>
        <option value="actor">Actor</option>
        <option value="object">Object</option>
        <option value="capture">Captured value</option>
        <option value="query">Query result</option>
        <option value="computed">Computed</option>
        <option value="literal">Literal</option>
      </select>
      <input className={inputClass} value={refDisplay(condition.left)} onChange={(event) => onChange({ ...condition, left: makeRef(refKind(condition.left), event.target.value) })} placeholder="process / current_employee / amount" />
      <select className={inputClass} value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as KernelCondition["operator"] })}>
        <option value="eq">equals</option>
        <option value="neq">not equal</option>
        <option value="gt">greater than</option>
        <option value="gte">greater/equal</option>
        <option value="lt">less than</option>
        <option value="lte">less/equal</option>
        <option value="contains">contains</option>
        <option value="exists">exists</option>
        <option value="not_exists">does not exist</option>
      </select>
      <select className={inputClass} value={refKind(right)} onChange={(event) => onChange({ ...condition, right: makeRef(event.target.value as KernelValueRef["kind"], "") })}>
        <option value="literal">Value</option>
        <option value="state">State</option>
        <option value="context">Context</option>
        <option value="actor">Actor</option>
        <option value="capture">Captured value</option>
        <option value="query">Query result</option>
        <option value="computed">Computed</option>
      </select>
      <input className={inputClass} value={refDisplay(right)} onChange={(event) => onChange({ ...condition, right: makeRef(refKind(right), event.target.value) })} placeholder="draft / 2000 / current_employee.id" />
      <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

export default function ResponsibilityEventEditor({
  kernel,
  onChange,
}: {
  kernel: ResponsibilityKernel;
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  const actions = kernel.possibilities.filter((item) => item.type === "action");

  function addRule() {
    const eventId = randomKey("event");
    const ruleId = randomKey("rule");
    onChange({
      ...kernel,
      events: [
        ...kernel.events,
        {
          id: eventId,
          label: "Record created",
          kind: "record_created",
        },
      ],
      rules: [
        ...kernel.rules,
        {
          id: ruleId,
          label: "New behavior",
          eventId,
          when: { mode: "all", conditions: [] },
          effects: [],
          priority: 100,
          enabled: true,
        },
      ],
    });
  }

  function patchRule(ruleId: string, patch: Partial<KernelRule>) {
    onChange({ ...kernel, rules: kernel.rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule) });
  }

  function removeRule(rule: KernelRule) {
    onChange({
      ...kernel,
      rules: kernel.rules.filter((item) => item.id !== rule.id),
      events: rule.eventId ? kernel.events.filter((event) => event.id !== rule.eventId) : kernel.events,
    });
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-lg font-semibold"><GitBranch className="h-5 w-5" /> Events, rules & effects</div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nothing here is a floating label. Connect the event, optionally test conditions, then configure exactly what changes. Actions configured in the App Builder automatically create/update their own action event and core effects.
            </div>
          </div>
          <SecondaryButton type="button" onClick={addRule}><Plus className="h-4 w-4" /> Event behavior</SecondaryButton>
        </div>
      </Panel>

      {kernel.rules.length === 0 ? (
        <Panel><div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No behavior rules yet. Configure an app action's “After success” properties, or add an Event behavior here.</div></Panel>
      ) : (
        <div className="space-y-4">
          {kernel.rules.map((rule) => {
            const event = kernel.events.find((item) => item.id === rule.eventId);
            return (
              <Panel key={rule.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <input className={`${inputClass} max-w-xl font-medium`} value={rule.label} onChange={(e) => patchRule(rule.id, { label: e.target.value })} />
                    <div className="mt-1 text-xs text-muted-foreground">WHEN → IF → APPLY effects → new world → recalculate possibilities</div>
                  </div>
                  <button type="button" onClick={() => removeRule(rule)} className="rounded-md p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide">1. When</div>
                    <Field label="Event type">
                      <select
                        className={inputClass}
                        value={event?.kind ?? "action"}
                        onChange={(e) => {
                          if (!event) return;
                          const kind = e.target.value as KernelEventKind;
                          if (kind === "action") {
                            const existingAction = actions.find(
                              (item) =>
                                item.type === "action" &&
                                item.action.id === event.actionId,
                            );

                            const fallbackAction =
                              existingAction ??
                              actions.find(
                                (
                                  item,
                                ): item is Extract<
                                  typeof item,
                                  { type: "action" }
                                > => item.type === "action",
                              );

                            if (!fallbackAction || fallbackAction.type !== "action") {
                              return;
                            }

                            onChange({
                              ...kernel,
                              events: kernel.events.map((item) =>
                                item.id === event.id
                                  ? {
                                      ...item,
                                      kind,
                                      actionId: fallbackAction.action.id,
                                      sourceKey: undefined,
                                      label: `${fallbackAction.action.label} happened`,
                                    }
                                  : item,
                              ),
                            });

                            return;
                          }

                          onChange({
                            ...kernel,
                            events: kernel.events.map((item) =>
                              item.id === event.id
                                ? {
                                    ...item,
                                    kind,
                                    actionId: undefined,
                                    label:
                                      kind === "record_created"
                                        ? "Record created"
                                        : item.label,
                                  }
                                : item,
                            ),
                          });
                        }}
                      >
                        {EVENT_KINDS.map((item) => (
                          <option
                            key={item.value}
                            value={item.value}
                            disabled={
                              item.value === "action" &&
                              actions.length === 0
                            }
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {event?.kind === "action" ? (
                      <Field label="Which app action?">
                        <select
                          className={inputClass}
                          value={event.actionId ?? ""}
                          onChange={(e) => onChange({ ...kernel, events: kernel.events.map((item) => item.id === event.id ? { ...item, actionId: e.target.value, label: `${actions.find((a) => a.type === "action" && a.action.id === e.target.value)?.action.label ?? "Action"} happened` } : item) })}
                        >
                          <option value="">Choose action...</option>
                          {actions.map((item) => item.type === "action" && <option key={item.action.id} value={item.action.id}>{item.action.label}</option>)}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Event source / key">
                        <input className={inputClass} value={event?.sourceKey ?? ""} onChange={(e) => event && onChange({ ...kernel, events: kernel.events.map((item) => item.id === event.id ? { ...item, sourceKey: e.target.value } : item) })} placeholder="optional" />
                      </Field>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border p-3 xl:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide">2. If</div>
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() => patchRule(rule.id, { when: { ...rule.when, conditions: [...rule.when.conditions, { id: randomKey("condition"), left: { kind: "state", key: "process" }, operator: "eq", right: { kind: "literal", value: "" } }] } })}
                      >
                        + Condition
                      </button>
                    </div>
                    <select className={`${inputClass} max-w-[220px]`} value={rule.when.mode} onChange={(e) => patchRule(rule.id, { when: { ...rule.when, mode: e.target.value as "all" | "any" } })}>
                      <option value="all">All conditions must match</option>
                      <option value="any">Any condition may match</option>
                    </select>
                    {rule.when.conditions.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No condition = always run when the event happens.</div>
                    ) : (
                      <div className="space-y-2">
                        {rule.when.conditions.map((condition) => (
                          <ConditionEditor
                            key={condition.id}
                            condition={condition}
                            onChange={(nextCondition) => patchRule(rule.id, { when: { ...rule.when, conditions: rule.when.conditions.map((item) => item.id === condition.id ? nextCondition : item) } })}
                            onDelete={() => patchRule(rule.id, { when: { ...rule.when, conditions: rule.when.conditions.filter((item) => item.id !== condition.id) } })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide">3. Effects</div>
                      <div className="mt-1 text-xs text-muted-foreground">Create/update/delete, change state/context, assign/notify/query/trigger—any combination.</div>
                    </div>
                    <select
                      className={`${inputClass} w-auto min-w-[220px]`}
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        patchRule(rule.id, { effects: [...rule.effects, { id: randomKey("effect"), kind: e.target.value as KernelEffectKind, config: {} }] });
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ Add effect...</option>
                      {EFFECT_CATALOG.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    {rule.effects.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">This rule does nothing yet.</div>
                    ) : rule.effects.map((effect) => (
                      <EffectEditor
                        key={effect.id}
                        kernel={kernel}
                        effect={effect}
                        onChange={(nextEffect) => patchRule(rule.id, { effects: rule.effects.map((item) => item.id === effect.id ? nextEffect : item) })}
                        onDelete={() => patchRule(rule.id, { effects: rule.effects.filter((item) => item.id !== effect.id) })}
                      />
                    ))}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
