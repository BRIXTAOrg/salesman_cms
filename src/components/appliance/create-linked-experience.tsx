"use client";
import { useState } from "react";

type Filters={q:string;stage:string;lens:string;assignee:string;verified:boolean;worked:boolean;recent:boolean};
type Preview={count:number;digest:string;examples:string[];note:string;activePjpConflicts:number};
export default function CreateLinkedExperience({sourceListId,filters}:{sourceListId:number;filters:Filters}) {
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("Worked Sites");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function call(mode:"preview"|"create") {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/platform/field-experiences/clone",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sourceListId,filters,title:name,mode,
          ...(mode==="create"?{confirmation:"CREATE MODULE",expectedDigest:preview?.digest}:{})})});
      const result=await response.json();
      if(!response.ok||!result.success) throw new Error(result.error || "Unable to create module.");
      if(mode==="preview")setPreview(result as Preview);
      else window.location.assign(`/dashboard/workspace/app-experiences?entity=${result.moduleId}`);
    }catch(e){setError(e instanceof Error?e.message:"Unable to complete request.");}
    finally{setBusy(false);}
  }
  return <section className="rounded-xl border bg-card p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><div className="font-semibold">Create App Experience from this filter</div>
        <p className="text-xs text-muted-foreground">Separate employee module, same source CRM record IDs and history.</p></div>
      <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        onClick={()=>{setOpen(x=>!x);setPreview(null);setError("");}}>
        {open?"Close":"Create module"}</button>
    </div>
    {open&&<div className="space-y-3 rounded-lg border bg-background p-3">
      <label className="block text-sm font-medium">New module name
        <input className="mt-1 w-full rounded-lg border p-3" value={name}
          maxLength={160} onChange={e=>{setName(e.target.value);setPreview(null);}}/>
      </label>
      <p className="text-xs text-muted-foreground">The preview snapshots exactly the active CMS filters. This operation cannot run without at least one filter. No records are copied, deleted or reassigned.</p>
      <button type="button" onClick={()=>void call("preview")} disabled={busy||!name.trim()}
        className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {busy?"Checking…":"Preview matching records"}</button>
      {preview&&<div className="rounded-lg border bg-card p-3 space-y-2">
        <p className="font-semibold">{preview.count.toLocaleString("en-IN")} matching records</p>
        <p className="text-xs text-muted-foreground">Sample: {preview.examples.join(" · ")}</p>
        <p className="text-xs text-muted-foreground">{preview.note}</p>
        {preview.activePjpConflicts>0&&<p className="text-xs text-red-700">{preview.activePjpConflicts} records belong to active PJP plans. Resolve them before creating this module.</p>}
        <p className="text-xs font-medium">The module starts as a draft. Staff cannot open it until you publish and explicitly grant access.</p>
        <button type="button" disabled={busy||preview.activePjpConflicts>0} onClick={()=>void call("create")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Create draft module</button>
      </div>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>}
  </section>;
}
