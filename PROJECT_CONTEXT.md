# FERDA Racing League — Project Context

> **Purpose:** This file captures the complete history, architecture, rules, and decisions for the FERDA Racing League fantasy NASCAR app. It exists so any new Claude session (especially in Claude Code) can pick up exactly where the previous session left off without losing context.
>
> **Last updated:** June 2026 — W14 Nashville scored, live feed wired, PWA deployed

---

## 1. What This App Is

A **private fantasy NASCAR scoring web app** for four players — Justin, Big Monroe, Monroe, and Rich. Players draft 5 NASCAR Cup Series drivers each week. Points are calculated from real race results using a custom scoring system. The commissioner (Justin) manually scores each week after the race.

**Live URL:** `https://ferda-racing.vercel.app`
**Stack:** React 18 + Vite → Firebase Firestore → Vercel (auto-deploy on git push)

---

## 2. Player Config

| Player | ID | Password | BG Color | FG Color | Role |
|---|---|---|---|---|---|
| Justin | `justin` | `ferda1` | `#000000` | `#CFC493` | Commissioner |
| Big Monroe | `bigmonroe` | `ferda2` | `#DC0019` | `#FFFFFF` | Player |
| Monroe | `monroe` | `ferda3` | `#046A38` | `#91999F` | Player |
| Rich | `rich` | `ferda4` | `#B3995D` | `#AA0000` | Player |

**Email addresses (hardcoded in `src/email.js`):**
- Justin: `jdmx607@gmail.com`
- Big Monroe & Monroe (shared): `Extremebmxer923@gmail.com`
- Rich: `Rreynolds0129@gmail.com`

---

## 3. File Structure

```
ferda-v3/
├── src/
│   ├── App.jsx          # Entire frontend — 1,269 lines, needs refactoring into components
│   ├── firebase.js      # Firestore init, load/save/subscribe, localStorage fallback
│   ├── historicalData.js # W1–W14 hardcoded picks + race results (~455 lines)
│   ├── nascar.js        # Data fetching: live feed, post-race cacher, projections
│   ├── email.js         # EmailJS draft notifications
│   └── main.jsx         # Vite entry point
├── api/
│   └── nascar.js        # Vercel serverless proxy (handles CORS for all external APIs)
├── public/
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service worker (cache-first static, network-first API)
│   ├── favicon.png/ico
│   └── icons/           # App icons 72px–512px (FERDA eagle logo)
├── index.html           # PWA meta tags, SW registration, Google Fonts
├── vite.config.js
├── package.json         # "type":"module" required for Vercel ESM functions
└── vercel.json          # Build config + SPA routing rewrites
```

**Critical:** `package.json` must have `"type":"module"` — without it, `api/nascar.js` breaks because Vercel can't parse `export default`.

---

## 4. Firebase / Data Architecture

**Firestore document:** `leagues/ferda-season-2026` (single document, entire app state)

**Top-level fields:**
```javascript
{
  results: {
    w1: { raw: { drivers:[...], threeStages:bool }, scored: { justin:{...}, bigmonroe:{...}, ... } },
    w14: { ... },
    // W12 (Watkins Glen) and W13 (Charlotte) through W14 (Nashville) are scored
    // W12 was added manually — was not originally in the build
  },
  picks: {
    w14: {
      justin: [{ driver:"#12 Ryan Blaney", mulligan:false }, ...],
      monroe: [{ driver:"#6 Brad Keselowski", mulligan:true }, ...], // mulligan flag
    }
  },
  drafts: {
    w15: [{ pid:"justin", driver:"#11 Denny Hamlin", pickNum:0 }, ...] // live draft log
  },
  mulligans: {
    justin: [], bigmonroe: [{week:8, driver:"...", replacement:"..."}], ...
  },
  liveRace: { active:bool, week:int, mock:bool, startedAt:"ISO string" },
  playerSettings: { justin: { email:"...", notifyOnTurn:bool } },
  meta: {
    standings: { justin:0, bigmonroe:0, monroe:0, rich:0 },
    playoffPts: { justin:0, bigmonroe:0, monroe:0, rich:0 },
    mulligansUsed: { justin:0, bigmonroe:0, monroe:0, rich:0 },
    lastScoredWeek: 14
  }
}
```

**localStorage backup:** Every save also writes to `localStorage["ferda-backup"]`. On load, if Firebase fails, falls back to localStorage.

**To fully reset the app:** Delete the `leagues` collection in Firebase Console + run `localStorage.clear()` in browser.

---

## 5. Scoring Engine

Located in `src/App.jsx` — `calcDriverScore()` and `scoreWeekFull()`.

### Finish Points
```
P1=55, P2=35, P3=34, P4=33... decreasing by 1 to P36=1, P37-P40=1
```

### Bonuses on top of finish
| Condition | Points |
|---|---|
| Top 5 finish | +2 |
| Top 10 finish | +1 |
| Stage top 10 (per stage) | P1=10, P2=9 ... P10=1 |
| Laps led × track multiplier | see below |
| Led at least 1 lap | +0.5 |
| Net position (qual→finish) | ±1 per spot, capped ±10 |
| Pole position | +5 |
| Stage win | +2.5 each |
| Fastest lap | +1 |
| Most laps led (race) | +5 |
| Sweep (pole + all stage wins) | +12.5 |
| DQ | −5 total (overrides all other scoring) |

### Track Multipliers (laps led)
| Type | Multiplier | Tracks |
|---|---|---|
| Superspeedway | ×1.0 | Daytona, Talladega, Atlanta |
| Road Course | ×1.5 | COTA, Watkins Glen, Sonoma, etc. |
| Intermediate | ×0.5 | Charlotte, Nashville, Michigan, etc. |
| Short Track | ×0.2 | Bristol, Martinsville, Richmond, etc. |

### DNF Rule (important — changed from original)
DNF drivers score **normally** — finish position, net position, and any stage points earned still apply. The `dnf` flag is display-only. **Only DQ = −5 total override.** This was a deliberate rule change in June 2026 after discovering the original "DNF=0" rule was wrong.

### Mulligan Scoring
Mulligan replacement drivers earn: **finish position points + net position only**. No stage points, no laps led, no bonuses. The mulligan flag is set on the pick object: `{ driver:"#6 Brad Keselowski", mulligan:true }`.

### Three-Stage Races (Coca-Cola 600 only)
Week 13 (Charlotte) has 3 stages. Results have a `threeStages:true` flag. A third stage winner gets +2.5 bonus. Sweep requires pole + all 3 stage wins.

### Weekly Win
Highest scorer earns **+25 playoff points**. Tiebreakers (in order):
1. Who had the race winner in their lineup
2. Highest single-driver score that week

### Regular Season Champion Bonus
The standings leader entering the playoffs (Week 27) receives **+50 playoff points**. This is displayed live in the Playoffs tab as a projected bonus. If there's a tie, no bonus is awarded until the tie is broken.

### Playoff Structure (Week 27+)
Everyone resets to **1,000 base** + accumulated playoff points + champion bonus (if applicable). Scoring continues through Week 36 (Homestead).

---

## 6. Draft System

- **Format:** Straight draft, 5 rounds, 5 active picks per player (20 total per week)
- **Order:** Last week's loser picks first, winner picks last. Same order all 5 rounds (no snake).
- **Garage pick:** `GARAGE_PICK_ENABLED = false` — disabled for 2026, framework exists for future
- **Mulligan limit:** 10 per player per season

**Draft data flow:**
1. Each pick writes to BOTH `data.drafts.wXX` (live draft log) AND `data.picks.wXX` (final lineup)
2. When Commissioner uses "Set Picks Only", it also populates `data.drafts.wXX` so the Draft tab shows as complete and blocks further drafting (prevents double-entries)

**Known issue history:** Early weeks had pick-doubling bugs where Commissioner-entered picks and drafted picks coexisted. The fix is that `handleSavePicksOnly` now always populates drafts.

---

## 7. Mulligans

- **10 per player per season**
- Can be applied before a race is scored (not after)
- Applied in the Mulligans tab (interactive flow) or by Commissioner
- Mulligan count is visible publicly in Standings and Lineups as "M: X" (color coded: green → amber at ≤5 → red at ≤1)
- Warnings appear in the Mulligans tab at ≤5 remaining and ≤1 remaining

**Mulligan history through W14:**
| Player | Used | Details |
|---|---|---|
| Justin | 0 | None used |
| Big Monroe | 4 | W8: Bell→Allmendinger; W13: Zilisch→McDowell, Elliott→Erik Jones |
| Monroe | 3 | W8: Berry→SVG(?); W11: Dillon→Kyle Busch; W14: Zilisch→Keselowski |
| Rich | 0 | None used |

> ⚠️ Verify mulligan counts from Firestore — the above is from historicalData.js picks flags and may differ slightly from what's in Firebase if manual edits were made.

---

## 8. Historical Data (W1–W14)

Stored in `src/historicalData.js` as two exported objects:
- `HISTORICAL_PICKS` — weekly picks per player (with mulligan flags)
- `HISTORICAL_RESULTS` — race results per week (driver finish, qual, stages, laps led, bonuses, flags)

**Weeks present:** W1–W14 (W12 Watkins Glen was backfilled manually by Justin)

**Known data corrections applied (from API audit):**
- W2 Atlanta: Byron `lapsLed` 25→0, Zilisch `lapsLed` 9→0 (neither led a lap)
- W8 Bristol: Bell `lapsLed` 6→0 (was incorrect)

**`buildInitialData()` loop** in App.jsx iterates W1 through `lastScoredWeek` (currently 14). Missing weeks are silently skipped. `scoreAllWeeks()` dynamically computes standings from this data on every app load.

---

## 9. NASCAR Data Sources

### Live Scoring (during race)
```
https://cf.nascar.com/live/feeds/live-feed.json
```
- **FREE, no API key**
- Same feed NASCAR Race Center uses
- Updates every ~10 seconds during a race
- `vehicles[]` array is empty when no race is running
- Routed through Vercel proxy: `/api/nascar?source=live`
- Polling interval: 30 seconds (constant `LIVE_POLL_INTERVAL`)

**Key fields in `vehicles[]` entries:**
```javascript
{
  vehicle_number: "11",       // car number string
  driver: { first_name: "Denny", last_name: "Hamlin" },
  running_position: 1,        // current position
  qualifying_position: 1,     // starting position
  laps_led: 57,               // total laps led so far
  status: 1,                  // 1=running, 0=out
}
```

**Flag states:** 1=Green, 2=Yellow/Caution, 3=Red, 4=Caution, 8=Final Lap, 9=Complete, 0=Pre-race

**⚠️ Stage points are NOT available in the live feed.** Live scoring shows positions and laps led only. Final stage points are added after the race via the "Fetch from NASCAR.com" button.

### Post-Race Results
```
https://cf.nascar.com/cacher/2026/1/{raceId}/weekend-feed.json
```
- **FREE, no API key**
- Available after race ends
- Contains full results: finish, start, laps led, stage positions, lead changes
- Routed through Vercel proxy: `/api/nascar?path=...`

**Confirmed race IDs (hardcoded in `src/nascar.js`):**
```
W1:5596 W2:5597 W3:5598 W4:5599 W5:5600 W6:5603 W7:5602 W8:5604
W9:5607 W10:5605 W11:5606 W12:5621 W13:5610
```
W14+ are dynamically fetched from `race_list_basic.json`.

### Projections (pre-race)
Requires **SportsDataIO Discovery Lab** paid subscription.
- URL: `api.discoverylab.sportsdata.io/v2/nascar/scores/json/`
- Current key `bc0810a6cc664a83aa343c7ec4002b7e` is a **main SportsDataIO free trial key** — it does NOT cover NASCAR
- Free trial only covers UEFA Champions League
- To enable: subscribe at `discoverylab.sportsdata.io/personal-use-apis/nascar`, replace key in `api/nascar.js`

### Vercel Proxy (`api/nascar.js`)
All external requests route through this serverless function:
- `?source=live` → `cf.nascar.com/live/feeds/live-feed.json` (no cache)
- `?source=live&mock=1` → Returns W14 Nashville mock data (testing only)
- `?source=sportsdata&path=...` → Discovery Lab (if valid key)
- `?path=...` → NASCAR cacher CDN
- `?test=1` → Returns `{ok:true}` to verify proxy is deployed

---

## 10. Tab Structure & Components

**Tab order:** Home, Draft, Lineups, Mulligans, Live, Results, Playoffs, Projections, Schedule, Rules, Settings, COMMISH (Justin only, red border)

| Tab | Component | Purpose |
|---|---|---|
| Home | `WelcomeTab` | Personalized greeting, personal stats, live widget, standings, next race |
| Draft | `DraftTab` | Week draft with order, available drivers (team/make shown), pick log, undo |
| Lineups | `LineupsTab` | Weekly pick cards with mulligan counts |
| Mulligans | `MulligansTab` | Interactive swap flow, warnings, history |
| Live | `LiveTab` | Real-time scoring during race (active/inactive states) |
| Results | `ResultsTab` | Weekly results by week selector, driver breakdowns, 👑/💩 |
| Playoffs | `PlayoffsTab` | 1000-base chase standings with +50 reg season champ bonus |
| Projections | `ProjectionsTab` | Pre-race projections + API connectivity test |
| Schedule | `ScheduleTab` | Full 36-race schedule with track types |
| Rules | `RulesTab` | Scoring rules reference |
| Settings | `SettingsTab` | Per-player email and notification prefs |
| COMMISH | `CommissionerTab` | Score/Edit/Fetch/Live controls (Justin only) |

---

## 11. Commissioner Panel Features

- **🔌 Fetch from NASCAR.com** — Loads post-race data from cacher, pre-fills the editor
- **Score Week** — Runs `scoreWeekFull()` and saves to Firestore
- **Edit Picks** — Loads existing picks for editing (shows even for unscored weeks)
- **Set Picks Only** — Saves picks without scoring; also locks the draft tab
- **Edit Week** — Re-opens scored week for correction
- **Reset Week** — Deletes all results, picks, and draft data for a week
- **📧 Notify First Picker** — Sends EmailJS notification to first drafter
- **🟢 START LIVE — WXX** — Activates live scoring mode (everyone sees live tab)
- **🧪 Simulate Live (W14 Test)** — Activates live mode with W14 Nashville mock data
- **END RACE** — Deactivates live mode

**Per-player "Clear All"** button in the picks editor — useful when picks doubled up.

---

## 12. Special Rules & Edge Cases

### Kyle Busch Memorial
Kyle Busch (#8) passed away May 21, 2026. He is **permanently frozen** in all driver pickers:
- Shows in draft picker with 🕊️ and "Retired" label — unselectable
- Cannot be used as a mulligan replacement
- Login screen shows "🕊️ In loving memory of Kyle Busch · #8 · 1985 – 2026"
- Subtle low-opacity #8 SVG watermark renders behind the entire app (`MemorialBackdrop` component)
- Implemented via `MEMORIAL_DRIVERS = { "#8 Kyle Busch": { years:"1985 – 2026" } }`
- Historical picks that include him (Justin's W13 picks) are preserved and score as DNR

### #33 Driver
Shared ride between Austin Hill and Jesse Love (RCR). Stored as `"#33 Austin Hill / Jesse Love"`. Earlier weeks in historicalData.js may have `"Austin Hill / Will Brown"` — this is correct for those weeks; don't modify historical data.

### Ineligible Drivers
Part-timers marked `(i)` in NASCAR official results still score normally in FERDA (we don't filter them out). #67 Corey Heim is a frequent example.

### Charlotte 3-Stage Race
Week 13 (Coca-Cola 600) is the only 3-stage race. The `threeStages:true` flag enables:
- S3 stage points scored identically to S1/S2
- S3 win bonus: +2.5
- Sweep requires pole + all 3 stage wins
- Commissioner editor shows S3 column and checkbox when "3 Stages" is toggled

---

## 13. Email Notifications

**Service:** EmailJS  
**Credentials (in `src/email.js`):**
```
service_id: "service_po962m8"
template_id: "template_w6a290d"
public_key: "x5gm09HoetYBepHgk"
```
- Fires on each draft pick, notifying the next picker
- Commissioner can manually trigger "Notify First Picker" for draft kickoff
- Players can update their email in Settings tab; falls back to hardcoded defaults
- Only fires if `notifyOnTurn !== false` in player settings

---

## 14. PWA (Progressive Web App)

- **Manifest:** `public/manifest.json` — FERDA Racing, black theme, all icon sizes
- **Icons:** FERDA eagle logo, 9 sizes from 72px to 512px
- **Service worker:** `public/sw.js` — cache-first for assets, network-first for Firebase/API
- **Install prompt:** Gold/red install banner captured via `beforeinstallprompt` event
- **iOS:** `apple-mobile-web-app-capable` + `apple-touch-icon` for home screen install via Share → Add to Home Screen

---

## 15. Standings After W14 (current)

> Computed dynamically from historicalData.js — verify from Firebase for exact current values.

| Player | Approx Pts | Wins | Playoff Pts | Mulligans Left |
|---|---|---|---|---|
| Rich | ~2390 | 4 | ~178 | 10 |
| Justin | ~2330 | 4 | ~140 | 10 |
| Monroe | ~2312 | 3 | ~132 | 7 |
| Big Monroe | ~2188 | 2 | ~86 | 6 |

**W14 Nashville winner:** Monroe (189 pts — Hamlin was dominant: 103 pts alone)

---

## 16. Refactoring Priorities (for Claude Code)

The biggest technical debt in priority order:

1. **Split App.jsx** — 1,269 lines is too large. Suggested component breakdown:
   - `components/` — Nav, WelcomeTab, DraftTab, LiveTab, ResultsTab, PlayoffsTab, CommissionerTab, etc.
   - `hooks/useLeagueData.js` — Firebase subscription + localStorage fallback
   - `hooks/useLivePolling.js` — 30s live poll logic
   - `engine/scoring.js` — calcDriverScore, scoreWeekFull, scoreAllWeeks
   - `engine/draft.js` — getDraftOrder, buildSnakeOrder
   - `constants.js` — PLAYERS, SCHEDULE, DRIVERS, DRIVER_INFO, scoring tables
   - `data/historicalData.js` — unchanged, just moved

2. **Add scoring tests** — The scoring engine has been audited against real race data (W1–W14 verified). Tests would catch future regressions.

3. **Firestore security rules** — Currently in test mode (expires ~30 days). Need production rules.

4. **Capacitor wrap** — For App Store/Play Store. The web app is the source; Capacitor wraps it.

---

## 17. Future Goals (backlog)

- Tab for favorites/previous weekly winners
- Historical league champions
- Better notifications (push notifications via service worker — infrastructure already in place in sw.js)
- UI overhaul — minimalistic design
- Player photos / track icons
- Driver pick % stats across the season
- Race recaps
- Practice/qualifying notes
- Top drivers of the week (best 3 scoring drivers with/without being picked)
- Driver stats within FERDA scoring system
- Best available suggestion in Mulligans tab
- Monday morning news feed (race recap) + Friday news feed (week preview)
- Score ticker
- Truck series / Xfinity series expansion
- Native iOS/Android app via Capacitor

---

## 18. Known Bugs / Watch Items

- **Firestore security rules expire** ~30 days from initial setup. Check Firebase Console.
- **W12 Watkins Glen** was backfilled manually by Justin in the app, not from historicalData.js. The historicalData.js version was added later during a session — verify the two match.
- **SportsDataIO projections** not working with current key (wrong product). The key is for the main SportsDataIO free trial, not Discovery Lab. Live scoring via `live-feed.json` is fully functional without it.
- **#33 name inconsistency** — W12 and earlier may store `"Austin Hill / Will Brown"`, W13+ stores `"Austin Hill / Jesse Love"`. Both are correct for their respective race weeks.
- **Fastest lap not in any API feed** — Must always be entered manually in Commissioner before scoring.

---

## 19. Deploy Checklist

Every deploy:
1. Replace `src/`, `api/`, `public/`, `index.html`, `vite.config.js`, `package.json`, `vercel.json`
2. Paste Firebase config into `src/firebase.js` (never committed to git)
3. If scoring logic or historical data changed: delete `leagues` collection in Firebase Console
4. If switching devices/browsers: `localStorage.clear()` in browser console
5. `git add . && git commit -m "message" && git push`
6. Verify at `https://ferda-racing.vercel.app/api/nascar?test=1` — should return `{"ok":true,...}`
