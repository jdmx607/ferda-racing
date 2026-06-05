import { C } from "../theme";

export function RulesTab() {
  const rules=[
    {t:"Draft System",c:"Draft each week. Last week's loser picks first, winner picks last. Same order all 5 rounds."},
    {t:"Finish Points",c:"P1: 55, P2: 35, then P3: 34 decreasing by 1 to P36: 1. P37-40: 1 each."},
    {t:"Top Finish Bonus",c:"Top 5 finish: +2 bonus pts. Top 10 finish: +1 bonus pt."},
    {t:"Stage Points",c:"Top 10 each stage: 1st=10, 2nd=9... 10th=1. The Coca-Cola 600 has 3 stages."},
    {t:"Laps Led",c:"Per lap led x track modifier: SS x1.0, INT x0.5, ST x0.2, RC x1.5"},
    {t:"Net Position",c:"+/-1 pt per spot gained/lost (qualifying to finish). Capped at +/-10."},
    {t:"Bonuses",c:"Pole: 5 | Stage Win: 2.5 each | Fastest Lap: 1 | Most Laps Led: 5 | Led a Lap: 0.5/driver | Sweep (Pole + all stage wins): 12.5"},
    {t:"DNF / DQ",c:"DNF drivers score normally — finish position, net position, and any stage points earned still apply. DQ = -5 points total."},
    {t:"Weekly Win",c:"Highest scorer earns 25 playoff points. Tiebreak: had the race winner, then highest single-driver score."},
    {t:"Playoffs (W27+)",c:"Reset to 1,000 base. Weekly wins (x25) + bonus pts carry over. Regular season leader earns +50 bonus pts entering the Chase."},
    {t:"Mulligans",c:"10/season. Replacement driver earns finish position points ONLY."},
  ];
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:16}}>Scoring Rules</h2>
    {rules.map(r=>(<div key={r.t} style={{background:C.card,borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid "+C.border}}>
      <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{r.t}</div>
      <div style={{color:C.dim,fontSize:13,lineHeight:1.5}}>{r.c}</div>
    </div>))}
  </div>);
}
