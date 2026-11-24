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
      Preece #6 (RFK), Hill #33 (RCR), Berry #42 + Herbst #84 (Legacy), Heim #67
      (23XI — he kept his #67, not #35), Love #21 (Wood Bros); Keselowski is the lone Free Agent;
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

## Seasons: archive + rollover (built Nov 24, 2026)

Every season is its own Firestore document, `leagues/ferda-season-YYYY`. The ACTIVE
season's document is the live league; earlier seasons are frozen archives
(`archived: true`, and the database rules then refuse any write to them). Browse any
season read-only in **More → Seasons**. Nothing is ever deleted.

### Starting a new season (do this every year)
1. **Back up** the old season (also done automatically by step 3):
   `npm run backup -- 2026` → saved to `../ferda-racing-backups/` (outside the repo; it holds phone numbers).
2. **Dry run** (changes nothing): `npm run rollover -- 2027` — shows what will be created.
3. **Roll over**: `npm run rollover -- 2027 --yes` — backs up, creates an empty 2027 season
   (carrying over each player's settings: phone, push, Simplified Mode…), marks 2026 archived,
   and verifies 2026's results/picks are untouched.
4. **Flip the app**: in `src/constants.js` set `DEFAULT_ACTIVE_SEASON = 2027`, add the new year's
   schedule/rookies if needed, push to main. (If you skip step 3, the first person to open the new
   app does the same rollover automatically, safely, in one transaction.)
5. Add the finished year's champions to `src/championsHistory.js` and career totals to
   `src/careerStats.js`.

Tests are pinned to 2026 (`vite.config.js` → `test.env.VITE_ACTIVE_SEASON`) so the 2026
fixtures keep their meaning. After a rollover, `npm run rules-test` re-checks the database rules
against a throwaway document (then delete it as the script prints).

### Done
- [x] Per-season documents, per-season offline backup key, season picker + read-only archive view.
- [x] Database rules: every `ferda-season-20XX` doc readable/writable by shape; archived docs frozen
      (deployed + smoke-tested Nov 24, 2026). To fix something in an archive: set its `archived`
      field to false in the Firebase console, edit, set it back to true.
- [x] Chase text (opening / finale track) now comes from the schedule, not hard-coded.
- [x] Whole app dry-run on an empty 2027 season (every screen, login → Simplified Mode → rollover): no crashes.
- [x] Corey Heim = #67 (23XI). Preece #6, Hill #33, Berry #42, Herbst #84, Love #21; Keselowski free agent.
- [x] Exhibition rules: Clash = draft order only, no points. All-Star pays playoff pts 125 / 50 / 10 / 0.
      Mulligans: 10/season (+2 playoff bonus for a mulligan-free regular season, never in exhibitions).

### Still to do before the Daytona 500 (Clash is Sat Feb 13, 2027; its draft opens ~Mon Feb 8)
- [ ] **2027 NASCAR race IDs** — NASCAR hasn't published the 2027 race list yet (the feed 403s).
      `CACHER_RACE_IDS` and the `/2026/1/` paths in `src/nascar.js` are 2026-only: parametrize by season
      and map weeks → race IDs from `race_list_basic.json` once it's published. Until then enter
      results manually.
- [ ] Decide who picks first in **the Clash** (today: no prior race, so the default order — Justin first).
- [ ] Confirm #10/#16 at Kaulig (Dodge), #51 Cody Ware's team, and add any part-time drivers.
- [ ] Exhibition winners don't show in the activity feed / stats yet.
- [ ] Add 2027-schedule tests (the suite only covers 2026 now).
- [x] **Track Cheat Sheet** (More → Racing → Cheat Sheet; also linked from Big Monroe's Make Picks).
      `scripts/update_cheat_sheets.py` pulls the nascaR.data Cup results (CSV, falling back to the
      Parquet file when the CSV URL 404s — it does today), scores every active driver at every schedule
      track, and writes `public/data/tracks_master.json` + `public/data/cheat_sheets/{slug}.json`.
      Setup once: `py -m pip install -r scripts/requirements-cheatsheet.txt`; refresh with
      `py scripts/update_cheat_sheets.py`. On race weekend inject starting spots (flags Place-Diff
      Targets): `py scripts/update_cheat_sheets.py --qualifying q.csv --track daytona` (the tab also
      picks the grid up from NASCAR's feed by itself). `.github/workflows/update-cheat-sheets.yml`
      refreshes it every Monday Feb–Nov and commits the changes. Tier cuts / weights live at the top
      of the script. Tracks with little Next Gen history (Chicagoland, San Diego, N. Wilkesboro: one
      race each) lean on each driver's record at similar tracks.
- [ ] Race Archive tab (pick a track → what everyone drafted and scored, each year), built on the
      archived season docs.
