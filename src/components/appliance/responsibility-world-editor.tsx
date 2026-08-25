"use client";

import { Activity, Box, BrainCircuit, Plus, Trash2, UserRound } from "lucide-react";

import type { Employee, Role } from "@/lib/appliance-types";
import type {
  KernelActor,
  KernelActorResolver,
  KernelContext,
  KernelContextSource,
  KernelObject,
  KernelObjectKind,
  KernelState,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import { CONTEXT_CATALOG } from "@/lib/responsibility-kernel-catalog";
import { Field, inputClass, Panel, SecondaryButton, textareaClass } from "./primitives";

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function currentUserResolver(): KernelActorResolver {
  return { kind: "current_user" };
}

function actorResolverNeedsTarget(kind: KernelActorResolver["kind"]) {
  return ["manager_of", "selected_reference", "query_result", "relationship", "specific_user", "role"].includes(kind);
}

function resolverTargetLabel(resolver: KernelActorResolver) {
  switch (resolver.kind) {
    case "manager_of":
      return "Manager of";
    case "selected_reference":
      return "Selected person/reference";
    case "query_result":
      return "Query key";
    case "relationship":
      return "Relationship name";
    case "specific_user":
      return "Employee";
    case "role":
      return "Role";
    default:
      return "";
  }
}

export default function ResponsibilityWorldEditor({
  kernel,
  roles,
  employees,
  onChange,
}: {
  kernel: ResponsibilityKernel;
  roles: Role[];
  employees: Employee[];
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  function updateWorld<K extends keyof ResponsibilityKernel["runtimeWorld"]>(
    key: K,
    value: ResponsibilityKernel["runtimeWorld"][K],
  ) {
    onChange({
      ...kernel,
      runtimeWorld: { ...kernel.runtimeWorld, [key]: value },
    });
  }

  function patchActor(id: string, patch: Partial<KernelActor>) {
    updateWorld(
      "actors",
      kernel.runtimeWorld.actors.map((actor) => (actor.id === id ? { ...actor, ...patch } : actor)),
    );
  }

  function patchObject(id: string, patch: Partial<KernelObject>) {
    updateWorld(
      "objects",
      kernel.runtimeWorld.objects.map((object) => (object.id === id ? { ...object, ...patch } : object)),
    );
  }

  function patchContext(id: string, patch: Partial<KernelContext>) {
    updateWorld(
      "contexts",
      kernel.runtimeWorld.contexts.map((context) => (context.id === id ? { ...context, ...patch } : context)),
    );
  }

  function patchState(id: string, patch: Partial<KernelState>) {
    let next = kernel.runtimeWorld.states.map((state) => (state.id === id ? { ...state, ...patch } : state));
    if (patch.initial === true) {
      const dimension = next.find((state) => state.id === id)?.dimension ?? "process";
      next = next.map((state) =>
        state.id !== id && state.dimension === dimension ? { ...state, initial: false } : state,
      );
    }
    updateWorld("states", next);
  }

  const referenceCaptures = kernel.possibilities.filter(
    (item) => item.type === "capture" && ["person_reference", "entity_reference", "responsibility_reference"].includes(item.capture.kind),
  );

  return (
    <div className="space-y-5">
      <Panel>
        <div className="max-w-4xl">
          <div className="text-lg font-semibold">Runtime world</div>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Define the people, things, facts and states that exist around this Responsibility. These are real references used by the app, actions, rules and outputs—not labels floating on their own.
          </div>
        </div>
      </Panel>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4" /> Actors</div>
              <div className="mt-1 text-xs text-muted-foreground">Who can perform, receive, own or be notified.</div>
            </div>
            <SecondaryButton
              type="button"
              onClick={() =>
                updateWorld("actors", [
                  ...kernel.runtimeWorld.actors,
                  { id: randomKey("actor"), label: "New participant", resolver: currentUserResolver() },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Actor
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-3">
            {kernel.runtimeWorld.actors.map((actor) => (
              <div key={actor.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className={inputClass}
                      value={actor.label}
                      onChange={(event) => patchActor(actor.id, { label: event.target.value })}
                      placeholder="Reporting manager"
                    />
                  </div>
                  {!['current_employee', 'system'].includes(actor.id) && (
                    <button
                      type="button"
                      className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                      onClick={() => updateWorld("actors", kernel.runtimeWorld.actors.filter((item) => item.id !== actor.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Field label="Resolve this actor from">
                  <select
                    className={inputClass}
                    value={actor.resolver.kind}
                    onChange={(event) => {
                      const kind = event.target.value as KernelActorResolver["kind"];
                      let resolver: KernelActorResolver;
                      if (kind === "manager_of") resolver = { kind, value: { kind: "actor", key: "current_employee" } };
                      else if (kind === "selected_reference") resolver = { kind, referenceKey: "" };
                      else if (kind === "query_result") resolver = { kind, queryKey: "" };
                      else if (kind === "relationship") resolver = { kind, source: { kind: "actor", key: "current_employee" }, relation: "" };
                      else if (kind === "specific_user") resolver = { kind };
                      else if (kind === "role") resolver = { kind };
                      else if (kind === "record_creator") resolver = { kind };
                      else if (kind === "system") resolver = { kind };
                      else resolver = { kind: "current_user" };
                      patchActor(actor.id, { resolver });
                    }}
                  >
                    <option value="current_user">Current employee</option>
                    <option value="record_creator">Creator of this record</option>
                    <option value="manager_of">Manager of...</option>
                    <option value="selected_reference">Selected person/reference</option>
                    <option value="role">Users with a role</option>
                    <option value="specific_user">Specific employee</option>
                    <option value="query_result">Query result</option>
                    <option value="relationship">Relationship of...</option>
                    <option value="system">System</option>
                  </select>
                </Field>

                {actorResolverNeedsTarget(actor.resolver.kind) && (
                  <Field label={resolverTargetLabel(actor.resolver)}>
                    {actor.resolver.kind === "manager_of" ? (
                      <select
                        className={inputClass}
                        value={actor.resolver.value.kind === "actor" ? actor.resolver.value.key : "current_employee"}
                        onChange={(event) => patchActor(actor.id, { resolver: { kind: "manager_of", value: { kind: "actor", key: event.target.value } } })}
                      >
                        {kernel.runtimeWorld.actors.filter((item) => item.id !== actor.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    ) : actor.resolver.kind === "selected_reference" ? (
                      <select
                        className={inputClass}
                        value={actor.resolver.referenceKey}
                        onChange={(event) => patchActor(actor.id, { resolver: { kind: "selected_reference", referenceKey: event.target.value } })}
                      >
                        <option value="">Choose a reference...</option>
                        {referenceCaptures.map((item) => item.type === "capture" && <option key={item.capture.id} value={item.capture.storeAs ?? item.capture.id}>{item.capture.label}</option>)}
                      </select>
                    ) : actor.resolver.kind === "role" ? (
                      <select
                        className={inputClass}
                        value={actor.resolver.roleId ?? ""}
                        onChange={(event) => patchActor(actor.id, { resolver: { kind: "role", roleId: event.target.value ? Number(event.target.value) : undefined } })}
                      >
                        <option value="">Choose a role...</option>
                        {roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                      </select>
                    ) : actor.resolver.kind === "specific_user" ? (
                      <select
                        className={inputClass}
                        value={actor.resolver.userId ?? ""}
                        onChange={(event) => patchActor(actor.id, { resolver: { kind: "specific_user", userId: event.target.value ? Number(event.target.value) : undefined } })}
                      >
                        <option value="">Choose an employee...</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name ?? employee.username ?? `Employee ${employee.id}`}</option>)}
                      </select>
                    ) : actor.resolver.kind === "query_result" ? (
                      <input className={inputClass} value={actor.resolver.queryKey} onChange={(event) => patchActor(actor.id, { resolver: { kind: "query_result", queryKey: event.target.value, path: actor.resolver.kind === "query_result" ? actor.resolver.path : undefined } })} placeholder="available_manager" />
                    ) : actor.resolver.kind === "relationship" ? (
                      <input className={inputClass} value={actor.resolver.relation} onChange={(event) => patchActor(actor.id, { resolver: { kind: "relationship", source: actor.resolver.kind === "relationship" ? actor.resolver.source : { kind: "actor", key: "current_employee" }, relation: event.target.value } })} placeholder="department_head" />
                    ) : null}
                  </Field>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold"><Box className="h-4 w-4" /> Objects</div>
              <div className="mt-1 text-xs text-muted-foreground">What the Responsibility is acting on. Give every object a business meaning/source.</div>
            </div>
            <SecondaryButton
              type="button"
              onClick={() => updateWorld("objects", [...kernel.runtimeWorld.objects, { id: randomKey("object"), label: "Business record", kind: "entity" }])}
            >
              <Plus className="h-4 w-4" /> Object
            </SecondaryButton>
          </div>
          <div className="mt-4 space-y-3">
            {kernel.runtimeWorld.objects.map((object) => (
              <div key={object.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex gap-2">
                  <input className={inputClass} value={object.label} onChange={(event) => patchObject(object.id, { label: event.target.value })} placeholder="Leave request / Dealer / Machine" />
                  {object.id !== "current_record" && (
                    <button type="button" className="rounded-md p-2 text-muted-foreground hover:text-destructive" onClick={() => updateWorld("objects", kernel.runtimeWorld.objects.filter((item) => item.id !== object.id))}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Object type">
                    <select className={inputClass} value={object.kind} onChange={(event) => patchObject(object.id, { kind: event.target.value as KernelObjectKind })}>
                      <option value="current_record">This Responsibility record</option>
                      <option value="entity">Reusable entity / business record</option>
                      <option value="responsibility_record">Another Responsibility record</option>
                      <option value="employee">Employee</option>
                      <option value="device">Device</option>
                      <option value="session">Session / journey</option>
                      <option value="external">External system record</option>
                    </select>
                  </Field>
                  <Field label="Source key (when applicable)">
                    <input className={inputClass} value={object.sourceKey ?? ""} onChange={(event) => patchObject(object.id, { sourceKey: event.target.value })} placeholder="dealer / inspection_records" />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea className={textareaClass} rows={2} value={object.description ?? ""} onChange={(event) => patchObject(object.id, { description: event.target.value })} placeholder="What does this object represent in this Responsibility?" />
                </Field>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold"><BrainCircuit className="h-4 w-4" /> Context</div>
              <div className="mt-1 text-xs text-muted-foreground">What BRIXTA knows/prefills/queries instead of asking the user again.</div>
            </div>
            <SecondaryButton
              type="button"
              onClick={() => updateWorld("contexts", [...kernel.runtimeWorld.contexts, { id: randomKey("context"), label: "Known value", source: "query", mutable: false }])}
            >
              <Plus className="h-4 w-4" /> Context
            </SecondaryButton>
          </div>
          <div className="mt-4 space-y-3">
            {kernel.runtimeWorld.contexts.map((context) => (
              <div key={context.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex gap-2">
                  <input className={inputClass} value={context.label} onChange={(event) => patchContext(context.id, { label: event.target.value })} />
                  {!['current_employee', 'current_time'].includes(context.id) && (
                    <button type="button" className="rounded-md p-2 text-muted-foreground hover:text-destructive" onClick={() => updateWorld("contexts", kernel.runtimeWorld.contexts.filter((item) => item.id !== context.id))}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Get value from">
                    <select className={inputClass} value={context.source} onChange={(event) => patchContext(context.id, { source: event.target.value as KernelContextSource })}>
                      {CONTEXT_CATALOG.map((item) => <option key={item.source} value={item.source}>{item.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Source / query / relationship key">
                    <input className={inputClass} value={context.sourceKey ?? ""} onChange={(event) => patchContext(context.id, { sourceKey: event.target.value })} placeholder="optional" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={context.mutable} onChange={(event) => patchContext(context.id, { mutable: event.target.checked })} /> This context may be updated while the Responsibility runs</label>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" /> State</div>
              <div className="mt-1 text-xs text-muted-foreground">What is true now. Actions/rules can move between these states.</div>
            </div>
            <SecondaryButton
              type="button"
              onClick={() => updateWorld("states", [...kernel.runtimeWorld.states, { id: randomKey("state"), label: "New state", dimension: "process" }])}
            >
              <Plus className="h-4 w-4" /> State
            </SecondaryButton>
          </div>
          <div className="mt-4 space-y-3">
            {kernel.runtimeWorld.states.map((state) => (
              <div key={state.id} className="rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
                  <input className={inputClass} value={state.label} onChange={(event) => patchState(state.id, { label: event.target.value })} placeholder="Pending manager" />
                  <input className={inputClass} value={state.dimension} onChange={(event) => patchState(state.id, { dimension: event.target.value })} placeholder="process" />
                  <button type="button" className="rounded-md p-2 text-muted-foreground hover:text-destructive" onClick={() => updateWorld("states", kernel.runtimeWorld.states.filter((item) => item.id !== state.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={state.initial === true} onChange={(event) => patchState(state.id, { initial: event.target.checked })} /> Initial</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={state.terminal === true} onChange={(event) => patchState(state.id, { terminal: event.target.checked })} /> Terminal</label>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
