"use client";

import { useEffect, useState } from "react";
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";
import { normalizePixelLogicProgram } from "@/lib/pixel-logic-types";
import { validateFieldPixelLogic } from "@/lib/field-pixel-logic";
import FieldPixelLogicVisual from "./field-pixel-logic-visual";

type Choice = { key: string; label: string };
type Props = {
  value: PixelLogicProgram | null;
  fields: Choice[];
  stages: Choice[];
  onChange: (value: PixelLogicProgram | null) => void;
};

export default function FieldPixelLogicEditor({ value, fields, stages, onChange }: Props) {
  const [field, setField] = useState("");
  const [expected, setExpected] = useState("");
  const [stage, setStage] = useState("");
  // BRIXTA_FIELD_PIXEL_WORK_TRIGGER_V1
  const [responsibilityKey, setResponsibilityKey] = useState("");
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(value ? JSON.stringify(value, null, 2) : "");
  }, [value]);

  const issues = validateFieldPixelLogic(value, stages);

  function buildRule() {
    if (!field || !stage || !expected.trim()) {
      setError("Select a CRM answer, comparison value and destination stage.");
      return;
    }
    const node = (id: string, type: string, x: number, y: number, config: Record<string, unknown> = {}) =>
      ({ id, type, position: { x, y }, config });
    const edge = (id: string, kind: "flow" | "data", fromNodeId: string,
      fromPort: string, toNodeId: string, toPort: string) =>
      ({ id, kind, fromNodeId, fromPort, toNodeId, toPort });
    const rule: PixelLogicProgram = {
      version: 1, enabled: true, name: "Field App rule",
      metadata: { description: `When ${field} equals ${expected}, move to ${stage}${responsibilityKey.trim() ? ` and start ${responsibilityKey.trim()}` : ""}` },
      variables: [],
      nodes: [
        node("event", "event.record.updated", 0, 160),
        node("answer", "value.ref", 0, 350, { scope: "capture", key: field }),
        node("expected", "value.literal", 0, 480, { value: expected }),
        node("compare", "logic.compare", 280, 350, { operator: "eq" }),
        node("condition", "control.if", 500, 160),
        node("change_stage", "effect.change_state", 760, 120, { state: stage }),
        node("history", "effect.append_history", 1040, 120, {
          label: `Pixel Logic: ${field} matched ${expected}; stage changed to ${stage}`,
        }),
      ],
      edges: [
        edge("flow_start", "flow", "event", "flow", "condition", "flow"),
        edge("data_answer", "data", "answer", "value", "compare", "left"),
        edge("data_expected", "data", "expected", "value", "compare", "right"),
        edge("data_compare", "data", "compare", "value", "condition", "condition"),
        edge("flow_true", "flow", "condition", "true", "change_stage", "flow"),
        edge("flow_history", "flow", "change_stage", "flow", "history", "flow"),
      ],
    };
    if (responsibilityKey.trim()) {
      rule.nodes.push(node("start_work", "effect.trigger_responsibility", 1300, 120, {
        responsibilityKey: responsibilityKey.trim(),
      }));
      rule.edges.push(edge("flow_start_work", "flow", "history", "flow", "start_work", "flow"));
    }
    const errors = validateFieldPixelLogic(rule, stages);
    if (errors.length) { setError(errors.join(" ")); return; }
    onChange(rule);
    setError(null);
  }

  function applyJson() {
    try {
      const parsed: unknown = JSON.parse(raw);
      const program = normalizePixelLogicProgram(parsed, "Field App Pixel Logic");
      const problems = validateFieldPixelLogic(program, stages);
      if (problems.length) { setError(problems.join(" ")); return; }
      onChange(program);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Invalid JSON");
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h3 className="text-lg font-semibold">Pixel Logic · Field App</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Server-executed after a Field step is saved. Rules are versioned with this App Experience.
          Existing answers and assignments are never cleared. Only stage changes and timeline history
          or one linked Responsibility may start; other effects remain blocked.
          Publishing is required to activate changes.
        </p>
      </div>
      <FieldPixelLogicVisual value={value} fields={fields} stages={stages} onChange={onChange} />
      <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        Quick rule below is a shortcut that replaces the current draft graph. Use the visual canvas above
        to edit an existing graph without replacing its other nodes.
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs">Answer / CRM field
          <select className="w-full rounded-lg border bg-background p-2 text-sm" value={field}
            onChange={(event) => setField(event.target.value)}>
            <option value="">Select field</option>
            {fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs">Equals
          <input className="w-full rounded-lg border bg-background p-2 text-sm" value={expected}
            onChange={(event) => setExpected(event.target.value)} placeholder="Hot" />
        </label>
        <label className="space-y-1 text-xs">Change stage to
          <select className="w-full rounded-lg border bg-background p-2 text-sm" value={stage}
            onChange={(event) => setStage(event.target.value)}>
            <option value="">Select stage</option>
            {stages.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-xs">Auto-start a published Responsibility (optional)
        <input className="w-full rounded-lg border bg-background p-2 text-sm" value={responsibilityKey}
          onChange={(event) => setResponsibilityKey(event.target.value)}
          placeholder="Exact Responsibility key, e.g. site_follow_up" />
        <span className="block text-muted-foreground">When true, starts work for the employee already assigned to this site. Repeat saves do not create duplicates. Assign the CRM site before using this action.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-foreground px-4 py-2 text-sm text-background"
          onClick={buildRule}>Build executable rule</button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm"
          onClick={() => onChange(value ? { ...value, enabled: !value.enabled } : null)}
          disabled={!value}>{value?.enabled ? "Disable rule" : "Enable rule"}</button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm"
          onClick={() => { if (window.confirm("Remove this draft rule? Live rules remain until publication.")) onChange(null); }}
          disabled={!value}>Remove rule</button>
      </div>
      {value && <p className="text-xs text-muted-foreground">
        {value.enabled ? "Enabled" : "Disabled"} · {value.nodes.length} nodes · {value.edges.length} connections
      </p>}
      {issues.length > 0 && <p className="text-xs text-red-600">{issues.join(" ")}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">Advanced · edit Pixel Logic graph JSON</summary>
        <p className="mt-2 text-xs text-muted-foreground">Only approved nodes execute. This is a graph contract, not arbitrary code.</p>
        <textarea aria-label="Pixel Logic program JSON" value={raw}
          onChange={(event) => setRaw(event.target.value)} rows={14}
          className="mt-3 w-full rounded-lg border bg-background p-3 font-mono text-xs" />
        <button type="button" className="mt-2 rounded-lg border px-3 py-2 text-sm"
          onClick={applyJson}>Validate and apply graph</button>
      </details>
    </section>
  );
}
