"use client";
import {useEffect,useState} from "react";
type Actor={userId:number|null;name:string;count:number;lastAt:string|null};
export default function FieldActivitySummary({recordId}:{recordId:string}) {
  const [data,setData]=useState<{totalEdits:number;byActor:Actor[]}|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;setData(null);setError(null);
    fetch(`/api/platform/field-records/${encodeURIComponent(recordId)}/activity-summary`,{cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||`HTTP ${r.status}`);return d;})
      .then(d=>{if(!cancelled)setData(d);})
      .catch(e=>{if(!cancelled)setError(String(e));});
    return ()=>{cancelled=true;};
  },[recordId]);
  return <section className="rounded-xl border p-3 space-y-2 text-xs">
    <div className="font-semibold uppercase tracking-wide">Site edit activity</div>
    {error&&<div className="text-red-700">{error}</div>}
    {!data&&!error&&<div>Loading activity…</div>}
    {data&&<>
      <div className="text-sm font-semibold">{data.totalEdits} recorded change actions</div>
      <div className="space-y-1">{data.byActor.map((actor,i)=><div key={actor.userId??`unknown-${i}`} className="flex gap-3 justify-between border-t pt-2">
        <span>{actor.name}</span><span className="tabular-nums">{actor.count} {actor.count===1?"change":"changes"}</span>
      </div>)}</div>
      <p className="text-muted-foreground">Counts retained row-level field change events. Imports are audited separately per file; this is not a physical site-visit counter.</p>
    </>}
  </section>;
}
