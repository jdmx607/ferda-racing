// ─── Achievements & Records (pure) ───────────────────────────────────────────
// Every badge is DERIVED from stored data — the season's results / picks /
// mulligans, CAREER_STATS and CHAMPION_HISTORY — so nothing here can drift from
// the rest of the app. Nothing is written back.
//
// Badge shape:
//   { id, cat, emoji, title, condition, tracked,
//     holders: [{ pid, count, lines:[…] }],   // unlocked by these managers
//     facts:   [string],                       // extra context for the detail sheet
//     counter: { [pid]: n } | null,            // running tallies (Poop Trophy Counter)
//     star:    { label, pids:[…] } | null,     // bonus distinction (PERFECT PIT BOX)
//     archive: [{ text, pid? }] }              // hidden archive notes (lore)

import { PLAYERS, PNAME, SCHEDULE, ACTIVE_SEASON } from "../constants.js";
import { calcDriverScore } from "./scoring.js";
import { getSeasonRecords } from "./stats.js";
import { scoredWeekList } from "./statsView.js";
import { getOverallRuns } from "./champions.js";
import { scoreGmWeek } from "../utils/gmRating.js";
import { CAREER_STATS, RECORD_BOOK } from "../careerStats.js";
import { CHAMPION_HISTORY } from "../championsHistory.js";

const r1 = n => Math.round(n * 10) / 10;
const ri = w => SCHEDULE.find(s => s.w === w) || null;
const tyOf = w => ri(w)?.ty || "intermediate";
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;
const sameCar = (a, b) => !!a && !!b && (a === b || (carOf(a) && carOf(a) === carOf(b)));
const wk = w => `W${w} ${ri(w)?.r || ""}`.trim();

export const CATEGORIES = [
  { id: "race",   label: "Race & Strategy" },
  { id: "roast",  label: "Garage Roasts" },
  { id: "career", label: "Career Milestones" },
];

function findRaw(drivers, name) {
  return drivers.find(d => d.name === name) || drivers.find(d => sameCar(d.name, name)) || null;
}

/** Placement order for a week: weeklyWin flag first, then total. */
function placed(scored) {
  return Object.entries(scored || {}).sort((a, b) =>
    (b[1].weeklyWin ? 1 : 0) - (a[1].weeklyWin ? 1 : 0) || (b[1].total || 0) - (a[1].total || 0));
}

/** A manager's raced lineup for a week: [{ name, total, raw, breakdown }] (did-not-race dropped). */
function lineup(wr, pid) {
  return (wr.scored?.[pid]?.drivers || []).filter(d => !d.dnr)
    .map(d => ({ name: d.driver, total: d.total || 0, breakdown: d.breakdown || [], raw: findRaw(wr.raw.drivers, d.driver) }));
}

/** Collect per-manager hits into holders [{ pid, count, lines }], most first. */
function holdersFrom(hits) {
  const by = {};
  hits.forEach(h => {
    const x = by[h.pid] || (by[h.pid] = { pid: h.pid, count: 0, lines: [] });
    x.count++; if (h.line) x.lines.push(h.line);
  });
  return Object.values(by).sort((a, b) => b.count - a.count);
}

const badge = (o) => ({ tracked: true, holders: [], facts: [], counter: null, star: null, archive: [], ...o });

// ── Category A — Race & Strategy ─────────────────────────────────────────────
function raceBadges(data, weeks) {
  // Crown Jewel Sweeper — win the week at all three crown jewels in one season
  const jewels = [
    { label: "Daytona 500",  re: /daytona 500/i },
    { label: "Coca-Cola 600", re: /coca-cola 600/i },
    { label: "Southern 500", re: /southern 500/i },
  ].map(j => {
    const w = SCHEDULE.find(s => j.re.test(s.r))?.w;
    const wr = w != null ? data?.results?.["w" + w] : null;
    return { ...j, w, winner: wr?.scored ? placed(wr.scored)[0]?.[0] : null };
  });
  const jewelWinners = jewels.map(j => j.winner);
  const crown = jewelWinners.every(Boolean) && new Set(jewelWinners).size === 1
    ? [{ pid: jewelWinners[0], count: 1, lines: jewels.map(j => `${j.label} · W${j.w}`) }] : [];

  // Weekend Sweep — drafted the pole winner, S1 + S2 winners and the race winner
  const sweepHits = [];
  // Top Dog + Perfect Pit Box
  const topHits = [], perfect = new Set(), perfectLines = [];
  // Big One Survivor
  const survHits = [];
  // Photo finish
  const photoHits = [];
  // Fastest lap tally
  const fl = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  // Late-round heist
  const heistHits = [];

  weeks.forEach(({ w, wr }) => {
    const drivers = wr.raw.drivers;
    const pole = drivers.find(d => d.pole)?.name;
    const s1 = drivers.find(d => d.stageWin1)?.name;
    const s2 = drivers.find(d => d.stageWin2)?.name;
    const win = drivers.find(d => d.finish === 1)?.name;
    const ty = tyOf(w);
    const three = !!wr.raw.threeStages;
    const top5 = drivers.map(d => ({ name: d.name, pts: calcDriverScore(d, ty, false, three).total }))
      .sort((a, b) => b.pts - a.pts).slice(0, 5).map(d => d.name);
    const order = placed(wr.scored);

    const dnfsOf = {};
    PLAYERS.forEach(p => {
      const L = lineup(wr, p.id);
      if (!L.length) return;
      const has = n => L.some(d => sameCar(d.name, n));
      if (pole && s1 && s2 && win && has(pole) && has(s1) && has(s2) && has(win)) {
        sweepHits.push({ pid: p.id, line: `${wk(w)}` });
      }
      dnfsOf[p.id] = L.filter(d => d.raw?.dnf).length;
      L.forEach(d => { fl[p.id] += d.breakdown.filter(b => b.label === "Fast Lap").length; });
    });

    const [first, second] = order;
    if (first) {
      topHits.push({ pid: first[0], line: `${wk(w)} · ${r1(first[1].total)} pts` });
      const L = lineup(wr, first[0]);
      if (L.length === 5 && top5.every(n => L.some(d => sameCar(d.name, n)))) {
        perfect.add(first[0]); perfectLines.push(`${PNAME[first[0]]} — ${wk(w)}`);
      }
    }
    if (first && second) {
      const margin = r1((first[1].total || 0) - (second[1].total || 0));
      if (margin < 3) photoHits.push({ pid: first[0], line: margin === 0
        ? `${wk(w)} · tied ${PNAME[second[0]]}, won on the tiebreak`
        : `${wk(w)} · won by ${margin.toFixed(1)} over ${PNAME[second[0]]}` });
    }

    const t = ri(w)?.t || "";
    if (/daytona|talladega/i.test(t)) {
      Object.entries(dnfsOf).forEach(([pid, n]) => {
        const othersWrecked = Object.entries(dnfsOf).filter(([o, m]) => o !== pid && m > 0).length;
        if (n === 0 && othersWrecked >= 2) survHits.push({ pid, line: `${wk(w)} · clean while ${othersWrecked} others wrecked` });
      });
    }

    const gw = scoreGmWeek(data, w);
    if (gw) PLAYERS.forEach(p => {
      const mine = gw.picks.filter(x => x.pid === p.id);
      const r1p = mine.find(x => x.round === 1), r5p = mine.find(x => x.round === 5);
      if (!r1p || !r5p || r5p.dnr) return;
      if ((r5p.finish && r5p.finish <= 3) || r5p.pts > r1p.pts) {
        heistHits.push({ pid: p.id, line: `${wk(w)} · ${r5p.driver} (Pick #${r5p.k}) ${r5p.finish ? `P${r5p.finish}` : ""} · ${r1(r5p.pts)} vs R1 ${r1(r1p.pts)}` });
      }
    });
  });

  const flMax = Math.max(0, ...Object.values(fl));
  const flKings = flMax > 0 ? PLAYERS.filter(p => fl[p.id] === flMax).map(p => ({ pid: p.id, count: flMax, lines: [`${flMax} Fastest Lap bonuses`] })) : [];

  // Master of the Mulligan — DNF / negative driver swapped for a top-5 finisher
  const mullHits = mulliganSwaps(data).filter(m => (m.origDnf || m.origPts < 0) && m.repFinish && m.repFinish <= 5)
    .map(m => ({ pid: m.pid, line: `${wk(m.week)} · ${m.orig} → ${m.rep} (P${m.repFinish}) · ${m.swing > 0 ? "+" : ""}${m.swing} swing` }));

  return [
    badge({ id: "crown-jewel", cat: "race", emoji: "🏁", title: "Crown Jewel Sweeper",
      condition: "Win the week at the Daytona 500, Coca-Cola 600 and Southern 500 in the same season.",
      holders: crown,
      facts: jewels.map(j => `${j.label}: ${j.winner ? PNAME[j.winner] : "not run yet"}`) }),
    badge({ id: "weekend-sweep", cat: "race", emoji: "🧹", title: "The Weekend Sweep",
      condition: "Draft the Pole winner, Stage 1 winner, Stage 2 winner and Race winner in the same week.",
      holders: holdersFrom(sweepHits) }),
    badge({ id: "top-dog", cat: "race", emoji: "🐕", title: "Top Dog",
      condition: "Assemble the week's highest-scoring 5-driver lineup. Gold PERFECT PIT BOX star for drafting the exact top 5 scorers.",
      holders: holdersFrom(topHits),
      star: { label: "PERFECT PIT BOX", pids: [...perfect] },
      facts: perfectLines.length ? perfectLines.map(l => `⭐ Perfect Pit Box: ${l}`) : ["No Perfect Pit Box yet this season."] }),
    badge({ id: "late-heist", cat: "race", emoji: "💎", title: "Late-Round Heist",
      condition: "Draft a Round 5 driver (Picks #17–#20) who finishes Top 3 or outscores your Round 1 pick.",
      holders: holdersFrom(heistHits) }),
    badge({ id: "big-one", cat: "race", emoji: "🚧", title: "“Big One” Survivor",
      condition: "Finish Daytona or Talladega with 0 DNFs while at least 2 other managers suffer DNFs.",
      holders: holdersFrom(survHits) }),
    badge({ id: "fastest-lap-king", cat: "race", emoji: "⚡", title: "Fastest Lap King",
      condition: "Lead the league in Fastest Lap bonuses (+1 pt) across the season.",
      holders: flKings, counter: fl }),
    badge({ id: "photo-finish", cat: "race", emoji: "📸", title: "Photo Finish",
      condition: "Win a race week by less than 3.0 points.",
      holders: holdersFrom(photoHits) }),
    badge({ id: "mulligan-master", cat: "race", emoji: "🔄", title: "Master of the Mulligan",
      condition: "Use a Mulligan to swap a DNF / negative driver for a Top-5 finisher.",
      holders: holdersFrom(mullHits) }),
  ];
}

/** Every mulligan this season scored both ways: original at full scoring, replacement at mulligan scoring. */
export function mulliganSwaps(data) {
  const out = [];
  PLAYERS.forEach(p => (data?.mulligans?.[p.id] || []).forEach(m => {
    const wr = data?.results?.["w" + m.week];
    if (!wr?.raw?.drivers) return;
    const ty = tyOf(m.week), three = !!wr.raw.threeStages;
    const o = findRaw(wr.raw.drivers, m.driver), n = findRaw(wr.raw.drivers, m.replacement);
    if (!o || !n) return;
    const origPts = calcDriverScore(o, ty, false, three).total;
    const repPts = calcDriverScore(n, ty, true, three).total;
    out.push({ pid: p.id, week: m.week, orig: m.driver, rep: m.replacement, origPts, repPts, origDnf: !!o.dnf, repFinish: n.finish || null, swing: r1(repPts - origPts) });
  }));
  return out;
}

// ── Category B — Garage Roasts ───────────────────────────────────────────────
function roastBadges(data, weeks) {
  const poop = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  const poopHits = [], wreckHits = [], donutHits = [];
  weeks.forEach(({ w, wr }) => {
    const order = placed(wr.scored);
    if (order.length === PLAYERS.length) {
      const last = order[order.length - 1];
      poop[last[0]]++;
      poopHits.push({ pid: last[0], line: `${wk(w)} · ${r1(last[1].total)} pts` });
    }
    PLAYERS.forEach(p => {
      const L = lineup(wr, p.id);
      const dnfs = L.filter(d => d.raw?.dnf);
      if (dnfs.length >= 3) wreckHits.push({ pid: p.id, line: `${wk(w)} · ${dnfs.length} DNFs` });
      L.forEach(d => {
        if (d.raw?.qualPos > 0 && d.raw.qualPos <= 10 && d.total <= 0) {
          donutHits.push({ pid: p.id, line: `${wk(w)} · ${d.name} started P${d.raw.qualPos}, scored ${d.total}` });
        }
      });
    });
  });
  const wasted = mulliganSwaps(data).filter(m => m.origPts > m.repPts)
    .map(m => ({ pid: m.pid, line: `${wk(m.week)} · dropped ${m.orig} (${r1(m.origPts)}) for ${m.rep} (${r1(m.repPts)})` }));

  return [
    badge({ id: "poop", cat: "roast", emoji: "💩", title: "The Poop Award",
      condition: "Finish 4th (dead last) in a race week.",
      holders: holdersFrom(poopHits), counter: poop,
      facts: ["Season Poop Trophy Counter — see the tallies below."] }),
    badge({ id: "wrecked-bucket", cat: "roast", emoji: "💥", title: "Wrecked Bucket",
      condition: "Have 3 or more of your 5 drafted drivers DNF in the same race.",
      holders: holdersFrom(wreckHits),
      archive: [{ text: "Certified Wreckhouse Classic" }] }),
    badge({ id: "donut", cat: "roast", emoji: "🔍", title: "Failed Inspection (The Donut)",
      condition: "Have a drafted driver start Top 10 and finish with 0 or negative points.",
      holders: holdersFrom(donutHits),
      archive: [{ text: "Dicky Doo-certified donut" }] }),
    badge({ id: "white-flag", cat: "roast", emoji: "⛽", title: "Out of Fuel on the White Flag",
      condition: "Lead the live standings entering the final stage and lose the week on the final lap.",
      tracked: false,
      facts: ["Needs lap-by-lap live standings, which aren't stored yet — this one starts tracking once live snapshots are saved."] }),
    badge({ id: "wasted-mulligan", cat: "roast", emoji: "🗑️", title: "Wasted Mulligan",
      condition: "Burn a Mulligan to drop a driver who ends up outscoring your replacement.",
      holders: holdersFrom(wasted) }),
  ];
}

// ── Category C — Career milestones (2019–2026) ───────────────────────────────
function careerBadges(career = CAREER_STATS, history = CHAMPION_HISTORY) {
  const ids = PLAYERS.map(p => p.id).filter(id => career[id]);
  const cs = id => career[id];

  const century = ids.filter(id => cs(id).finishes[0] >= 100)
    .map(id => ({ pid: id, count: 1, lines: [`${cs(id).finishes[0]} career weekly wins`] }));

  const runs = getOverallRuns(history, 3);
  const dynasty = holdersFrom(runs.map(r => ({ pid: r.pid, line: `${r.length}-Peat · ${r.startYear}–${r.endYear}` })));

  const undisputed = holdersFrom([...history].sort((a, b) => a.year - b.year)
    .filter(s => s.regularSeason && s.regularSeason === s.overall)
    .map(s => ({ pid: s.overall, line: `${s.year}` })));

  const podium = ids.map(id => {
    const f = cs(id).finishes, races = cs(id).races;
    const pct = races ? (f[0] + f[1] + f[2]) / races : 0;
    return { id, thirds: f[2], pct };
  }).filter(x => x.thirds >= 75 || x.pct >= 0.85)
    .map(x => ({ pid: x.id, count: 1, lines: [`${x.thirds} thirds · ${(Math.round(x.pct * 1000) / 10).toFixed(1)}% podium rate`] }));

  const rookies = ids.filter(id => history.find(s => s.year === cs(id).firstYear)?.overall === id)
    .map(id => ({ pid: id, count: 1, lines: [`Champion in debut season ${cs(id).firstYear}`] }));
  const firstSeason = Math.min(...history.map(s => s.year));

  return [
    badge({ id: "century", cat: "career", emoji: "💯", title: "Century Club",
      condition: "100+ career weekly wins.", holders: century }),
    badge({ id: "dynasty", cat: "career", emoji: "👑",
      // titled after the longest run on record (Justin's 2023–2026 → "4-Peat Dynasty")
      title: `${Math.max(3, ...runs.map(r => r.length))}-Peat Dynasty`,
      condition: "Win 3+ consecutive Overall Championships.", holders: dynasty }),
    badge({ id: "undisputed", cat: "career", emoji: "🧹", title: "Undisputed Champion",
      condition: "Win the Regular Season and the Overall title in the same year.", holders: undisputed }),
    badge({ id: "mr-podium", cat: "career", emoji: "🥉", title: "Mr. Podium",
      condition: "75+ career 3rd-place finishes or an 85%+ career podium rate.", holders: podium }),
    badge({ id: "rookie", cat: "career", emoji: "⚡", title: "Rookie Sensation",
      condition: "Win the Overall Championship in your debut season.", holders: rookies,
      archive: rookies.filter(r => cs(r.pid).firstYear > firstSeason).map(r => ({ pid: r.pid, text: `${cs(r.pid).firstYear} Expansion` })) }),
  ];
}

/**
 * The 'Bill' legacy-file tribute. Bill was Justin's nickname in the original
 * spreadsheet era, so the numbers come from Justin's career record + title list.
 */
export function billTribute(career = CAREER_STATS, history = CHAMPION_HISTORY, pid = "justin") {
  const c = career[pid];
  if (!c) return null;
  const titles = history.filter(s => s.overall === pid).length;
  return `Legacy File Found: ‘Bill’ (${c.firstYear}–${c.lastYear}) • ${c.finishes[0]} Career Wins • ${titles}x FRL Champion`;
}

/** All badges, in category order. */
export function getAchievements(data, opts = {}) {
  const weeks = scoredWeekList(data).filter(x => x.wr.scored);
  return [
    ...raceBadges(data, weeks),
    ...roastBadges(data, weeks),
    ...careerBadges(opts.career, opts.history),
  ];
}

/** "unlocked / total" overall, or for one manager. Untracked badges still count toward the total. */
export function progress(badges, pid = null) {
  const unlocked = badges.filter(b => (pid ? b.holders.some(h => h.pid === pid) : b.holders.length > 0)).length;
  return { unlocked, total: badges.length };
}

// ── Records card ─────────────────────────────────────────────────────────────
/**
 * { season: [...4 records], allTime: [...4 records] } — each record
 *   { id, label, value, unit, pid?, detail, note? }
 * All-time takes the better of the hand-kept RECORD_BOOK and this season.
 * Driver lines and streaks are only archived from 2026, so those all-time
 * records start there (noted).
 */
export function getRecords(data, record = RECORD_BOOK) {
  const rec = getSeasonRecords(data);
  const weeks = scoredWeekList(data).filter(x => x.wr.scored);
  const wins = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  weeks.forEach(({ wr }) => { const f = placed(wr.scored)[0]; if (f) wins[f[0]]++; });
  const topWins = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  const streakTop = Object.entries(rec.winStreaks || {}).sort((a, b) => b[1] - a[1])[0];

  const season = [
    rec.bestPlayerWeek && { id: "week", label: "Single-Week High Score", value: r1(rec.bestPlayerWeek.score), unit: "pts", pid: rec.bestPlayerWeek.pid,
      detail: `W${rec.bestPlayerWeek.week} ${rec.bestPlayerWeek.race || ""}`.trim() },
    rec.bestDriverPerf && { id: "driver", label: "Single-Driver Explosion", value: r1(rec.bestDriverPerf.score), unit: "pts",
      pid: rec.bestDriverPerf.pickedBy?.[0] || null, detail: `${rec.bestDriverPerf.name} • W${rec.bestDriverPerf.week}` },
    streakTop && { id: "streak", label: "Longest Win Streak", value: streakTop[1], unit: streakTop[1] === 1 ? "win" : "wins", pid: streakTop[0], detail: "Best run of consecutive weekly wins" },
    topWins && { id: "season-wins", label: "Most Weekly Wins", value: topWins[1], unit: "wins", pid: topWins[0], detail: `${ACTIVE_SEASON} season` },
  ].filter(Boolean);

  const bySeason = Object.fromEntries(season.map(s => [s.id, s]));
  const pick = (a, b) => (!a ? b : !b ? a : b.value > a.value ? b : a);
  const bookWeek = record?.weekScore && { id: "week", label: "Single-Week High Score", value: record.weekScore.pts, unit: "pts", pid: record.weekScore.pid, detail: `${record.weekScore.race} • ${record.weekScore.year}` };
  const bookWins = record?.seasonWins && { id: "season-wins", label: "Highest Single-Season Win Total", value: record.seasonWins.wins, unit: "wins", pid: record.seasonWins.pid, detail: `${record.seasonWins.year}` };
  const seasonWinsRec = bySeason["season-wins"] && { ...bySeason["season-wins"], label: "Highest Single-Season Win Total" };

  const allTime = [
    pick(bookWeek, bySeason.week && { ...bySeason.week, detail: `${bySeason.week.detail} • ${ACTIVE_SEASON}` }),
    bySeason.driver && { ...bySeason.driver, note: `Driver lines archived from ${ACTIVE_SEASON}` },
    bySeason.streak && { ...bySeason.streak, note: `Streaks tracked from ${ACTIVE_SEASON}` },
    pick(bookWins, seasonWinsRec),
  ].filter(Boolean);

  return { season, allTime };
}
