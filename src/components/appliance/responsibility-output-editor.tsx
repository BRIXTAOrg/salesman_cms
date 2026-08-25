"use client";

import { Eye, Plus, Trash2 } from "lucide-react";

import type {
  KernelOutput,
  KernelOutputKind,
  KernelPossibility,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import { OUTPUT_CATALOG } from "@/lib/responsibility-kernel-catalog";
import { Field, inputClass, Panel, SecondaryButton } from "./primitives";

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

export default function ResponsibilityOutputEditor({
  kernel,
  onChange,
}: {
  kernel: ResponsibilityKernel;
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  const outputs = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "output" }> => item.type === "output",
  );
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> => item.type === "capture",
  );
  const actions = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "action" }> => item.type === "action",
  );

  function addOutput() {
    const id = randomKey("output");
    const output: KernelOutput = {
      id,
      label: "New view",
      kind: "detail",
      actorIds: [kernel.runtimeWorld.actors[0]?.id].filter(Boolean),
      stateIds: [],
      visibleKeys: captures.map((item) => item.capture.storeAs ?? item.capture.id),
      config: { actionIds: [] },
    };
    onChange({
      ...kernel,
      possibilities: [...kernel.possibilities, { id: randomKey("possibility"), type: "output", output }],
    });
  }

  function patch(possibilityId: string, output: KernelOutput) {
    onChange({
      ...kernel,
      possibilities: kernel.possibilities.map((item) =>
        item.id === possibilityId && item.type === "output" ? { ...item, output } : item,
      ),
    });
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-lg font-semibold"><Eye className="h-5 w-5" /> Output & views</div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The same Responsibility can look different to an employee, manager, accounts team or auditor. Choose who sees each view, in which states, what data is visible, and which actions appear.
            </div>
          </div>
          <SecondaryButton type="button" onClick={addOutput}><Plus className="h-4 w-4" /> View</SecondaryButton>
        </div>
      </Panel>

      {outputs.length === 0 ? (
        <Panel><div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No output yet. Add a view so someone can see the result/status after the app action.</div></Panel>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {outputs.map((item) => {
            const output = item.output;
            const actionIds = Array.isArray(output.config.actionIds) ? output.config.actionIds.map(String) : [];
            return (
              <Panel key={item.id}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input className={inputClass} value={output.label} onChange={(event) => patch(item.id, { ...output, label: event.target.value })} />
                  </div>
                  <button type="button" className="rounded-md p-2 text-muted-foreground hover:text-destructive" onClick={() => onChange({ ...kernel, possibilities: kernel.possibilities.filter((candidate) => candidate.id !== item.id) })}><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Layout">
                    <select className={inputClass} value={output.kind} onChange={(event) => patch(item.id, { ...output, kind: event.target.value as KernelOutputKind })}>
                      {OUTPUT_CATALOG.map((catalog) => <option key={catalog.kind} value={catalog.kind}>{catalog.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Optional title field">
                    <select className={inputClass} value={String(output.config.titleField ?? "")} onChange={(event) => patch(item.id, { ...output, config: { ...output.config, titleField: event.target.value } })}>
                      <option value="">Automatic</option>
                      {captures.map((capture) => <option key={capture.capture.id} value={capture.capture.storeAs ?? capture.capture.id}>{capture.capture.label}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-medium">Show to actors</div>
                    <div className="space-y-1 rounded-md border p-2">
                      {kernel.runtimeWorld.actors.map((actor) => (
                        <label key={actor.id} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30">
                          <input
                            type="checkbox"
                            checked={output.actorIds.includes(actor.id)}
                            onChange={(event) => patch(item.id, { ...output, actorIds: event.target.checked ? [...new Set([...output.actorIds, actor.id])] : output.actorIds.filter((id) => id !== actor.id) })}
                          />
                          {actor.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium">Show in states</div>
                    <div className="space-y-1 rounded-md border p-2">
                      <label className="flex items-center gap-2 rounded px-1 py-1.5 text-sm"><input type="checkbox" checked={output.stateIds.length === 0} onChange={(event) => event.target.checked && patch(item.id, { ...output, stateIds: [] })} /> Any state</label>
                      {kernel.runtimeWorld.states.map((state) => (
                        <label key={state.id} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30">
                          <input
                            type="checkbox"
                            checked={output.stateIds.includes(state.id)}
                            onChange={(event) => patch(item.id, { ...output, stateIds: event.target.checked ? [...new Set([...output.stateIds, state.id])] : output.stateIds.filter((id) => id !== state.id) })}
                          />
                          {state.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium">Visible data</div>
                  <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                    {captures.map((capture) => {
                      const key = capture.capture.storeAs ?? capture.capture.id;
                      return (
                        <label key={capture.capture.id} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30">
                          <input
                            type="checkbox"
                            checked={output.visibleKeys.includes(key)}
                            onChange={(event) => patch(item.id, { ...output, visibleKeys: event.target.checked ? [...new Set([...output.visibleKeys, key])] : output.visibleKeys.filter((value) => value !== key) })}
                          />
                          {capture.capture.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium">Actions shown in this view</div>
                  <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                    {actions.map((action) => (
                      <label key={action.action.id} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={actionIds.includes(action.action.id)}
                          onChange={(event) => {
                            const next = event.target.checked ? [...new Set([...actionIds, action.action.id])] : actionIds.filter((id) => id !== action.action.id);
                            patch(item.id, { ...output, config: { ...output.config, actionIds: next } });
                          }}
                        />
                        {action.action.label}
                      </label>
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
