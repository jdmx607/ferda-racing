// ─── Season History Engine ─────────────────────────────────────────────────────
// Pure functions for computing season story data from the Firestore document.

import { SCHEDULE, PLAYERS } from "../constants.js";
import { getWeekTopDrivers } from "./stats.js";

// ── Timeline ──────────────────────────────────────────────────────────────────

// Returns [{week, raceName, trackType, scores:{pid->{total,weeklyWin,position}}}]
// sorted W1 → W14, only for scored weeks.
export function getSeasonTimeline(data) {
  return Object.entries(data.results || {})
    .filter(([, wr]) => wr.scored)
    .map(([key, wr]) => {
      const week     = parseInt(key.replace("w", ""));
      const weekInfo = SCHEDULE.find(s => s.w === week);

      // Compute positional finish (1st/2nd/3rd/4th) from weekly totals
      const sorted = Object.entries(wr.scored).sort((a, b) => b[1].total - a[1].total);
      const scores = {};
      sorted.forEach(([pid, s], i) => {
        scores[pid] = { total:s.total, weeklyWin:s.weeklyWin, position:i+1 };
      });

      // Week's top driver (MVP)
      let mvp = null;
      if (wr.raw?.drivers) {
        const top = getWeekTopDrivers(wr.raw, week, 1);
        if (top[0]) mvp = { name:top[0].name, score:top[0].total };
      }

      return {
        week,
        raceName:  weekInfo?.r    || `Week ${week}`,
        track:     weekInfo?.t    || "",
        trackType: weekInfo?.ty   || "intermediate",
        date:      weekInfo?.d    || "",
        scores,
        mvp,
      };
    })
    .sort((a, b) => a.week - b.week);
}

// ── Head-to-Head ──────────────────────────────────────────────────────────────

// Returns {pid: {oppPid: {wins, losses, ties}}}
export function getHeadToHead(data) {
  const ids = PLAYERS.map(p => p.id);
  const records = {};
  ids.forEach(a => {
    records[a] = {};
    ids.forEach(b => { if (a !== b) records[a][b] = { wins:0, losses:0, ties:0 }; });
  });

  Object.values(data.results || {}).forEach(wr => {
    if (!wr.scored) return;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const sa = wr.scored[a]?.total || 0;
        const sb = wr.scored[b]?.total || 0;
        if (sa > sb) {
          records[a][b].wins++;   records[b][a].losses++;
        } else if (sb > sa) {
          records[b][a].wins++;   records[a][b].losses++;
        } else {
          records[a][b].ties++;   records[b][a].ties++;
        }
      }
    }
  });
  return records;
}

// ── Form guide ────────────────────────────────────────────────────────────────

// Returns {pid: [{week, position, score}]} — all weekly finishes in order
export function getWeeklyFinishes(data) {
  const finishes = {};
  PLAYERS.forEach(p => { finishes[p.id] = []; });

  Object.entries(data.results || {}).forEach(([key, wr]) => {
    if (!wr.scored) return;
    const week   = parseInt(key.replace("w", ""));
    const sorted = Object.entries(wr.scored).sort((a, b) => b[1].total - a[1].total);
    sorted.forEach(([pid, s], i) => {
      finishes[pid].push({ week, position:i+1, score:s.total, weeklyWin:s.weeklyWin });
    });
  });

  // Sort each player's history by week
  Object.values(finishes).forEach(arr => arr.sort((a, b) => a.week - b.week));
  return finishes;
}

// ── Achievements ──────────────────────────────────────────────────────────────

const ALL_ACHIEVEMENTS = [
  {
    id:"first_win",   icon:"🏆", label:"First Win",
    desc:(n) => `${n} weekly win${n>1?"s":""}`,
    unlock:(stats) => stats.wins >= 1,
    statLine:(stats) => stats.wins,
  },
  {
    id:"hat_trick",   icon:"🎩", label:"Hat Trick",
    desc:() => "3+ weekly wins",
    unlock:(stats) => stats.wins >= 3,
    statLine:(stats) => `${stats.wins} wins`,
  },
  {
    id:"dominant",    icon:"👑", label:"Dominant",
    desc:() => "5+ weekly wins",
    unlock:(stats) => stats.wins >= 5,
    statLine:(stats) => `${stats.wins} wins`,
  },
  {
    id:"streak2",     icon:"🔥", label:"On a Streak",
    desc:() => "2+ consecutive wins",
    unlock:(stats) => stats.bestStreak >= 2,
    statLine:(stats) => `Best: ${stats.bestStreak} straight`,
  },
  {
    id:"streak3",     icon:"🌋", label:"Unstoppable",
    desc:() => "3+ consecutive wins",
    unlock:(stats) => stats.bestStreak >= 3,
    statLine:(stats) => `${stats.bestStreak} in a row`,
  },
  {
    id:"iron_will",   icon:"💎", label:"Iron Will",
    desc:() => "Zero mulligans used",
    unlock:(stats) => stats.mulligansUsed === 0,
    statLine:() => "No mulligans",
  },
  {
    id:"survivor",    icon:"🛡️", label:"Never Last",
    desc:() => "Never finished 4th",
    unlock:(stats) => stats.lastPlaceFinishes === 0 && stats.weeksPlayed >= 3,
    statLine:(stats) => `${stats.weeksPlayed} weeks, 0 last`,
  },
  {
    id:"ironman",     icon:"⚙️", label:"Iron Man",
    desc:() => "Competed all 14 weeks",
    unlock:(stats) => stats.weeksPlayed >= 14,
    statLine:() => "14/14 races",
  },
  {
    id:"comeback",    icon:"📈", label:"Comeback",
    desc:() => "Won after finishing last",
    unlock:(stats) => stats.wonAfterLast,
    statLine:() => "Bounced back",
  },
  {
    id:"sharpshooter",icon:"🎯", label:"Sharpshooter",
    desc:(n) => `Picked race winner ${n} time${n>1?"s":""}`,
    unlock:(stats) => stats.raceWinnerPicks >= 2,
    statLine:(stats) => `${stats.raceWinnerPicks} race-winner picks`,
  },
  {
    id:"high_roller", icon:"💰", label:"High Roller",
    desc:() => "Scored 150+ in a week",
    unlock:(stats) => stats.bestWeekScore >= 150,
    statLine:(stats) => `Best: ${stats.bestWeekScore} pts`,
  },
  {
    id:"consistent",  icon:"📐", label:"Mr. Consistent",
    desc:() => "Never below 100 pts in a week",
    unlock:(stats) => stats.lowestWeekScore >= 100 && stats.weeksPlayed >= 5,
    statLine:(stats) => `Low: ${stats.lowestWeekScore} pts`,
  },
];

export function getAchievements(data) {
  const finishes = getWeeklyFinishes(data);

  return Object.fromEntries(PLAYERS.map(p => {
    const pid    = p.id;
    const hist   = finishes[pid] || [];
    const wins   = hist.filter(h => h.weeklyWin).length;
    const lasts  = hist.filter(h => h.position === 4).length;
    const scored = Object.values(data.results || {});

    // Race-winner picks
    let raceWinnerPicks = 0;
    Object.entries(data.results || {}).forEach(([key, wr]) => {
      if (!wr.scored || !wr.raw?.drivers) return;
      const raceWinner = wr.raw.drivers.find(d => d.finish === 1)?.name;
      const picks = data.picks?.[key]?.[pid] || [];
      if (raceWinner && picks.some(pk => pk.driver === raceWinner && !pk.mulligan)) {
        raceWinnerPicks++;
      }
    });

    // Best streak
    let bestStreak = 0, cur = 0;
    hist.forEach(h => {
      if (h.weeklyWin) { cur++; bestStreak = Math.max(bestStreak, cur); } else { cur = 0; }
    });

    // Won after finishing last (comeback)
    let wonAfterLast = false;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i-1].position === 4 && hist[i].weeklyWin) { wonAfterLast = true; break; }
    }

    const scores = hist.map(h => h.score);
    const stats = {
      wins,
      bestStreak,
      mulligansUsed: data.meta.mulligansUsed[pid] || 0,
      lastPlaceFinishes: lasts,
      weeksPlayed: hist.length,
      wonAfterLast,
      raceWinnerPicks,
      bestWeekScore:  scores.length ? Math.max(...scores) : 0,
      lowestWeekScore: scores.length ? Math.min(...scores) : 0,
    };

    const unlocked = ALL_ACHIEVEMENTS.filter(a => a.unlock(stats));
    return [pid, { unlocked, stats }];
  }));
}
