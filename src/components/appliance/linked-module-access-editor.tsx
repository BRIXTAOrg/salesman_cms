"use client";
import { useEffect, useMemo, useState } from "react";

type Person={id:number;name:string};
type Payload={success:boolean;title:string;moduleId:number;employeeIds:number[];employees:Person[];error?:string};

export default function LinkedModuleAccessEditor({moduleId}:{moduleId:number}) {
  const [people,setPeople]=useState<Person[]>([]);
  const [allowed,setAllowed]=useState<number[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  useEffect(()=>{
    let active=true;setLoading(true);setError("");setMessage("");setSearch("");
    fetch(`/api/platform/field-experiences/${moduleId}/access`,{cache:"no-store"})
      .then(async r=>{const b=await r.json() as Payload;if(!r.ok||!b.success)throw new Error(b.error||`HTTP ${r.status}`);return b;})
      .then(b=>{if(active){setPeople(b.employees);setAllowed(b.employeeIds);setLoading(false);}})
      .catch(e=>{if(active){setError(String(e));setLoading(false);}});
    return ()=>{active=false;};
  },[moduleId]);
  const filtered=useMemo(()=>people.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())),[people,search]);
  async function save(){setSaving(true);setMessage("");setError("");try{
    const r=await fetch(`/api/platform/field-experiences/${moduleId}/access`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeIds:allowed})});
    const b=await r.json() as Payload;if(!r.ok||!b.success)throw new Error(b.error||`HTTP ${r.status}`);
    setAllowed(b.employeeIds);setMessage("Saved. Selected employees can now see this module after it is published and their Field app refreshes.");
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}}
  return <section className="rounded-xl border bg-card p-5 space-y-3">
    <div><h2 className="text-base font-semibold">Who can open this App Experience?</h2>
      <p className="text-sm text-muted-foreground">Select employees who can see this module in FIELD. Nobody gets access automatically. This does not reassign sites, edit CRM data, or reset progress.</p></div>
    {loading?<p className="text-sm">Loading employees…</p>:<>
      <div className="flex items-center gap-3"><input aria-label="Find employee" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Find employee…" className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" />
        <span className="whitespace-nowrap text-sm text-muted-foreground">{allowed.length} selected</span></div>
      <div className="max-h-56 overflow-y-auto grid gap-1 sm:grid-cols-2">
        {filtered.map(p=><label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" checked={allowed.includes(p.id)} onChange={e=>setAllowed(current=>e.target.checked
            ? [...new Set([...current,p.id])].sort((a,b)=>a-b) : current.filter(id=>id!==p.id))}/>
          <span className="truncate">{p.name}</span><span className="ml-auto text-xs text-muted-foreground">#{p.id}</span>
        </label>)}
        {!filtered.length&&<p className="text-sm text-muted-foreground">No matching active field employees.</p>}
      </div>
      <button type="button" onClick={()=>void save()} disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving?"Saving access…":"Save module access"}</button>
    </>}
    {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
