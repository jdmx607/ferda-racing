# FERDA Racing — Off-Season To-Do

Captured Nov 13, 2026, after the 2026 season (ended Week 36). Nothing here is
started unless noted. The user wants to revisit and refine this list before
committing to any of it.

## Big picture

- [~] **Complete redesign — "Pit-Wall Minimalism" (telemetry UI).** First pass merged to main
      (Nov 2026): design tokens + light-mode-ready CSS
      variables in `src/styles.css`; flat monochrome palette in `theme.js`; new
      `FlagStrip`, `RaceHeader`, `DriverCard` components; Live tab, Lineups, nav
      (bottom-anchored on phones), login, ticker rebuilt. STILL TO DO: migrate the
      other tabs (Results, Welcome, Feed, Draft, Stats, Playoffs, ISC, Commissioner…)
      off inline hex colours onto the CSS vars/classes (needed before a light-mode
      toggle works), and replace the ~100 remaining literal green/red/amber uses that
      aren't live telemetry. Swap `DriverCard`'s number badge for official number art when
      available; fill `RaceHeader`'s 64×64 slot with track outlines; edit paint colours
      in `src/driverPaint.js`.
- [ ] **New logo?**
- [ ] **Remove extra nonsense** — e.g. the Stats page. (Note: Power Rankings,
      Awards, Hot Streaks, Trophy Case and Season Recap all read from
      `engine/stats.js` / `engine/history.js`; removing the *page* doesn't
      require removing those engines.)

## Gameplay / rules

- [ ] **Add the O'Reilly (Xfinity) series?** — Data feeds are currently
      hard-wired to Cup (`/2026/1/<raceId>/...` in `nascar.js`; `series_1` race
      IDs in `CACHER_RACE_IDS`).
- [ ] **Enable trading?**
- [ ] **Expand to 6 picks?** — `PICKS_PER_WEEK = 6` and the garage-pick
      scaffolding (`GARAGE_PICK_ENABLED`) already exist in code, currently off.
- [ ] **Update drivers/teams for the new season** — `DRIVERS` / `DRIVER_INFO`
      in `constants.js`, including the `partTime` flags used by autopick.
      *Done Nov 13, 2026* from the 2027 lineup graphic + user-supplied changes:
      Preece #6 (RFK), Hill #33 (RCR), Berry #42 + Herbst #84 (Legacy), Heim #35
      (23XI), Love #21 (Wood Bros); Keselowski is the lone Free Agent;
      Nemechek and Jimmie Johnson are out of the pool. Still open: confirm the
      remaining names are right (#10 Ty Dillon / #16 Allmendinger at Kaulig
      Dodge, #51 Cody Ware) and add any part-time / miscellaneous drivers.

## Drafting

- [ ] **Auto-draft rework** — e.g. each player ranks their own top 10 drivers,
      and autopick uses that list. (Today autopick ranks by average FERDA pts at
      the week's track type, full-time drivers only.)
- [ ] **External driver ratings / track data** (ifantasyracing.com-style speed
      charts, average finishes, driver ratings) — tabled from the 2026 season.
      No public API; would need scraping or manual entry.
- [ ] **Texting alerts for pick turns** — SMS (Twilio) is built and on by
      default in code, but delivery was never confirmed end-to-end (an
      "Authenticate" error from Twilio was still unresolved at last check).
      Verify that first, then decide what else is wanted.

## Content & records

- [ ] **Championship splash screen** for the end of the season. (A champion
      banner on Home shipped Nov 13, 2026 as a first step.)
- [x] **Record of past champions** — Hall of Champions built (Home → Trophy Case, or the
      Champions tab): 2019–2026 history lives in `src/championsHistory.js` (one object per
      season; optional `notes`, `margin`, `inaugural`). Titles, sweeps, split crowns and
      streaks are calculated from it. TODO each season: add the new year at the top of that
      list. (Per-player profiles are still under Standings → Trophy case →.)
- [ ] **Fun achievements — overhaul the system.** (Current badges live in
      `engine/history.js` `ALL_ACHIEVEMENTS`.)
- [ ] **Pictures of driver numbers?**
- [ ] **Better, more accessible news feed.**

## UI

- [ ] **Better design for regular-season championship vs. playoff (Chase)
      championship** — clearer UI distinguishing the two.
- [ ] **Driver cards** — a small, minimalistic card per driver: name, car #,
      manufacturer and stats. (The redesign branch has a `DriverCard` row for
      live/lineup use; this would be a separate profile-style card, e.g. for the
      Drivers tab.)
- [ ] **Points ahead/behind feature** — show how far ahead of / behind the other
      players each person is. (Live tab already shows the gap to the player above
      during a race; this is the broader version — scope TBD.)
- [x] **Chase cutline** — built as a NASCAR *driver* card on Home ("Playoff cutline"),
      from the official points feed: top 16 in the regular season, then 12 / 8 / 4
      for the Chase rounds (W27–29 / W30–32 / W33–35; W36 has no cut). The 12/8/4
      round sizes are the NASCAR format — confirm that matches the league. Needs the
      live-points feed, so it only shows when that feed is up.
- [ ] **Race start times** — looked up from NASCAR's race list (ET) with a 2:00 PM ET
      placeholder (shown as ~2:00 PM) until a season's list is published. Optional
      per-race override: add `time:"15:30"` (24h, ET) to a schedule entry. For 2027,
      the race list endpoint (and 2027 race IDs) won't exist until NASCAR publishes it.

## Start the 2027 season (the 2027 schedule is built but NOT active)

The 2027 schedule (`src/schedule2027.js`) incl. the Clash and All-Star Race
exhibitions is staged. `ACTIVE_SEASON` in `constants.js` is still 2026 so the
2026 archive stays intact. Previewable in the Schedule tab. To go live:

- [ ] Flip `ACTIVE_SEASON` to 2027 in `src/constants.js`.
- [ ] New Firestore doc for 2027 (today: `leagues/ferda-season-2026`) with
      empty results/picks/drafts; keep the 2026 doc as the archive.
- [ ] Per-season localStorage backup key.
- [ ] 2027 NASCAR race IDs (`CACHER_RACE_IDS`) and year-parametrize the
      `/2026/1/` paths in `src/nascar.js`.
- [ ] Text that still says 2026 / Darlington (PlayoffsTab, RulesTab) —
      Chase now opens at Richmond (W27).
- [x] #6 = Ryan Preece (RFK), #33 = Austin Hill (RCR) added. Still verify the
      #10/#16 Dodge moves and #51 team; Brad Keselowski stays under Free Agents
      until he signs (his old #6 entry stays so 2026 history still matches).
- [x] Exhibition rules confirmed: Clash = draft order only, no points. All-Star
      pays playoff pts 125 / 50 / 10 / 0 by finish (ties split). Dover = short
      track. Mulligans: 10/season, regular season + playoffs only (never in
      exhibitions), +2 playoff bonus for a mulligan-free regular season.
- [ ] Exhibition winners do not show in the activity feed / stats yet.
- [ ] Drivers tab is a first pass (active / free agents / part-time lists) —
      user plans further changes to it.
