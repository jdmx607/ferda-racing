import { CLASH_WEEK, ALL_STAR_WEEK } from "./exhibitions.js";

// 2027 NASCAR Cup Series schedule (announced Aug 26, 2026; cross-checked
// between Wikipedia and Motorbiscuit — race names are subject to change).
//
// `ex` marks an exhibition: drafted and scored, but not part of the points
// season (see exhibitions.js). Track types follow the league's existing
// buckets (~1-mile tracks like Phoenix/New Hampshire/Dover = short track).
// The Chase starts Week 27 (Richmond).
export const SCHEDULE_2027 = [
  {w:CLASH_WEEK, t:"Daytona",        ty:"superspeedway", d:"Feb 13", r:"Wheatley Vodka Clash",         ex:"clash"},
  {w:1,  t:"Daytona",        ty:"superspeedway", d:"Feb 21", r:"Daytona 500"},
  {w:2,  t:"Atlanta",        ty:"superspeedway", d:"Feb 28", r:"Autotrader 400"},
  {w:3,  t:"COTA",           ty:"road_course",   d:"Mar 7",  r:"DuraMAX Grand Prix"},
  {w:4,  t:"Phoenix",        ty:"short_track",   d:"Mar 14", r:"Straight Talk Wireless 500"},
  {w:5,  t:"Las Vegas",      ty:"intermediate",  d:"Mar 21", r:"Pennzoil 400"},
  {w:6,  t:"Darlington",     ty:"intermediate",  d:"Apr 4",  r:"Goodyear 400"},
  {w:7,  t:"Bristol",        ty:"short_track",   d:"Apr 11", r:"Food City 500"},
  {w:8,  t:"Martinsville",   ty:"short_track",   d:"Apr 18", r:"Cook Out 400"},
  {w:9,  t:"Talladega",      ty:"superspeedway", d:"Apr 25", r:"Jack Link's 500"},
  {w:10, t:"Texas",          ty:"intermediate",  d:"May 2",  r:"Würth 400"},
  {w:11, t:"Kansas",         ty:"intermediate",  d:"May 9",  r:"AdventHealth 400"},
  {w:12, t:"Dover",          ty:"short_track",   d:"May 16", r:"Ecosave 400"},
  {w:ALL_STAR_WEEK, t:"N. Wilkesboro", ty:"short_track", d:"May 23", r:"NASCAR All-Star Race",     ex:"allstar"},
  {w:13, t:"Charlotte",      ty:"intermediate",  d:"May 30", r:"Coca-Cola 600"},
  {w:14, t:"Nashville",      ty:"intermediate",  d:"Jun 6",  r:"Cracker Barrel 400"},
  {w:15, t:"Pocono",         ty:"intermediate",  d:"Jun 13", r:"Great American Getaway 400"},
  {w:16, t:"Michigan",       ty:"intermediate",  d:"Jun 20", r:"FireKeepers Casino 400"},
  {w:17, t:"Chicagoland",    ty:"intermediate",  d:"Jun 27", r:"eero 400"},
  {w:18, t:"Iowa",           ty:"short_track",   d:"Jul 4",  r:"Iowa Corn 350"},
  {w:19, t:"Sonoma",         ty:"road_course",   d:"Jul 11", r:"Toyota/Save Mart 350"},
  {w:20, t:"Atlanta",        ty:"superspeedway", d:"Jul 18", r:"Dollar Tree 400"},
  {w:21, t:"Indianapolis",   ty:"intermediate",  d:"Jul 25", r:"Brickyard 400"},
  {w:22, t:"San Diego",      ty:"road_course",   d:"Aug 1",  r:"Anduril 250"},
  {w:23, t:"Bristol",        ty:"short_track",   d:"Aug 14", r:"Bass Pro Shops Night Race"},
  {w:24, t:"WWT Raceway",    ty:"intermediate",  d:"Aug 22", r:"Enjoy Illinois 300"},
  {w:25, t:"Daytona",        ty:"superspeedway", d:"Aug 28", r:"Coke Zero Sugar 400"},
  {w:26, t:"Darlington",     ty:"intermediate",  d:"Sep 5",  r:"Cook Out Southern 500"},
  {w:27, t:"Richmond",       ty:"short_track",   d:"Sep 11", r:"Cook Out 400"},
  {w:28, t:"Watkins Glen",   ty:"road_course",   d:"Sep 19", r:"Go Bowling at The Glen"},
  {w:29, t:"New Hampshire",  ty:"short_track",   d:"Sep 26", r:"Dollar Tree 301"},
  {w:30, t:"Kansas",         ty:"intermediate",  d:"Oct 3",  r:"Hollywood Casino 400"},
  {w:31, t:"Las Vegas",      ty:"intermediate",  d:"Oct 10", r:"South Point 400"},
  {w:32, t:"Charlotte",      ty:"intermediate",  d:"Oct 17", r:"Bank of America 400"},
  {w:33, t:"Phoenix",        ty:"short_track",   d:"Oct 24", r:"Freeway Insurance 500"},
  {w:34, t:"Talladega",      ty:"superspeedway", d:"Oct 31", r:"YellaWood 500"},
  {w:35, t:"Martinsville",   ty:"short_track",   d:"Nov 7",  r:"Xfinity 500"},
  {w:36, t:"Homestead",      ty:"intermediate",  d:"Nov 14", r:"Season Finale 400"},
];
