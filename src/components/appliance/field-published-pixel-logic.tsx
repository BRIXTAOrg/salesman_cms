"use client";

// BRIXTA_FIELD_OPS_V1: display the *published* graph; never the unsaved draft.
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";

type Props = { value: PixelLogicProgram | null | undefined; version: number; title?: string };

export default function FieldPublishedPixelLogic({ value, version, title = "Currently published Pixel Logic" }: Props) {
  const nodes = value?.nodes ?? [];
  const edges = value?.edges ?? [];
  const effects = nodes.filter(node => node.type.startsWith("effect."));
  const compare = nodes.filter(node => node.type === "logic.compare");
  return (
    <section className="rounded-xl border bg-background p-4" aria-label="Currently published Field Pixel Logic">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full border px-2.5 py-1 text-xs">Live v{version} · {value?.enabled ? "Enabled" : "Not active"}</span>
      </div>
      {!value || !value.enabled ? (
        <div className="mt-3 rounded-lg border border-dashed p-4 space-y-2">
          <p className="text-sm font-medium">No active Pixel Logic on this list</p>
          <p className="text-xs text-muted-foreground">The Field App can still display existing records and steps. To add a rule, open App experiences, choose this list, edit Pixel Logic and publish. Reload here to inspect the new live graph. No CRM data will be cleared.</p>
          {value && <details className="text-xs"><summary className="cursor-pointer">Inspect published inactive graph</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre></details>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {nodes.length} nodes · {edges.length} connections · {compare.length} comparisons · {effects.length} effects.
            This is the saved LIVE version, not the current editing draft.
          </p>
          <section className="rounded-lg border p-3 space-y-3">
            <h4 className="text-xs font-semibold">Live graph · nodes and connections</h4>
            <div className="grid max-h-80 gap-2 overflow-y-auto md:grid-cols-2">
              {nodes.map(node => (
                <div key={node.id} className="rounded-lg border bg-muted/10 p-2 text-xs">
                  <div className="font-semibold">{node.label || node.type}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">{node.type} · {node.id}</div>
                  {Object.keys(node.config ?? {}).length > 0 &&
                    <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">{JSON.stringify(node.config, null, 2)}</pre>}
                </div>
              ))}
            </div>
            <details className="rounded-lg border p-2 text-xs">
              <summary className="cursor-pointer font-medium">Inspect {edges.length} graph connections</summary>
              <ol className="mt-2 space-y-1 font-mono text-[10px]">
                {edges.map(edge => <li key={edge.id}>{edge.fromNodeId}.{edge.fromPort} → {edge.toNodeId}.{edge.toPort} ({edge.kind})</li>)}
              </ol>
            </details>
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            {effects.map((effect) => (
              <div key={effect.id} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                <div className="font-semibold">{effect.label || effect.type.replace("effect.", "").replaceAll("_", " ")}</div>
                <div className="mt-1 break-words text-muted-foreground">{effect.type === "effect.change_state"
                  ? `To stage: ${String(effect.config.state ?? "not set")}`
                  : effect.type === "effect.trigger_responsibility"
                  ? `Responsibility: ${String(effect.config.responsibilityKey ?? "not set")}`
                  : effect.type === "effect.append_history"
                  ? `History: ${String(effect.config.label ?? "not set")}`
                  : "Published node"}</div>
              </div>
            ))}
          </div>
          <details className="rounded-lg border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">Inspect entire published graph (read-only)</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px]">{JSON.stringify(value, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
