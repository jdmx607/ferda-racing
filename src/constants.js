// ─── LEAGUE CONSTANTS ──────────────────────────────────────────────────────────
// Single source of truth for all scoring tables, player config, and schedule.
// Scoring logic lives in engine/scoring.js; UI themes live in App.jsx.

import { SCHEDULE_2027 } from "./schedule2027.js";
export { CLASH_WEEK, ALL_STAR_WEEK, EXHIBITION_WEEKS, isExhibition, weekLabel, weekName } from "./exhibitions.js";

export const PLAYERS = [
  { id: "justin", name: "Justin", password: "ferda1" },
  { id: "bigmonroe", name: "Big Monroe", password: "ferda2" },
  { id: "monroe", name: "Monroe", password: "ferda3" },
  { id: "rich", name: "Rich", password: "ferda4" },
];

export const PNAME = { justin: "Justin", bigmonroe: "Big Monroe", monroe: "Monroe", rich: "Rich" };

// Default SMS numbers — used as a fallback when a player hasn't set their own
// phone in Settings, so texting works with zero action required from anyone.
export const DEFAULT_PHONES = {
  justin:    "607-242-2378",
  bigmonroe: "845-803-0398",
  monroe:    "845-803-0398",
  rich:      "607-821-9286",
};

export const FINISH_POINTS = {
  1:55,2:35,3:34,4:33,5:32,6:31,7:30,8:29,9:28,10:27,
  11:26,12:25,13:24,14:23,15:22,16:21,17:20,18:19,19:18,20:17,
  21:16,22:15,23:14,24:13,25:12,26:11,27:10,28:9,29:8,30:7,
  31:6,32:5,33:4,34:3,35:2,36:1,37:1,38:1,39:1,40:1,
};

export const STAGE_POINTS = { 1:10,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1 };

export const TRACK_MULTS = {
  superspeedway: 1.0,
  short_track:   0.2,
  intermediate:  0.5,
  road_course:   1.5,
};

export const ACTIVE_PICKS        = 5;
export const PICKS_PER_WEEK      = 6;
export const MAX_MULLIGANS       = 10;
export const PLAYOFF_START_WEEK  = 27;
// Regular-season champ bonus is computed dynamically — see engine/chase.js
export const GARAGE_PICK_ENABLED = false;

// Draft turn timer: autopick after 12h, reminder notification at 6h
export const DRAFT_TIMER_MS    = 12 * 3600 * 1000;
export const DRAFT_REMINDER_MS =  6 * 3600 * 1000;

// Drivers frozen in memoriam — cannot be picked, shown with tribute marker
export const MEMORIAL_DRIVERS = {
  "#8 Kyle Busch": { years: "1985 – 2026" },
};

export const SCHEDULE_2026 = [
  {w:1, t:"Daytona",        ty:"superspeedway", d:"Feb 15", r:"Daytona 500"},
  {w:2, t:"Atlanta",        ty:"superspeedway", d:"Feb 22", r:"Autotrader 400"},
  {w:3, t:"COTA",           ty:"road_course",   d:"Mar 1",  r:"DuraMAX Grand Prix"},
  {w:4, t:"Phoenix",        ty:"short_track",   d:"Mar 8",  r:"Straight Talk 500"},
  {w:5, t:"Las Vegas",      ty:"intermediate",  d:"Mar 15", r:"Pennzoil 400"},
  {w:6, t:"Darlington",     ty:"intermediate",  d:"Mar 22", r:"Goodyear 400"},
  {w:7, t:"Martinsville",   ty:"short_track",   d:"Mar 29", r:"Cook Out 400"},
  {w:8, t:"Bristol",        ty:"short_track",   d:"Apr 12", r:"Food City 500"},
  {w:9, t:"Kansas",         ty:"intermediate",  d:"Apr 19", r:"AdventHealth 400"},
  {w:10,t:"Talladega",      ty:"superspeedway", d:"Apr 26", r:"Jack Link's 500"},
  {w:11,t:"Texas",          ty:"intermediate",  d:"May 3",  r:"Würth 400"},
  {w:12,t:"Watkins Glen",   ty:"road_course",   d:"May 10", r:"Go Bowling at The Glen"},
  {w:13,t:"Charlotte",      ty:"intermediate",  d:"May 24", r:"Coca-Cola 600"},
  {w:14,t:"Nashville",      ty:"intermediate",  d:"May 31", r:"Cracker Barrel 400"},
  {w:15,t:"Michigan",       ty:"intermediate",  d:"Jun 7",  r:"FireKeepers Casino 400"},
  {w:16,t:"Pocono",         ty:"intermediate",  d:"Jun 14", r:"Great American Getaway 400"},
  {w:17,t:"San Diego",      ty:"road_course",   d:"Jun 21", r:"Anduril 250"},
  {w:18,t:"Sonoma",         ty:"road_course",   d:"Jun 28", r:"Toyota/Save Mart 350"},
  {w:19,t:"Chicagoland",    ty:"intermediate",  d:"Jul 5",  r:"TBA"},
  {w:20,t:"Atlanta",        ty:"superspeedway", d:"Jul 12", r:"Quaker State 400"},
  {w:21,t:"N. Wilkesboro",  ty:"short_track",   d:"Jul 19", r:"Window World 450"},
  {w:22,t:"Indianapolis",   ty:"intermediate",  d:"Jul 26", r:"Brickyard 400"},
  {w:23,t:"Iowa",           ty:"short_track",   d:"Aug 9",  r:"Iowa Corn 350"},
  {w:24,t:"Richmond",       ty:"short_track",   d:"Aug 15", r:"Cook Out 400"},
  {w:25,t:"New Hampshire",  ty:"short_track",   d:"Aug 23", r:"Mobil 1 301"},
  {w:26,t:"Daytona",        ty:"superspeedway", d:"Aug 29", r:"Coke Zero Sugar 400"},
  {w:27,t:"Darlington",     ty:"intermediate",  d:"Sep 6",  r:"Cook Out Southern 500"},
  {w:28,t:"WWT Raceway",    ty:"intermediate",  d:"Sep 13", r:"Enjoy Illinois 300"},
  {w:29,t:"Bristol",        ty:"short_track",   d:"Sep 19", r:"Bass Pro Shops Night Race"},
  {w:30,t:"Kansas",         ty:"intermediate",  d:"Sep 27", r:"Hollywood Casino 400"},
  {w:31,t:"Las Vegas",      ty:"intermediate",  d:"Oct 4",  r:"South Point 400"},
  {w:32,t:"Charlotte",      ty:"intermediate",  d:"Oct 11", r:"Bank of America 400"},
  {w:33,t:"Phoenix",        ty:"short_track",   d:"Oct 18", r:"Freeway Insurance 500"},
  {w:34,t:"Talladega",      ty:"superspeedway", d:"Oct 25", r:"YellaWood 500"},
  {w:35,t:"Martinsville",   ty:"short_track",   d:"Nov 1",  r:"Xfinity 500"},
  {w:36,t:"Homestead",      ty:"intermediate",  d:"Nov 8",  r:"Straight Talk Wireless 400"},
];

// Which season the app is running. The 2026 archive keeps using the 2026
// schedule (race names + track types drive display and re-scoring), so the
// 2027 schedule stays staged until the new season actually starts — see
// "Start the 2027 season" in OFFSEASON_TODO.md for what flipping this needs.
export const SCHEDULES = { 2026: SCHEDULE_2026, 2027: SCHEDULE_2027 };
export const ACTIVE_SEASON = 2026;
export const SCHEDULE = SCHEDULES[ACTIVE_SEASON];

// 2027 mulligan rule: 10 for the year (regular season + playoffs only — never
// in the exhibitions), plus 2 bonus mulligans in the playoffs for anyone who
// used none during the regular season. 2026 played without the bonus.
export const PLAYOFF_MULLIGAN_BONUS = ACTIVE_SEASON >= 2027 ? 2 : 0;

// All-Star Race payout into playoff points, by finishing place among the 4 players.
export const ALL_STAR_PAYOUT = [125, 50, 10, 0];

// 2027 draftable pool, from the 2027 Cup team lineup graphic (grouped by team).
// Names come from each car number's 2026 driver — see the note by
// DRIVER_INFO_2027 for the slots that still need confirming. Drivers that
// only raced in 2026 stay in DRIVER_INFO (below) so past results, stats and
// history keep their team/make info; they're just no longer draftable.
export const DRIVERS = [
  // Hendrick
  "#5 Kyle Larson","#9 Chase Elliott","#24 William Byron","#48 Alex Bowman",
  // Spire
  "#7 Daniel Suarez","#71 Michael McDowell","#77 Carson Hocevar",
  // Trackhouse
  "#1 Ross Chastain","#88 Connor Zilisch","#97 Shane Van Gisbergen",
  // RCR, Haas, HYAK, Rick Ware
  "#3 Austin Dillon","#33 Austin Hill","#41 Cole Custer","#47 Ricky Stenhouse Jr","#51 Cody Ware",
  // Joe Gibbs
  "#11 Denny Hamlin","#19 Chase Briscoe","#20 Christopher Bell","#54 Ty Gibbs",
  // 23XI
  "#23 Bubba Wallace","#35 Riley Herbst","#45 Tyler Reddick",
  // Legacy
  "#42 John Hunter Nemechek","#43 Erik Jones","#84 Jimmie Johnson",
  // Penske + Wood Brothers
  "#2 Austin Cindric","#12 Ryan Blaney","#22 Joey Logano","#21 Josh Berry",
  // Front Row
  "#4 Noah Gragson","#34 Todd Gilliland","#38 Zane Smith",
  // RFK
  "#6 Ryan Preece","#17 Chris Buescher",
  // Kaulig (Dodge)
  "#10 Ty Dillon","#16 AJ Allmendinger",
  // Free agent (no ride yet — shown under the Free Agents tab)
  "#6 Brad Keselowski",
  // In memoriam (not draftable)
  "#8 Kyle Busch",
];

// 2026 driver/team info — kept as the legacy lookup for past-season data.
const DRIVER_INFO_2026 = {
  "#1 Ross Chastain":               { team:"Trackhouse Racing",         make:"Chevy" },
  "#2 Austin Cindric":              { team:"Team Penske",                make:"Ford"  },
  "#3 Austin Dillon":               { team:"Richard Childress Racing",   make:"Chevy" },
  "#4 Noah Gragson":                { team:"Front Row Motorsports",      make:"Ford"  },
  "#5 Kyle Larson":                 { team:"Hendrick Motorsports",       make:"Chevy" },
  "#6 Brad Keselowski":             { team:"RFK Racing",                 make:"Ford"  },
  "#7 Daniel Suarez":               { team:"Spire Motorsports",          make:"Chevy" },
  "#8 Kyle Busch":                  { team:"Richard Childress Racing",   make:"Chevy" },
  "#9 Chase Elliott":               { team:"Hendrick Motorsports",       make:"Chevy" },
  "#10 Ty Dillon":                  { team:"Kaulig Racing",              make:"Chevy" },
  "#11 Denny Hamlin":               { team:"Joe Gibbs Racing",           make:"Toyota"},
  "#12 Ryan Blaney":                { team:"Team Penske",                make:"Ford"  },
  "#16 AJ Allmendinger":            { team:"Kaulig Racing",              make:"Chevy" },
  "#17 Chris Buescher":             { team:"RFK Racing",                 make:"Ford"  },
  "#19 Chase Briscoe":              { team:"Joe Gibbs Racing",           make:"Toyota"},
  "#20 Christopher Bell":           { team:"Joe Gibbs Racing",           make:"Toyota"},
  "#21 Josh Berry":                 { team:"Wood Brothers Racing",       make:"Ford"  },
  "#22 Joey Logano":                { team:"Team Penske",                make:"Ford"  },
  "#23 Bubba Wallace":              { team:"23XI Racing",                make:"Toyota"},
  "#24 William Byron":              { team:"Hendrick Motorsports",       make:"Chevy" },
  "#33 Austin Hill / Jesse Love":   { team:"Richard Childress Racing",   make:"Chevy", partTime:true },
  "#34 Todd Gilliland":             { team:"Front Row Motorsports",      make:"Ford"  },
  "#35 Riley Herbst":               { team:"23XI Racing",                make:"Toyota"},
  "#38 Zane Smith":                 { team:"Front Row Motorsports",      make:"Ford"  },
  "#41 Cole Custer":                { team:"Haas Factory Team",          make:"Chevy" },
  "#42 John Hunter Nemechek":       { team:"Legacy Motor Club",          make:"Toyota"},
  "#43 Erik Jones":                 { team:"Legacy Motor Club",          make:"Toyota"},
  "#45 Tyler Reddick":              { team:"23XI Racing",                make:"Toyota"},
  "#47 Ricky Stenhouse Jr":         { team:"HYAK Motorsports",           make:"Chevy" },
  "#48 Alex Bowman":                { team:"Hendrick Motorsports",       make:"Chevy" },
  "#50 Burt Myers":                 { team:"Team AmeriVet Racing",       make:"Chevy", partTime:true },
  "#51 Cody Ware":                  { team:"Rick Ware Racing",           make:"Chevy" },
  "#54 Ty Gibbs":                   { team:"Joe Gibbs Racing",           make:"Toyota"},
  "#60 Ryan Preece":                { team:"RFK Racing",                 make:"Ford"  },
  "#62 Casey Mears / Anthony Alfredo":{ team:"Beard Oil Racing",         make:"Chevy", partTime:true },
  "#66 Various":                    { team:"Garage 66",                  make:"Ford",  partTime:true },
  "#67 Corey Heim":                 { team:"23XI Racing",                make:"Toyota", partTime:true },
  "#71 Michael McDowell":           { team:"Spire Motorsports",          make:"Chevy" },
  "#77 Carson Hocevar":             { team:"Spire Motorsports",          make:"Chevy" },
  "#78 BJ McLeod / Daniel Dye / Katherine Legge":{ team:"Live Fast Motorsports", make:"Chevy", partTime:true },
  "#84 Jimmie Johnson":             { team:"Legacy Motor Club",          make:"Toyota", partTime:true },
  "#88 Connor Zilisch":             { team:"Trackhouse Racing",          make:"Chevy" },
  "#91 Kevin Magnussen":            { team:"Trackhouse Racing",          make:"Chevy", partTime:true },
  "#97 Shane Van Gisbergen":        { team:"Trackhouse Racing",          make:"Chevy" },
  "#01 Corey LaJoie":               { team:"Rick Ware Racing",           make:"Ford"  },
  "#36 Chandler Smith":             { team:"Front Row Motorsports",      make:"Ford",  partTime:true },
  "#40 Justin Allgaier":            { team:"JR Motorsports",             make:"Chevy", partTime:true },
  "#44 JJ Yeley / Joey Gase":       { team:"NY Racing Team",             make:"Chevy", partTime:true },
  "#99 Corey LaJoie":               { team:"RFK Racing",                 make:"Ford"  },
};

// 2027 changes layered over the 2026 info. Still to confirm/add by hand:
//  • #10 / #16 at Kaulig (now Dodge) and #51's team are carried over from the
//    2026 numbers — verify them.
const DRIVER_INFO_2027 = {
  "#6 Ryan Preece":        { team:"RFK Racing",               make:"Ford"  },   // was #60 in 2026
  "#33 Austin Hill":       { team:"Richard Childress Racing", make:"Chevy" },   // full-time in 2027
  "#10 Ty Dillon":         { team:"Kaulig Racing",  make:"Dodge" },
  "#16 AJ Allmendinger":   { team:"Kaulig Racing",  make:"Dodge" },
  // No ride for 2027 yet — `freeAgent` keeps him out of autopick.
  "#6 Brad Keselowski":    { team:"Free Agent",     freeAgent:true },
};

export const DRIVER_INFO = { ...DRIVER_INFO_2026, ...DRIVER_INFO_2027 };

export const MAKE_COLORS = { Chevy: "#b8b8b8", Ford: "#0052cc", Toyota: "#eb0a1e", Dodge: "#a855f7" };

export function isMemorial(driver) { return !!MEMORIAL_DRIVERS[driver]; }
export function isPartTime(driver) { return !!DRIVER_INFO[driver]?.partTime; }
export function isFreeAgent(driver) { return !!DRIVER_INFO[driver]?.freeAgent; }
