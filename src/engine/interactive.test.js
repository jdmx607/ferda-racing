import { describe, test, expect } from "vitest";
import { simulateMulligan, projectedLine, optimalLineup } from "./whatIf.js";
import { wireRecap } from "./wire.js";
import { sweatSnapshot, diffSweatEvents } from "./sweat.js";
import { getChaseWarRoom, chaseRound, weeklySwings } from "./warRoom.js";
import { addProposal, castVote, removeProposal, tally, emptyBallot } from "./ballot.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});

describe("mulligan what-if", () => {
  test("replacement scores finish + net position only (capped ±10); dropped driver loses everything incl. laps led", () => {
    const dropped = drv("#9 Chase Elliott", 35, { qualPos: 3, lapsLed: 40, dnf: true });
    const replacement = drv("#5 Kyle Larson", 2, { qualPos: 25, lapsLed: 60 });
    const s = simulateMulligan({ dropped, replacement, ty: "road_course" });
    expect(s.mult).toBe(1.5);
    expect(s.lapsLedPts).toBe(60);                      // 40 laps × 1.5 lost with the dropped driver
    expect(s.netRaw).toBe(23);
    expect(s.net).toBe(10);
    expect(s.netCapped).toBe(true);
    expect(s.repPts).toBe(35 + 10);                      // P2 = 35, net capped +10, no laps-led credit
    expect(s.delta).toBeCloseTo(s.repPts - s.dropPts, 6);
  });
  test("projectedLine overrides a raw line with manual numbers", () => {
    const l = projectedLine("#1 X", drv("#1 X", 20, { lapsLed: 3 }), { finish: 4, lapsLed: 0 });
    expect(l).toMatchObject({ finish: 4, qualPos: 20, lapsLed: 0 });
    expect(projectedLine("#2 Y", null, { finish: 8, qualPos: 12 })).toMatchObject({ name: "#2 Y", finish: 8, qualPos: 12, dnf: false });
  });
});

describe("optimal 5 ghost", () => {
  // W5 (intermediate). Order rich, monroe, bigmonroe, justin every round; 20 drivers ranked by finish.
  const ORDER = ["rich", "monroe", "bigmonroe", "justin"];
  const names = Array.from({ length: 24 }, (_, i) => `#${i + 1} D${i + 1}`);
  const raw = { drivers: names.map((n, i) => drv(n, i + 1)) };              // #1 finishes P1 … best first
  // everyone drafts badly: pick k takes driver #(25-k) … so the best drivers are left undrafted
  const log = Array.from({ length: 20 }, (_, i) => ({ pid: ORDER[i % 4], driver: names[23 - i], pickNum: i }));
  const data = { results: { w5: { raw, scored: { justin: { total: 1 }, rich: { total: 1 }, monroe: { total: 1 }, bigmonroe: { total: 1 } } } }, drafts: { w5: log }, picks: {} };

  test("takes the best driver still on the board at each real slot", () => {
    const o = optimalLineup(data, 5, "rich");                                // rich picks 1, 5, 9, 13, 17
    expect(o.picks.map(p => p.k)).toEqual([1, 5, 9, 13, 17]);
    expect(o.picks.map(p => p.driver)).toEqual(["#1 D1", "#2 D2", "#3 D3", "#4 D4", "#5 D5"]);
    expect(o.left).toBeCloseTo(o.total - o.actual, 6);
    expect(o.left).toBeGreaterThan(0);
  });
  test("drivers taken earlier by others are off the board", () => {
    const d2 = { ...data, drafts: { w5: log.map((x, i) => (i === 0 ? { ...x, driver: "#2 D2" } : x)) } };  // rich takes D2 at #1
    const o = optimalLineup(d2, 5, "monroe");                                // monroe picks at #2
    expect(o.picks[0].driver).toBe("#1 D1");                                 // D1 still there; D2 gone
    expect(o.picks.map(p => p.driver)).not.toContain("#2 D2");
  });
  test("no raw results → null", () => {
    expect(optimalLineup({ results: {} }, 5, "rich")).toBeNull();
  });
});

describe("wire recap", () => {
  const raw = { drivers: [drv("#24 William Byron", 1, { lapsLed: 200, mostLapsLed: true }), drv("#9 Chase Elliott", 2), drv("#5 Kyle Larson", 3)] };
  const scored = {
    monroe:    { total: 246.6, weeklyWin: true, drivers: [{ driver: "#24 William Byron", total: 172.9 }] },
    justin:    { total: 173.3, drivers: [] },
    rich:      { total: 150.1, drivers: [] },
    bigmonroe: { total: 112,   drivers: [] },
  };
  test("three sentences: winner + margin, top driver, fourth place", () => {
    const s = wireRecap(35, scored, raw);
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("MARTINSVILLE (FRL) — Monroe won the Xfinity 500 week with 246.6 points, routing Justin by 73.3.");
    expect(s[1]).toMatch(/^#24 Byron led all drivers with .* FERDA points for Monroe\.$/);
    expect(s[2]).toBe("Big Monroe finished fourth with 112.0.");
  });
  test("close weeks are 'edged'; unowned MVPs are called out", () => {
    const close = { ...scored, justin: { total: 245, drivers: [] }, monroe: { ...scored.monroe, drivers: [] } };
    const s = wireRecap(35, close, raw);
    expect(s[0]).toContain("edging Justin by 1.6");
    expect(s[1]).toContain("nobody had him");
  });
  test("not enough data → empty", () => { expect(wireRecap(35, {}, raw)).toEqual([]); });
});

describe("sweat alerts", () => {
  const order = ["rich", "monroe", "bigmonroe", "justin"];
  const base = { results: { w34: { scored: { rich: { total: 1 }, monroe: { total: 2 }, bigmonroe: { total: 3 }, justin: { total: 4 } } } } };
  const draft = n => ({ ...base, drafts: { w35: order.slice(0, n).map((pid, i) => ({ pid, driver: `#${i + 1} X`, pickNum: i })) },
    picks: { w35: { justin: [{ driver: "#11 Denny Hamlin" }], rich: [{ driver: "#12 Ryan Blaney" }] } } });
  test("you're on the clock when the manager ahead of you picks", () => {
    const a = sweatSnapshot({ data: draft(2), week: 35 });
    const b = sweatSnapshot({ data: draft(3), week: 35 });
    expect(b.onClock).toBe("justin");
    expect(diffSweatEvents(a, b, { me: "justin" })).toEqual([expect.objectContaining({ kind: "draft", title: "You're On The Clock!", body: "Pick 4 of 20 · Round 1" })]);
    expect(diffSweatEvents(a, b, { me: "rich" })).toEqual([]);
  });
  test("owned stage winners, owned DNFs and the 10-to-go gap; nothing on the first snapshot", () => {
    const d = draft(20);
    const live = (extra) => ({ data: d, week: 35, liveWeek: 35, liveScores: { justin: { total: 120 }, rich: { total: 100 }, monroe: { total: 80 }, bigmonroe: { total: 60 } }, ...extra });
    const s0 = sweatSnapshot(live({ raceInfo: { raw: { drivers: [drv("#11 Denny Hamlin", 3), drv("#12 Ryan Blaney", 1), drv("#5 Kyle Larson", 2)] } }, timing: { lapsInRace: 500, lapNumber: 100 } }));
    const s1 = sweatSnapshot(live({ raceInfo: { raw: { drivers: [
      drv("#11 Denny Hamlin", 3, { stageWin1: true }), drv("#12 Ryan Blaney", 40, { dnf: true }), drv("#5 Kyle Larson", 2, { stageWin2: true }),
    ] } }, timing: { lapsInRace: 500, lapNumber: 492 } }));
    expect(diffSweatEvents(null, s1, { me: "justin" })).toEqual([]);
    const ev = diffSweatEvents(s0, s1, { me: "justin" });
    expect(ev.map(e => e.kind)).toEqual(["stage", "dnf", "ten"]);           // Larson's stage 2 isn't owned
    expect(ev[0]).toMatchObject({ title: "Stage 1 winner: #11 Hamlin", body: "Justin banks +10 stage pts +2.5 bonus" });
    expect(ev[1]).toMatchObject({ title: "Garage alert: #12 Blaney is out", body: "DNF for Rich" });
    expect(ev[2]).toMatchObject({ title: "8 to go", body: "Justin leads Rich by 20.0 pts" });
    expect(diffSweatEvents(s1, s1, { me: "justin" })).toEqual([]);           // no repeats
  });
});

describe("chase war room", () => {
  const P = ["justin", "rich", "monroe", "bigmonroe"];
  const week = (tot) => ({ scored: Object.fromEntries(P.map((p, i) => [p, { total: tot[i] }])) });
  // regular season W1–26 swings: max gap 100, avg winning margin 10
  const results = {};
  for (let w = 1; w <= 26; w++) results["w" + w] = week([200, 190, 150, 100]);
  test("round labels", () => {
    expect(chaseRound(27).label).toBe("Round of 16");
    expect(chaseRound(33).label).toBe("Round of 8");
    expect(chaseRound(36).label).toBe("Championship 4");
    expect(chaseRound(20)).toBeNull();
  });
  test("swing stats", () => { expect(weeklySwings({ results })).toEqual({ maxSwing: 100, avgMargin: 10 }); });
  test("statuses from the gap, races left and weekly swing", () => {
    const meta = { playoffPts: {}, standings: {}, chasePts: { justin: 700, rich: 640, monroe: 300, bigmonroe: 0 } };
    const data = { results: { ...results, w27: week([1, 1, 1, 1]), w28: week([1, 1, 1, 1]) }, meta };   // 8 Chase races left
    const wr = getChaseWarRoom(data);
    expect(wr.remaining).toBe(8);
    expect(wr.round.label).toBe("Round of 16");                               // next up: W29
    const by = Object.fromEntries(wr.rows.map(r => [r.pid, r]));
    expect(by.justin).toMatchObject({ status: "SAFE", cut: 60 });
    expect(by.rich).toMatchObject({ status: "IN THE HUNT", cut: -60, needPerRace: 7.5 });    // 7.5/race < 10 avg margin
    expect(by.monroe).toMatchObject({ status: "MUST-WIN", cut: -400 });                       // 50/race > 10
    expect(by.bigmonroe.status).toBe("MUST-WIN");                                               // 700 < 8 × 100 reach
    const late = getChaseWarRoom({ ...data, meta: { ...meta, chasePts: { justin: 2000, rich: 0, monroe: 0, bigmonroe: 0 } } });
    expect(late.rows[0].status).toBe("LOCKED IN");                             // 2000 lead > 800 reach
    expect(late.rows[1].status).toBe("ELIMINATED");
  });
  test("season over → champion / final", () => {
    const all = { ...results };
    for (let w = 27; w <= 36; w++) all["w" + w] = week([1, 1, 1, 1]);
    const wr = getChaseWarRoom({ results: all, meta: { playoffPts: {}, standings: {}, chasePts: { justin: 10 } } });
    expect(wr.remaining).toBe(0);
    expect(wr.rows[0].status).toBe("CHAMPION");
    expect(wr.rows[1].status).toBe("FINAL");
  });
});

describe("rulebook ballot", () => {
  let b = emptyBallot(2027);
  b = addProposal(b, { by: "justin", text: "  Road course multiplier ×2.0  ", category: "Track multipliers", now: 1 });
  const id = b.proposals[0].id;
  test("proposal auto-approves its author", () => {
    expect(b.proposals[0]).toMatchObject({ by: "justin", text: "Road course multiplier ×2.0", votes: { justin: "approve" } });
    expect(addProposal(b, { by: "rich", text: "   " })).toBe(b);
  });
  test("3 approvals pass, 2 vetoes kill, re-voting the same way clears it", () => {
    let x = castVote(castVote(b, id, "rich", "approve"), id, "monroe", "approve");
    expect(tally(x.proposals[0])).toMatchObject({ approve: 3, veto: 0, pending: 1, status: "approved" });
    let y = castVote(castVote(b, id, "rich", "veto"), id, "monroe", "veto");
    expect(tally(y.proposals[0]).status).toBe("vetoed");
    y = castVote(y, id, "monroe", "veto");
    expect(tally(y.proposals[0])).toMatchObject({ veto: 1, status: "open" });
  });
  test("only the author or the commissioner can remove", () => {
    expect(removeProposal(b, id, "rich").proposals).toHaveLength(1);
    expect(removeProposal(b, id, "justin").proposals).toHaveLength(0);
    expect(removeProposal(b, id, "rich", true).proposals).toHaveLength(0);
  });
});
