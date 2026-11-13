# FERDA Racing — Off-Season To-Do

Captured Nov 13, 2026, after the 2026 season (ended Week 36). Nothing here is
started unless noted. The user wants to revisit and refine this list before
committing to any of it.

## Big picture

- [ ] **Complete redesign.** Keep the minimalistic vibe, but the current UI is
      "too much" and needs an overhaul. Scope and direction TBD — the user will
      come back with a clearer idea first.
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
      *First pass done Nov 13, 2026* from the 2027 lineup graphic (draft picker
      now has a Free Agents tab; Brad Keselowski is the only one in it). Still
      open: name the drivers in the **#6 (RFK)** and **#33 (RCR)** cars, confirm
      #10/#16 at Kaulig (Dodge) and #51's team, and re-check Jimmie Johnson's
      `partTime` flag.

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
- [ ] **Record of past champions** — including adding historical champions.
      Needs somewhere to store them (e.g. a field on the Firestore doc).
- [ ] **Fun achievements — overhaul the system.** (Current badges live in
      `engine/history.js` `ALL_ACHIEVEMENTS`.)
- [ ] **Pictures of driver numbers?**
- [ ] **Better, more accessible news feed.**

## UI

- [ ] **Better design for regular-season championship vs. playoff (Chase)
      championship** — clearer UI distinguishing the two.
