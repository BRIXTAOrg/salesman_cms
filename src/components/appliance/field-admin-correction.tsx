"use client";
// BRIXTA_SITE_ADMIN_V5 — ALL_ACCESS admin correction form, never a silent bulk overwrite.
import { useState } from "react";

type Editable = {key:string;label:string;type:"text"|"number"|"date"|"boolean";value:string|number|boolean|null};
type Props = {record:{id:string;siteName:string;originalKey:string|null;editVersion:string|null;
  editableFields:Editable[]};onSaved:()=>Promise<void>};

export default function FieldAdminCorrection({record,onSaved}:Props) {
  const [name,setName]=useState(record.siteName || "");
  const [values,setValues]=useState<Record<string,string>>(Object.fromEntries(
    record.editableFields.map(f=>[f.key,f.type==="boolean"
      ? f.value===null?"":f.value===true?"true":"false" : String(f.value??"")])));
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState(false);

  async function save() {
    if (!record.editVersion) {setError("Record has no revision token. Refuel first.");return;}
    const edits:Record<string,string|number|boolean|null>={};
    for(const f of record.editableFields) {
      const next=values[f.key];
      if(f.type==="boolean") {
        const b=next===""?null:next==="true";
        if(b!==f.value) edits[f.key]=b;
      } else {
        const text=String(next??"");
        const original=f.value===null?"":String(f.value);
        if(text===original) continue;
        if(f.type==="number") {
          if(text.trim() && !Number.isFinite(Number(text))) {setError(`Invalid number in ${f.label}`);return;}
          edits[f.key]=text.trim()?Number(text):null;
        } else edits[f.key]=text===""?null:text;
      }
    }
    if(Object.keys(edits).length===0 && name.trim()===record.siteName) {setError("No changes to save.");return;}
    setBusy(true);setError("");
    try {
      const response=await fetch(`/api/platform/field-records/${record.id}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({edits,siteName:name,expectedUpdatedAt:record.editVersion,reason})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||`Save failed (${response.status})`);
      await onSaved();
    } catch(err) {setError(err instanceof Error?err.message:"Could not save correction.");}
    finally{setBusy(false);}
  }
  return <details className="rounded-xl border bg-card p-4" open={editing} onToggle={e=>setEditing(e.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold">Admin · rename or correct site data</summary>
    <p className="mt-2 text-xs text-muted-foreground">Original CRM ID: {record.originalKey||record.id}. Fields are corrected in-place with an exact audit snapshot. Verification, GPS, photos and assignments are protected.</p>
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">Memorable site name
        <input className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" maxLength={100}
          placeholder="e.g. Sharma residence – Beltola" value={name} onChange={e=>setName(e.target.value)} />
      </label>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Correct captured fields ({record.editableFields.length})</summary>
        <div className="mt-3 grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">
        {record.editableFields.map(f=><label className="block text-xs" key={f.key}>
          <span className="font-semibold">{f.label}</span><span className="ml-1 text-muted-foreground">({f.key})</span>
          {f.type==="boolean"?<select className="ml-2 rounded-lg border bg-background px-2 py-1"
            value={values[f.key]??""} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}>
              <option value="">Not answered</option><option value="true">Yes</option><option value="false">No</option>
            </select>:
            <input className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm"
              type={f.type==="number"?"number":f.type==="date"?"date":"text"}
              value={String(values[f.key]??"")} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))} />}
        </label>)}
        </div>
      </details>
      <label className="block text-xs font-semibold">Correction reason · required
        <textarea className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" rows={2}
          minLength={8} maxLength={300} placeholder="Why is this correction necessary?" value={reason} onChange={e=>setReason(e.target.value)} />
      </label>
      {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
      <button type="button" disabled={busy||reason.trim().length<8}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        onClick={()=>void save()}>{busy?"Saving…":"Save audited correction"}</button>
      <p className="text-xs text-muted-foreground">A concurrent employee update rejects this save. Refuel and review differences, then retry.</p>
    </div>
  </details>;
}
