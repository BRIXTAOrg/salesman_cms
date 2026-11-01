"use client";
// BRIXTA_MAIN_EXPERIENCE_EMPLOYEE_ACCESS_V1_20261102
import { useEffect, useMemo, useState } from "react";

type Person = { id: number; name: string };
type AccessMode = "legacy" | "selected";
type Payload = {
  success: boolean;
  title: string;
  moduleId: number;
  linked: boolean;
  accessMode: AccessMode;
  employeeIds: number[];
  employees: Person[];
  error?: string;
};

export default function LinkedModuleAccessEditor({ moduleId }: { moduleId: number }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [allowed, setAllowed] = useState<number[]>([]);
  const [linked, setLinked] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>("selected");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(""); setMessage(""); setSearch("");
    fetch(`/api/platform/field-experiences/${moduleId}/access`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json() as Payload;
        if (!r.ok || !body.success) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        if (!active) return;
        setPeople(body.employees);
        setAllowed(body.employeeIds);
        setLinked(body.linked);
        setAccessMode(body.accessMode);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => { active = false; };
  }, [moduleId]);

  const filtered = useMemo(() =>
    people.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [people, search]);

  async function save() {
    if (accessMode === "selected" && allowed.length === 0 &&
        !window.confirm("This will hide this App Experience from every FIELD employee. Save anyway?")) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const r = await fetch(`/api/platform/field-experiences/${moduleId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: allowed, accessMode }),
      });
      const body = await r.json() as Payload;
      if (!r.ok || !body.success) throw new Error(body.error || `HTTP ${r.status}`);
      setAllowed(body.employeeIds);
      setMessage(accessMode === "legacy"
        ? "Saved. Existing employee dataset permissions remain in effect."
        : "Saved. Only the selected active FIELD employees may open this App Experience. Refresh their FIELD app.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  return <section className="rounded-xl border bg-card p-5 space-y-3">
    <div>
      <h2 className="text-base font-semibold">Who can open this App Experience?</h2>
      <p className="text-sm text-muted-foreground">
        This controls FIELD module visibility. It does not reassign CRM sites, change saved answers,
        reset progress or grant permission to edit another employee's assigned site.
      </p>
    </div>
    {loading ? <p className="text-sm">Loading employees…</p> : <>
      {!linked && <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Main experience access</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name={`main-access-${moduleId}`} checked={accessMode === "legacy"}
            onChange={() => setAccessMode("legacy")} />
          <span><strong>Keep existing employee access</strong><span className="block text-xs text-muted-foreground">
            Preserve current dataset permissions, including employees with access to all original CRM datasets.
          </span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name={`main-access-${moduleId}`} checked={accessMode === "selected"}
            onChange={() => setAccessMode("selected")} />
          <span><strong>Selected employees only</strong><span className="block text-xs text-muted-foreground">
            The checked roster becomes authoritative for opening this Main experience.
          </span></span>
        </label>
      </fieldset>}
      {linked && <p className="text-xs text-muted-foreground">
        Linked experiences always use explicit employee access; no automatic grants.
      </p>}
      <div className="flex items-center gap-3">
        <input aria-label="Find employee" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Find employee…" className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {accessMode === "legacy" ? "Existing access" : `${allowed.length} selected`}
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto grid gap-1 sm:grid-cols-2">
        {filtered.map((p) => <label key={p.id}
          className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" disabled={accessMode === "legacy"}
            checked={allowed.includes(p.id)}
            onChange={(e) => setAllowed((current) => e.target.checked
              ? [...new Set([...current, p.id])].sort((a, b) => a - b)
              : current.filter((id) => id !== p.id))} />
          <span className="truncate">{p.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">#{p.id}</span>
        </label>)}
        {!filtered.length && <p className="text-sm text-muted-foreground">No matching active FIELD employees.</p>}
      </div>
      {accessMode === "selected" && allowed.length === 0 && <p className="text-xs text-amber-700">
        Nobody is selected. Saving will deny access to all FIELD employees for this experience.
      </p>}
      <button type="button" onClick={() => void save()} disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving ? "Saving access…" : "Save module access"}
      </button>
    </>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
