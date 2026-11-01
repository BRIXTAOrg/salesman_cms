"use client";
import { useEffect, useState } from "react";

type Policy = {
  listIds: number[] | null;
  recordScope: "inherit" | "assigned_only" | "all";
  viewOtherHistory: boolean;
  viewPhotos: boolean;
  editOtherSites: boolean;
};
type List = {id:number;title:string};
const initial: Policy = {listIds:null,recordScope:"inherit",viewOtherHistory:true,viewPhotos:true,editOtherSites:false};

export default function EmployeeFieldAccessPanel({employeeId}:{employeeId:number}) {
  const [policy,setPolicy] = useState<Policy>(initial);
  const [lists,setLists] = useState<List[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [message,setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/platform/employee-field-access?employeeId=${employeeId}`,{cache:"no-store"})
      .then(async r => {const body = await r.json();if(!r.ok || !body.success)throw new Error(body.error || `HTTP ${r.status}`);return body;})
      .then(body => {if(!cancelled){setPolicy(body.policy);setLists(body.lists ?? []);setError(null);setLoading(false);}})
      .catch(err => {if(!cancelled){setError(String(err));setLoading(false);}});
    return () => { cancelled = true; };
  },[employeeId]);
  async function save() {
    setSaving(true);setError(null);setMessage("");
    try {
      const r=await fetch("/api/platform/employee-field-access",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({employeeId,policy})});
      const response=await r.json();
      if(!r.ok || !response.success)throw new Error(response.error || `HTTP ${r.status}`);
      setPolicy(response.policy);setMessage("CRM access saved and audited. Reopen the app to refresh access.");
    }catch(err){setError(String(err));}
    finally{setSaving(false);}
  }
  return <section className="rounded-xl border p-4 space-y-4">
    <div><div className="text-sm font-semibold">CRM dataset & site access</div>
      <div className="text-xs text-muted-foreground">Separate from app layout and workflow roles. Applies to the employee's mobile Field API.</div></div>
    {loading?<p className="text-xs">Loading CRM access...</p>:<>
      <label className="block text-xs font-medium">Which CRM lists can this employee open?</label>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={policy.listIds===null}
        onChange={e=>setPolicy(p=>({...p,listIds:e.target.checked?null:[]}))}/> All published Field lists</label>
      {policy.listIds!==null && <div className="max-h-44 overflow-y-auto grid gap-2 p-2 rounded-lg border">
        {lists.map(list=><label key={list.id} className="flex gap-2 items-center text-xs"><input type="checkbox"
          checked={policy.listIds?.includes(list.id)??false}
          onChange={e=>setPolicy(p=>({...p,listIds:e.target.checked?[...(p.listIds??[]),list.id]:(p.listIds??[]).filter(id=>id!==list.id)}))}/>{list.title}</label>)}
        {lists.length===0&&<span className="text-xs text-muted-foreground">No published Field lists.</span>}
      </div>}
      <label className="block text-xs font-medium">Site visibility</label>
      <select className="w-full rounded-lg border p-2 text-sm" value={policy.recordScope}
        onChange={e=>setPolicy(p=>({...p,recordScope:e.target.value as Policy["recordScope"]}))}>
        <option value="inherit">Follow App Experience list scope</option>
        <option value="assigned_only">Only assigned sites and today's scheduled PJP</option>
        <option value="all">All sites in the permitted CRM lists</option>
      </select>
      <div className="space-y-2">
        {([
          ["viewOtherHistory","View other employees' edit history"],
          ["viewPhotos","View saved photo/signature evidence"],
          ["editOtherSites","Edit records belonging to other employees"],
        ] as const).map(([key,label])=><label key={key} className="flex gap-2 items-center text-xs">
          <input type="checkbox" checked={policy[key]} onChange={e=>setPolicy(p=>({...p,[key]:e.target.checked}))}/>{label}
        </label>)}
      </div>
      <p className="text-[11px] text-muted-foreground">Only an ALL_ACCESS administrator can save changes. Access to a scheduled PJP site does not transfer record ownership. A filtered list is not a security boundary: the backend enforces this policy.</p>
      {error&&<p className="text-xs text-red-700" role="alert">{error}</p>}
      {message&&<p className="text-xs text-green-700" role="status">{message}</p>}
      <button type="button" disabled={saving} onClick={()=>void save()} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {saving?"Saving...":"Save CRM access"}
      </button>
    </>}
  </section>;
}
