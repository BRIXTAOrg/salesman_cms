"use client";
import { useEffect, useState } from "react";

type Profile = {displayName:string;companyCode:string;logoDataUrl:string|null};

export default function CompanyProfileSettings() {
  const [profile,setProfile] = useState<Profile>({displayName:"",companyCode:"",logoDataUrl:null});
  const [canEdit,setCanEdit] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [codeReady,setCodeReady] = useState(false);
  const [codeStatus,setCodeStatus] = useState("");
  async function checkCode() {
    setCodeStatus("Checking…");
    try {
      const code = profile.companyCode.trim().toLowerCase();
      const response = await fetch(`/api/platform/company-profile?checkCode=${encodeURIComponent(code)}`,{cache:"no-store"});
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Could not check code.");
      setCodeStatus(!body.codeReady ? "Code editing requires the registry migration." : body.available ? "Available" : "Already taken");
    } catch (error) {setCodeStatus(error instanceof Error?error.message:"Check failed");}
  }
  useEffect(() => { let cancelled=false;
    fetch("/api/platform/company-profile",{cache:"no-store"}).then(r=>r.json()).then(body=>{
      if(!cancelled && body.success){setProfile(body.profile);setCanEdit(body.canEdit===true);setCodeReady(body.codeReady===true);}
    }).catch(()=>{if(!cancelled)setMessage("Could not load company identity.");});
    return ()=>{cancelled=true};
  },[]);
  async function choose(file: File | undefined) {
    if(!file)return;
    setMessage("");
    if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 10*1024*1024) {
      setMessage("Choose a PNG, JPG or WebP image under 10 MB.");return;
    }
    try {
      const bitmap=await createImageBitmap(file);
      const canvas=document.createElement("canvas");
      const scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext("2d");
      if(!ctx)throw Error("Image canvas unavailable.");
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      const data=canvas.toDataURL("image/webp",0.78);
      if(data.length>250000)throw Error("Logo is still too large; choose a simpler image.");
      setProfile(p=>({...p,logoDataUrl:data}));
    }catch(error){setMessage(error instanceof Error?error.message:"Could not process this logo.");}
  }
  async function save() {
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/platform/company-profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(profile)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"Could not save company settings.");
      setProfile(data.profile);
      setMessage("Saved. The CMS and authenticated employee app will use this company identity.");
      window.dispatchEvent(new Event("brixta-company-brand-updated"));
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed.");}
    finally{setBusy(false);}
  }
  return <section className="rounded-xl border bg-white p-5 space-y-4">
    <div><h2 className="text-lg font-semibold">Company identity</h2>
      <p className="text-sm text-muted-foreground">Change your company name, sign-in code and logo. Your company database and employee IDs stay unchanged.</p></div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border bg-muted/30 text-2xl font-bold overflow-hidden">
        {profile.logoDataUrl?<img src={profile.logoDataUrl} alt="Company logo preview" className="w-full h-full object-contain" />:(profile.displayName?.charAt(0)||"B")}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <label htmlFor="brixta-brand-name" className="text-sm font-semibold">Company display name</label>
        <input id="brixta-brand-name" className="w-full rounded-lg border px-3 py-2 text-sm" maxLength={100} value={profile.displayName}
          disabled={!canEdit||busy} onChange={e=>setProfile(p=>({...p,displayName:e.target.value}))} />
        <div className="space-y-1">
          <label htmlFor="brixta-company-code" className="text-sm font-semibold">Company login code</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="brixta-company-code" className="min-w-[180px] flex-1 rounded-lg border px-3 py-2 text-sm font-mono"
              maxLength={63} value={profile.companyCode} disabled={!canEdit||busy||!codeReady}
              onChange={e=>{setCodeStatus("");setProfile(p=>({...p,companyCode:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")}));}} />
            {canEdit&&codeReady&&<button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void checkCode()} disabled={busy}>Check availability</button>}
          </div>
          <p className="text-xs text-muted-foreground">Used for CMS and employee app login; the internal company database is never renamed.</p>
          {!codeReady&&<p className="text-xs text-amber-700">Code editing is disabled until the additive database migration is applied. Existing login still works.</p>}
          {codeStatus&&<p role="status" className="text-xs">{codeStatus}</p>}
        </div>
        {canEdit&&<div className="flex flex-wrap gap-2 items-center">
          <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Upload logo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>void choose(e.target.files?.[0])}/>
          </label>
          {profile.logoDataUrl&&<button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setProfile(p=>({...p,logoDataUrl:null}))}>Remove logo</button>}
        </div>}
      </div>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground" role="status">{message||(!canEdit?"Only company administrators can change branding.":"")}</span>
      {canEdit&&<button type="button" disabled={busy||!profile.displayName.trim()||!profile.companyCode.trim()} onClick={()=>void save()}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{busy?"Saving…":"Save company identity"}</button>}
    </div>
  </section>;
}
