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
      {!value ? (
        <p className="mt-2 text-sm text-muted-foreground">No published Pixel Logic graph for this list. Draft rules below do not affect phones until published.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {nodes.length} nodes · {edges.length} connections · {compare.length} comparisons · {effects.length} effects.
            This is the saved LIVE version, not the current editing draft.
          </p>
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
