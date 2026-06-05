import { useState } from "react";
import { C } from "../theme";
import { DEFAULT_EMAILS } from "../email";

export function SettingsTab({player,data,onSaveSettings}) {
  const settings=data.playerSettings?.[player.id]||{};
  const [email,setEmail]=useState(settings.email||"");
  const [notifyOnTurn,setNotifyOnTurn]=useState(settings.notifyOnTurn!==false);
  const [saving,setSaving]=useState(false); const [msg,setMsg]=useState("");
  const defaultEmail=DEFAULT_EMAILS[player.id];
  const save=async()=>{setSaving(true);setMsg("");await onSaveSettings(player.id,{email:email.trim(),notifyOnTurn});setMsg("Settings saved!");setSaving(false);setTimeout(()=>setMsg(""),3000);};
  return (<div style={{padding:20,maxWidth:600,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Notification Settings</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:24}}>Get an email when it's your turn to draft</div>
    <div style={{background:C.card,borderRadius:12,padding:20,border:"1px solid "+C.border,marginBottom:16}}>
      <div style={{color:C.accent,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontWeight:700}}>Email Address</div>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={defaultEmail||"you@example.com"} style={{width:"100%",padding:"12px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      <div style={{color:C.dim,fontSize:11,marginTop:6}}>{defaultEmail?<>Default: <span style={{color:C.green}}>{defaultEmail}</span> (leave blank to use)</>:"Where draft notifications will be sent"}</div>
    </div>
    <div style={{background:C.card,borderRadius:12,padding:20,border:"1px solid "+C.border,marginBottom:16}}>
      <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}><input type="checkbox" checked={notifyOnTurn} onChange={e=>setNotifyOnTurn(e.target.checked)} style={{width:18,height:18,cursor:"pointer"}}/><div><div style={{color:C.text,fontSize:15,fontWeight:600}}>Notify me when it's my turn</div><div style={{color:C.dim,fontSize:12,marginTop:2}}>Only fires when you're up next on the clock</div></div></label>
    </div>
    <button onClick={save} disabled={saving} style={{width:"100%",padding:"14px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Saving...":"Save Settings"}</button>
    {msg&&<div style={{color:C.green,marginTop:12,textAlign:"center",fontSize:14,fontWeight:600}}>{msg}</div>}
  </div>);
}
