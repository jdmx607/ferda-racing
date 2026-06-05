export function FerdaLogo({size="large"}) {
  const lg = size==="large";
  const fs = lg ? 52 : 22;
  const sh = lg ? 40 : 16;
  const sw = lg ? 4 : 2;
  const gap = lg ? 3 : 1.5;
  const stripeColors = ["#ffcf00","#ff0000","#ff0000","#0077c8","#0077c8"];
  return (<div style={{display:"inline-flex",alignItems:"center",gap:lg?4:2}}>
    <div style={{display:"flex",gap:gap,transform:"skewX(-12deg)"}}>
      {stripeColors.map((c,i)=>(<div key={i} style={{width:sw,height:sh,background:c,borderRadius:1}}/>))}
    </div>
    <span style={{fontFamily:"'Oswald',sans-serif",fontSize:fs,fontWeight:900,fontStyle:"italic",color:"#ffffff",letterSpacing:lg?4:2,lineHeight:1,transform:"skewX(-6deg)"}}>FERDA</span>
  </div>);
}

export function MemorialBackdrop() {
  return (<div aria-hidden style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <svg viewBox="0 0 200 260" style={{width:"min(70vw,520px)",opacity:0.05}} xmlns="http://www.w3.org/2000/svg">
      <text x="100" y="205" textAnchor="middle" fontFamily="'Oswald',sans-serif" fontSize="240" fontWeight="900" fontStyle="italic"
        fill="none" stroke="#ffffff" strokeWidth="6">8</text>
    </svg>
  </div>);
}
