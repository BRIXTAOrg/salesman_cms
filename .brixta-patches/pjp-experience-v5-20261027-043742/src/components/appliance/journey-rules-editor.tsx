"use client";

import type { JourneyRules } from "@/lib/field-app-contract";
import { DEFAULT_JOURNEY_RULES } from "@/lib/field-app-contract";

type Choice = { key: string; label: string };
type Props = { value: JourneyRules | undefined; stages: Choice[]; onChange: (next: JourneyRules) => void };
const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** No scripts or arbitrary effects. These controls are validated at publication AND dispatch. */
export default function JourneyRulesEditor({ value, stages, onChange }: Props) {
  const rules = { ...DEFAULT_JOURNEY_RULES, ...(value ?? {}) };
  const change = (patch: Partial<JourneyRules>) => onChange({ ...rules, ...patch });
  return (
    <section className="space-y-4 rounded-[14px] border bg-card p-5" id="journey-pixel-logic">
      <div>
        <h3 className="text-lg font-semibold">Pixel Logic · Journey & Home</h3>
        <p className="mt-1 text-sm text-muted-foreground">The published App Experience controls future PJP planning and mobile Home labels. Existing itineraries, CRM answers, images and verification history remain untouched.</p>
      </div>
      <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium">
        <input type="checkbox" checked={rules.enabled} onChange={(e) => change({ enabled: e.target.checked })} />
        Enforce these journey rules for NEW PJP publications
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs">Mobile Home heading
          <input className={input} maxLength={80} value={rules.homeTitle} onChange={e => change({ homeTitle: e.target.value })} placeholder="Today's journey" />
        </label>
        <label className="space-y-1 text-xs">Task label in Home
          <input className={input} maxLength={40} value={rules.taskLabel} onChange={e => change({ taskLabel: e.target.value })} placeholder="Tasks" />
        </label>
        <label className="space-y-1 text-xs">Work screen PJP task heading
          <input className={input} maxLength={64} value={rules.workTasksTitle} onChange={e => change({ workTasksTitle: e.target.value })} placeholder="Your scheduled tasks" />
        </label>
        <label className="space-y-1 text-xs">Home greeting format
          <select className={input} value={rules.homeGreetingStyle} onChange={e => change({ homeGreetingStyle: e.target.value === "hello" ? "hello" : "time_of_day" })}>
            <option value="time_of_day">Good morning / afternoon / evening + employee name</option>
            <option value="hello">Hello + employee name</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">Prioritize PJP suggestions by
          <select className={input} value={rules.sortMode} onChange={e => change({ sortMode: e.target.value === "priority" ? "priority" : "nearest" })}>
            <option value="nearest">Closest sites first</option><option value="priority">CRM priority first</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">Max CRM site stops / day
          <input className={input} type="number" min="1" max="20" value={rules.maxSiteStops} onChange={e => change({ maxSiteStops: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
        </label>
        <label className="space-y-1 text-xs">Maximum planning radius (km, straight-line)
          <input className={input} type="number" min="1" max="100" value={rules.radiusKm} onChange={e => change({ radiusKm: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />
        </label>
      </div>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-2 text-sm font-semibold">Eligible CRM stages</legend>
        <p className="text-xs text-muted-foreground">Select none to allow any current stage. A published stage rule is enforced by the server when dispatching new plans.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {stages.map(stage => <label key={stage.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rules.allowedStages.includes(stage.key)} onChange={e => change({ allowedStages: e.target.checked ? [...rules.allowedStages, stage.key] : rules.allowedStages.filter(x => x !== stage.key) })} />{stage.label}
          </label>)}
        </div>
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" checked={rules.homeGreetingEnabled} onChange={e => change({ homeGreetingEnabled: e.target.checked })} />Show time-aware greeting and employee name on Home
        </label>
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" checked={rules.workTasksEnabled} onChange={e => change({ workTasksEnabled: e.target.checked })} />Also show published PJP tasks in Work
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rules.homeShowRouteButton} onChange={e => change({ homeShowRouteButton: e.target.checked })} />Show “Open journey map” on employee Home</label>
      <p className="text-xs text-muted-foreground">Save draft → Review impact → Publish App Experience. The rule is not live until publication. Reopening an old PJP does not recalculate or rewrite it.</p>
    </section>
  );
}
