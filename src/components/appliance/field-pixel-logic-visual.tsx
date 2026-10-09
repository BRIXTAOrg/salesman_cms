"use client";

// BRIXTA_FIELD_PIXEL_VISUAL_V1
// Authoring UI only. App Experience remains the sole draft/publish authority.
// Shared graph model + existing React Flow canvas; no alternate runtime.
import { useMemo, useState } from "react";
import { PixelLogicFlowCanvas } from "./pixel-logic-flow-canvas";
import FieldPixelPreviewPanel from "./field-pixel-preview-panel";
import { getPixelLogicNodeSpec } from "@/lib/pixel-logic-registry";
import { blankPixelLogicProgram, type PixelLogicProgram, type PixelLogicNode } from "@/lib/pixel-logic-types";
import { validateFieldPixelLogic } from "@/lib/field-pixel-logic";

type Choice = { key: string; label: string };
type Props = {
  value: PixelLogicProgram | null;
  fields: Choice[];
  stages: Choice[];
  onChange: (value: PixelLogicProgram | null) => void;
};

const FIELD_NODE_TYPES = [
  "event.record.updated",
  "value.ref",
  "value.literal",
  "logic.compare",
  "control.if",
  "effect.change_state",
  "effect.append_history",
  "effect.trigger_responsibility",
] as const;

const COMPARISONS: Choice[] = [
  { key: "eq", label: "Equals" },
  { key: "neq", label: "Not equal" },
  { key: "gt", label: "Greater than" },
  { key: "gte", label: "At least" },
  { key: "lt", label: "Less than" },
  { key: "lte", label: "At most" },
  { key: "contains", label: "Contains" },
  { key: "exists", label: "Exists" },
  { key: "not_exists", label: "Does not exist" },
];

const inputClass = "w-full rounded-lg border bg-background p-2 text-sm";
const buttonClass = "rounded-lg border bg-background px-3 py-2 text-left text-xs hover:bg-muted/50";

function defaultConfig(type: string, fields: Choice[], stages: Choice[]): Record<string, unknown> {
  switch (type) {
    case "value.ref": return { scope: "capture", key: fields[0]?.key ?? "" };
    case "value.literal": return { value: "" };
    case "logic.compare": return { operator: "eq" };
    case "effect.change_state": return { state: stages[0]?.key ?? "" };
    case "effect.append_history": return { label: "Field rule matched" };
    case "effect.trigger_responsibility": return { responsibilityKey: "" };
    default: return {};
  }
}

export default function FieldPixelLogicVisual({ value, fields, stages, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const specs = useMemo(
    () => FIELD_NODE_TYPES.map((type) => getPixelLogicNodeSpec(type)).filter(
      (spec): spec is NonNullable<typeof spec> => Boolean(spec),
    ),
    [],
  );
  const selected = value?.nodes.find((node) => node.id === selectedId) ?? null;
  const issues = useMemo(() => validateFieldPixelLogic(value, stages), [value, stages]);

  function createGraph() {
    const start = blankPixelLogicProgram("Field App visual rule");
    // Disabled until the administrator has connected and validated the nodes.
    start.enabled = false;
    start.nodes = [{
      id: "event", type: "event.record.updated", label: "Record updated",
      position: { x: 100, y: 180 }, config: {},
    }];
    onChange(start);
    setSelectedId("event");
  }

  function addNode(type: string, position?: { x: number; y: number }) {
    if (!FIELD_NODE_TYPES.some((allowed) => allowed === type)) return;
    if (!value || value.nodes.length >= 32) return;
    if (type === "event.record.updated" && value.nodes.some((node) => node.type === type)) return;
    const id = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    const spec = getPixelLogicNodeSpec(type);
    const node: PixelLogicNode = {
      id, type, label: spec?.label ?? type,
      position: position ?? { x: 100 + (value.nodes.length % 4) * 270, y: 100 + Math.floor(value.nodes.length / 4) * 180 },
      config: defaultConfig(type, fields, stages),
    };
    onChange({ ...value, nodes: [...value.nodes, node] });
    setSelectedId(id);
  }

  function updateNode(config: Record<string, unknown>) {
    if (!value || !selected) return;
    onChange({ ...value, nodes: value.nodes.map((node) =>
      node.id === selected.id ? { ...node, config: { ...node.config, ...config } } : node,
    ) });
  }

  function deleteSelected() {
    if (!value || !selected) return;
    onChange({
      ...value,
      nodes: value.nodes.filter((node) => node.id !== selected.id),
      edges: value.edges.filter((edge) => edge.fromNodeId !== selected.id && edge.toNodeId !== selected.id),
    });
    setSelectedId(null);
  }

  function choose(label: string, valueText: string, choices: Choice[], onChoose: (v: string) => void) {
    return (
      <label className="block space-y-1 text-xs" key={label}>
        <span className="text-muted-foreground">{label}</span>
        <select aria-label={label} className={inputClass} value={valueText} onChange={(event) => onChoose(event.target.value)}>
          <option value="">Select</option>
          {choices.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
    );
  }

  function freeText(label: string, configKey: string, placeholder: string, limit = 160) {
    return (
      <label className="block space-y-1 text-xs" key={configKey}>
        <span className="text-muted-foreground">{label}</span>
        <input aria-label={label} className={inputClass} value={String(selected?.config[configKey] ?? "")}
          placeholder={placeholder} maxLength={limit}
          onChange={(event) => updateNode({ [configKey]: event.target.value })} />
      </label>
    );
  }

  function controls() {
    if (!selected) return <p className="text-xs text-muted-foreground">Select a node to configure it. Drag from a port to another compatible port to connect nodes. The canvas lets you delete connections or move nodes.</p>;
    switch (selected.type) {
      case "value.ref": {
        const scope = String(selected.config.scope ?? "capture");
        const keys = scope === "capture" ? fields : scope === "context"
          ? [{ key: "sectionKey", label: "Saved section" }]
          : [{ key: "stage", label: "Current stage" }];
        return <div className="space-y-3">
          {choose("Value source", scope, [
            { key: "capture", label: "Captured CRM answer" },
            { key: "context", label: "Event context" },
            { key: "state", label: "Current state" },
          ], (v) => updateNode({ scope: v, key: v === "capture" ? fields[0]?.key ?? "" : v === "context" ? "sectionKey" : "stage" }))}
          {choose("Field", String(selected.config.key ?? ""), keys, (v) => updateNode({ key: v }))}
        </div>;
      }
      case "value.literal":
        return freeText("Compare against", "value", "Hot, 100, true…", 500);
      case "logic.compare":
        return choose("Comparison", String(selected.config.operator ?? "eq"), COMPARISONS, (v) => updateNode({ operator: v }));
      case "effect.change_state":
        return choose("Destination stage", String(selected.config.state ?? ""), stages, (v) => updateNode({ state: v }));
      case "effect.append_history":
        return freeText("Audit timeline label", "label", "Hot lead identified");
      case "effect.trigger_responsibility":
        return <div className="space-y-2">
          {freeText("Published Responsibility key", "responsibilityKey", "site_follow_up", 120)}
          <p className="text-xs text-muted-foreground">The CRM record must already be assigned to the saving employee. Existing work is not duplicated.</p>
        </div>;
      default:
        return <p className="text-xs text-muted-foreground">No configuration needed. Connect the node&apos;s ports on the canvas.</p>;
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/[0.08] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Visual graph builder</h4>
          <p className="mt-1 text-xs text-muted-foreground">Uses the existing Pixel Logic runtime. This is an unpublished draft until you save and publish this App Experience.</p>
        </div>
        {!value ? (
          <button className={buttonClass} type="button" onClick={createGraph}>Create visual graph</button>
        ) : (
          <span className="rounded-lg border px-3 py-2 text-xs">{value.nodes.length}/32 nodes · {value.edges.length}/64 connections · {value.enabled ? "Enabled" : "Disabled"}</span>
        )}
      </div>
      {value && <>
        <div className="flex flex-wrap gap-2" aria-label="Available Field Pixel Logic nodes">
          {specs.map((spec) => (
            <button type="button" key={spec.type} className={buttonClass} draggable
              onDragStart={(event) => event.dataTransfer.setData("application/x-brixta-pixel-logic", spec.type)}
              disabled={value.nodes.length >= 32 || (spec.type === "event.record.updated" && value.nodes.some((node) => node.type === spec.type))}
              onClick={() => addNode(spec.type)} title={`${spec.description} — drag onto canvas or click to add`}>
              + {spec.label}
            </button>
          ))}
        </div>
        <PixelLogicFlowCanvas program={value} specs={specs} selectedNodeId={selectedId}
          onProgramChange={onChange} onSelectNode={setSelectedId} onAddNode={addNode} />
        <div className="rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{selected ? selected.label ?? selected.type : "Node inspector"}</div>
              {selected && <div className="font-mono text-[11px] text-muted-foreground">{selected.type}</div>}
            </div>
            {selected && <button type="button" className={buttonClass} onClick={deleteSelected}>Delete selected node</button>}
          </div>
          {controls()}
        </div>
        {/* BRIXTA_FIELD_PIXEL_PREVIEW_V1: backend-powered, dry-run only. */}
        <FieldPixelPreviewPanel value={value} fields={fields} stages={stages} />
        {issues.length > 0 ? (
          <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-xs text-red-700">
            {issues.map((item, index) => <p key={`${index}-${item}`}>{item}</p>)}
          </div>
        ) : <p className="text-xs text-muted-foreground">No Field host-validation errors detected. Review connections and branches before enabling the rule.</p>}
      </>}
    </section>
  );
}
