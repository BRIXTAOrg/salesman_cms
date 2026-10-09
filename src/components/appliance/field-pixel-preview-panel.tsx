"use client";

// BRIXTA_FIELD_PIXEL_PREVIEW_V1
// Synthetic preview only: no CRM write, employee assignment or publication.
import { useEffect, useState } from "react";
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";

type Choice = { key: string; label: string };
type Props = { value: PixelLogicProgram; fields: Choice[]; stages: Choice[] };
type Issue = { severity: "error" | "warning"; message: string; nodeId?: string };
type Result = {
  success?: boolean;
  ok?: boolean;
  error?: string;
  errors?: string[];
  diagnostics?: Issue[];
  matched?: boolean;
  evaluatedDisabledDraft?: boolean;
  predictedStage?: string;
  history?: string[];
  wouldStartResponsibilities?: string[];
  effects?: Array<{ nodeId: string; kind: string; targetKey?: string | null; value?: unknown }>;
  trace?: Array<{ nodeId: string; nodeType: string; outputs: Record<string, unknown> }>;
};

export default function FieldPixelPreviewPanel({ value, fields, stages }: Props) {
  const [field, setField] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [stage, setStage] = useState("");
  const [sectionKey, setSectionKey] = useState("visit");
  const [captureJson, setCaptureJson] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Clear old previews after graph changes; a previous trace cannot validate a new draft.
  useEffect(() => { setResult(null); setError(null); }, [value]);

  async function runPreview() {
    setError(null);
    setResult(null);
    let capture: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(captureJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON must be an object.");
      capture = { ...(parsed as Record<string, unknown>) };
      if (field) capture[field] = fieldValue;
    } catch {
      setError("Sample answers must be a JSON object (for example {\"customer_interest\":\"Hot\"}).");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/appliance/field-pixel-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          program: value, stages: stages.map(item => ({ key: item.key })),
          sample: { capture, stage: stage || stages[0]?.key || "new", sectionKey },
        }),
      });
      const body: Result = await response.json();
      setResult(body);
      if (!response.ok && !body.diagnostics) setError(body.error || `Preview request failed (${response.status}).`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Cannot connect to the backend preview service.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div>
        <h4 className="text-sm font-semibold">Graph review & execution preview</h4>
        <p className="mt-1 text-xs text-muted-foreground">Runs the backend evaluator with synthetic answers. No CRM data, work items, audit history or published versions are changed.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs">Sample answer field
          <select aria-label="Sample answer field" className={inputClass} value={field} onChange={event => setField(event.target.value)}>
            <option value="">Use JSON only</option>
            {fields.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs">Sample answer value
          <input aria-label="Sample answer value" className={inputClass} value={fieldValue} onChange={event => setFieldValue(event.target.value)} placeholder="Hot" disabled={!field} />
        </label>
        <label className="text-xs">Starting stage
          <select aria-label="Starting stage" className={inputClass} value={stage} onChange={event => setStage(event.target.value)}>
            {stages.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs">Saved section key (simulated)
        <input aria-label="Saved section key" className={inputClass} maxLength={120} value={sectionKey} onChange={event => setSectionKey(event.target.value)} />
      </label>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-xs font-medium">Advanced sample answers (JSON)</summary>
        <textarea aria-label="Sample answers JSON" className="mt-2 w-full rounded-lg border bg-background p-2 font-mono text-xs" rows={5} maxLength={8000}
          value={captureJson} onChange={event => setCaptureJson(event.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Use numbers or booleans in JSON. The selected field above overrides the same JSON key with text.</p>
      </details>
      <button type="button" disabled={loading} onClick={() => void runPreview()}
        className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50">
        {loading ? "Evaluating…" : "Check graph & preview effects"}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {result && <div className="space-y-3 text-xs">
        {(result.errors ?? []).map((item, i) => <p key={`e${i}`} className="text-red-600">{item}</p>)}
        {(result.diagnostics ?? []).map((item, i) => <p key={`w${i}`} className={item.severity === "error" ? "text-red-600" : "text-amber-700"}>
          {item.severity === "error" ? "Error" : "Review"}{item.nodeId ? ` (${item.nodeId})` : ""}: {item.message}
        </p>)}
        {result.ok && <div className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">Simulated result: {result.matched ? "event matched" : "no matching event"}</p>
          <p>Predicted stage: <strong>{stages.find(item => item.key === result.predictedStage)?.label ?? result.predictedStage ?? "Unchanged"}</strong></p>
          <p>History entries: {result.history?.length ?? 0}</p>
          <p>Responsibilities that would start: {(result.wouldStartResponsibilities ?? []).join(", ") || "None"}</p>
          <p>Emitted effects: {result.effects?.length ?? 0} · Evaluated nodes: {result.trace?.length ?? 0}</p>
          {result.evaluatedDisabledDraft && <p className="text-amber-700">Draft is disabled. Preview evaluated a temporary enabled copy only.</p>}
          <details><summary className="cursor-pointer font-medium">Show evaluated-node trace</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2">{JSON.stringify(result.trace ?? [], null, 2)}</pre>
          </details>
        </div>}
      </div>}
    </section>
  );
}
