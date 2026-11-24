#!/usr/bin/env python3
"""
Build the Next Gen Track Cheat Sheets for the FERDA Racing League app.

    py scripts/update_cheat_sheets.py                       # fetch + rebuild everything
    py scripts/update_cheat_sheets.py --source cup.parquet  # use a local file instead
    py scripts/update_cheat_sheets.py --qualifying q.csv --track daytona
                                                            # inject starting spots for race day

Output (static JSON, committed to the repo and served by Vite/Vercel):
    public/data/tracks_master.json            index of every schedule track + its top performers
    public/data/cheat_sheets/{slug}.json      one file per track: every active driver, scored

Data: Kyle Grealis' nascaR.data Cup results (https://nascar.kylegrealis.com), which are
sourced with permission from DriverAverages.com and refreshed every Monday of the season.
The CSV is tried first; if that URL is unavailable we fall back to the same dataset's
Parquet file (pandas + pyarrow). Install the tooling with:
    py -m pip install -r scripts/requirements-cheatsheet.txt

How a driver is scored at a track (0-100), Next Gen era only (2022+):
    30%  recency-weighted average finish
    35%  recency-weighted NASCAR Driver Rating
    20%  dominator potential  (laps led / race laps, recency-weighted)
    15%  discipline baseline  (their Next Gen average finish on every track of the same type)
Every component is turned into a percentile against the full-time field, so 50 is a
typical driver and 90+ is elite. Recency weights: this/last season 1.0, two seasons ago
0.75, three or more 0.5. A driver's track numbers are blended with their own discipline
numbers (worth one full-weight race) so a single fluke start can't masquerade as a trend.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"
CSV_URL = "https://nascar.kylegrealis.com/cup_series.csv"
PARQUET_URL = "https://nascar.kylegrealis.com/cup_series.parquet"
USER_AGENT = "ferda-racing-cheatsheet/1.0"

NEXT_GEN_SINCE = 2022
SHRINK_K = 1.0                 # prior strength, in full-weight races
REGULAR_MIN_STARTS = 8         # starts over the last two seasons to count as a full-time driver
WEIGHTS = {"finish": 0.30, "rating": 0.35, "dominator": 0.20, "discipline": 0.15}
TIER_CUTS = (85.0, 65.0, 40.0)  # composite >= cut -> tier 1 / 2 / 3, else tier 4
TIER_LABELS = {1: "Elite / Dominator", 2: "Top-10 Contender", 3: "Place-Diff / Value", 4: "Fade / High Risk"}

# --- Track catalogue -----------------------------------------------------------------
# slug, name as the app spells it (src/constants.js SCHEDULE), discipline, dataset track names.
# Disciplines match the app's four buckets (the app files ~1-mile tracks such as Phoenix and
# New Hampshire under short track, so there is no separate flat/1-mile group).
TRACKS = [
    ("daytona",       "Daytona",       "superspeedway", ["Daytona International Speedway"]),
    ("atlanta",       "Atlanta",       "superspeedway", ["Atlanta Motor Speedway", "EchoPark Speedway"]),  # renamed 2025; superspeedway since the 2022 repave
    ("talladega",     "Talladega",     "superspeedway", ["Talladega Superspeedway"]),
    ("cota",          "COTA",          "road_course",   ["Circuit of the Americas"]),
    ("sonoma",        "Sonoma",        "road_course",   ["Sonoma Raceway"]),
    ("watkins-glen",  "Watkins Glen",  "road_course",   ["Watkins Glen International"]),
    ("san-diego",     "San Diego",     "road_course",   ["Naval Base Coronado"]),
    ("phoenix",       "Phoenix",       "short_track",   ["Phoenix Raceway"]),
    ("bristol",       "Bristol",       "short_track",   ["Bristol Motor Speedway"]),
    ("martinsville",  "Martinsville",  "short_track",   ["Martinsville Speedway"]),
    ("richmond",      "Richmond",      "short_track",   ["Richmond Raceway"]),
    ("dover",         "Dover",         "short_track",   ["Dover International Speedway"]),
    ("new-hampshire", "New Hampshire", "short_track",   ["New Hampshire Motor Speedway"]),
    ("iowa",          "Iowa",          "short_track",   ["Iowa Speedway"]),
    ("n-wilkesboro",  "N. Wilkesboro", "short_track",   ["North Wilkesboro Speedway"]),
    ("las-vegas",     "Las Vegas",     "intermediate",  ["Las Vegas Motor Speedway"]),
    ("darlington",    "Darlington",    "intermediate",  ["Darlington Raceway"]),
    ("texas",         "Texas",         "intermediate",  ["Texas Motor Speedway"]),
    ("kansas",        "Kansas",        "intermediate",  ["Kansas Speedway"]),
    ("charlotte",     "Charlotte",     "intermediate",  ["Charlotte Motor Speedway"]),
    ("nashville",     "Nashville",     "intermediate",  ["Nashville Superspeedway"]),
    ("pocono",        "Pocono",        "intermediate",  ["Pocono Raceway"]),
    ("michigan",      "Michigan",      "intermediate",  ["Michigan International Speedway"]),
    ("chicagoland",   "Chicagoland",   "intermediate",  ["Chicagoland Speedway"]),
    ("indianapolis",  "Indianapolis",  "intermediate",  ["Indianapolis Motor Speedway"]),  # the oval, not the road course
    ("wwt-raceway",   "WWT Raceway",   "intermediate",  ["World Wide Technology Raceway at Gateway"]),
    ("homestead",     "Homestead",     "intermediate",  ["Homestead-Miami Speedway"]),
]
# Next Gen venues that are not on the schedule but still tell us how a driver handles a
# discipline (they feed the baseline only).
EXTRA_DISCIPLINE = {
    "Road America": "road_course",
    "Indianapolis Motor Speedway Road Course": "road_course",
    "Charlotte Motor Speedway Road Course": "road_course",
    "Chicago Street Course": "road_course",
    "Autodromo Hermanos Rodriguez": "road_course",
}
# Obsolete configurations: dropped completely (Bristol Dirt was a one-off surface; Auto Club
# Speedway has closed).
OBSOLETE = {"Bristol Motor Speedway Dirt Track", "Auto Club Speedway"}

DATASET_TO_SLUG = {name: slug for slug, _, _, names in TRACKS for name in names}
DATASET_TO_DISCIPLINE = {name: disc for _, _, disc, names in TRACKS for name in names}
DATASET_TO_DISCIPLINE.update(EXTRA_DISCIPLINE)


# --- Loading -------------------------------------------------------------------------
def _download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def load_results(source: str | None) -> tuple[pd.DataFrame, str]:
    """Return the raw Cup results and a label for where they came from."""
    if source and not re.match(r"^https?://", source):
        path = Path(source)
        if path.suffix.lower() == ".parquet":
            return pd.read_parquet(path), str(path)
        return pd.read_csv(path, dtype={"Car": str}), str(path)

    csv_url = source or CSV_URL
    try:
        return pd.read_csv(io.BytesIO(_download(csv_url)), dtype={"Car": str}), csv_url
    except Exception as exc:  # 404s, DNS, timeouts... fall back to the same dataset as Parquet
        print(f"! CSV unavailable ({exc}); trying Parquet", file=sys.stderr)
    pq_url = csv_url.replace(".csv", ".parquet") if csv_url.endswith(".csv") else PARQUET_URL
    return pd.read_parquet(io.BytesIO(_download(pq_url))), pq_url


def key_of(name: str) -> str:
    """Same identity the app uses (src/driverKey.js): lowercase letters only, accents and (i)/(R) stripped."""
    s = unicodedata.normalize("NFD", str(name or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\([^)]*\)", " ", s)
    return re.sub(r"[^a-z]", "", s.lower())


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Car"] = df["Car"].astype(str).str.strip()
    df = df[df["Season"] >= NEXT_GEN_SINCE]
    df = df[~df["Track"].isin(OBSOLETE)]
    unknown = sorted(set(df["Track"]) - set(DATASET_TO_DISCIPLINE))
    if unknown:
        print(f"! Ignoring tracks with no discipline mapping: {', '.join(unknown)}", file=sys.stderr)
        df = df[~df["Track"].isin(unknown)]
    df["discipline"] = df["Track"].map(DATASET_TO_DISCIPLINE)
    df["slug"] = df["Track"].map(DATASET_TO_SLUG)
    df["key"] = df["Driver"].map(key_of)
    ref = int(df["Season"].max())
    ago = ref - df["Season"]
    df["w"] = np.where(ago <= 1, 1.0, np.where(ago == 2, 0.75, 0.5))
    # Dominator potential: share of the race's laps this driver led.
    race_laps = df.groupby(["Season", "Race"])["Laps"].transform("max").clip(lower=1)
    df["led_pct"] = df["Led"].fillna(0) / race_laps * 100.0
    df["dnf"] = df["Status"].fillna("running").str.lower().ne("running")
    df["pd"] = df["Start"] - df["Finish"]  # positive = gained spots
    df["Rating"] = pd.to_numeric(df["Rating"], errors="coerce")
    return df.sort_values(["Season", "Race"], ascending=[False, False]).reset_index(drop=True)


# --- Maths ---------------------------------------------------------------------------
def wavg(values: pd.Series, weights: pd.Series) -> float | None:
    m = values.notna()
    if not m.any() or weights[m].sum() == 0:
        return None
    return float(np.average(values[m], weights=weights[m]))


def shrunk(rows: pd.DataFrame, col: str, prior: float) -> float:
    """Recency-weighted mean of `col`, blended with `prior` worth SHRINK_K full-weight races."""
    m = rows[col].notna()
    sw = float(rows.loc[m, "w"].sum())
    sx = float((rows.loc[m, col] * rows.loc[m, "w"]).sum())
    return (sx + SHRINK_K * prior) / (sw + SHRINK_K)


def percentile(value: float, ref: np.ndarray, higher_is_better: bool) -> float:
    if len(ref) == 0:
        return 50.0
    better = (ref < value).sum() if higher_is_better else (ref > value).sum()
    ties = (ref == value).sum()
    return float(100.0 * (better + 0.5 * ties) / len(ref))


def r1(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 1)


def streak(finishes: list[int], limit: int) -> int:
    n = 0
    for f in finishes:  # most recent first
        if f <= limit:
            n += 1
        else:
            break
    return n


# --- Per-track sheet -----------------------------------------------------------------
def active_pool(df: pd.DataFrame) -> tuple[list[str], set[str]]:
    """(drivers who raced in the latest season, the full-time subset used as the ranking field)."""
    ref = int(df["Season"].max())
    active = sorted(df.loc[df["Season"] == ref, "key"].unique())
    recent = df[df["Season"] >= ref - 1]
    starts = recent.groupby("key").size()
    regulars = {k for k in active if starts.get(k, 0) >= REGULAR_MIN_STARTS}
    return active, regulars


def build_sheet(df: pd.DataFrame, slug: str, app_name: str, discipline: str, ds_names: list[str],
                active: list[str], regulars: set[str]) -> dict:
    ref = int(df["Season"].max())
    track_rows = df[df["slug"] == slug]
    disc_rows = df[df["discipline"] == discipline]
    field_disc = {
        "Finish": float(disc_rows["Finish"].mean()), "Rating": float(disc_rows["Rating"].mean()),
        "led_pct": float(disc_rows["led_pct"].mean()),
    }

    latest = df[df["Season"] == ref].drop_duplicates("key").set_index("key")
    per_driver = {}
    for k in active:
        t = track_rows[track_rows["key"] == k]
        dsc = disc_rows[disc_rows["key"] == k]
        d_fin = wavg(dsc["Finish"], dsc["w"]) if len(dsc) else None
        d_rat = wavg(dsc["Rating"], dsc["w"]) if len(dsc) else None
        d_led = wavg(dsc["led_pct"], dsc["w"]) if len(dsc) else None
        per_driver[k] = {
            "t": t, "disc_finish": d_fin,
            "finish": shrunk(t, "Finish", d_fin if d_fin is not None else field_disc["Finish"]),
            "rating": shrunk(t, "Rating", d_rat if d_rat is not None else field_disc["Rating"]),
            "led": shrunk(t, "led_pct", d_led if d_led is not None else field_disc["led_pct"]),
        }

    ref_keys = [k for k in active if k in regulars] or active
    ref_finish = np.array([per_driver[k]["finish"] for k in ref_keys])
    ref_rating = np.array([per_driver[k]["rating"] for k in ref_keys])
    ref_led = np.array([per_driver[k]["led"] for k in ref_keys])
    ref_disc = np.array([per_driver[k]["disc_finish"] if per_driver[k]["disc_finish"] is not None else field_disc["Finish"]
                         for k in ref_keys])

    drivers = []
    for k in active:
        p = per_driver[k]
        t = p["t"]
        d_fin = p["disc_finish"] if p["disc_finish"] is not None else field_disc["Finish"]
        comp = {
            "finish": percentile(p["finish"], ref_finish, False),
            "rating": percentile(p["rating"], ref_rating, True),
            "dominator": percentile(p["led"], ref_led, True),
            "discipline": percentile(d_fin, ref_disc, False),
        }
        composite = sum(WEIGHTS[c] * comp[c] for c in WEIGHTS)

        starts = int(len(t))
        finishes = [int(x) for x in t["Finish"]]
        wins = int((t["Win"] == 1).sum()) if starts else 0
        dnfs = int(t["dnf"].sum()) if starts else 0
        avg_pd = float(t["pd"].mean()) if starts else None

        tier = 1 if composite >= TIER_CUTS[0] else 2 if composite >= TIER_CUTS[1] else 3 if composite >= TIER_CUTS[2] else 4
        if tier == 4 and starts >= 2 and avg_pd is not None and avg_pd >= 4:
            tier = 3                     # bad results but he reliably gains spots: a value play
        if starts >= 3 and dnfs / starts >= 0.4 and tier < 4:
            tier += 1                    # wrecks too often to trust
        if starts == 0 and tier == 1:
            tier = 2                     # never been here in a Next Gen car: can't be a lock

        tags = insight_tags(starts, finishes, wins, dnfs, avg_pd, comp, t)
        info = latest.loc[k] if k in latest.index else df[df["key"] == k].iloc[0]
        log = [{
            "season": int(r.Season), "race": int(r.Race), "name": str(r.Name),
            "start": int(r.Start), "finish": int(r.Finish), "led": int(r.Led or 0), "laps": int(r.Laps or 0),
            "rating": r1(r.Rating), "status": str(r.Status), "win": bool(r.Win == 1),
            "track": str(r.Track),
        } for r in t.itertuples()]

        drivers.append({
            "key": k, "name": str(info["Driver"]), "car": str(info["Car"]), "team": str(info["Team"]), "make": str(info["Make"]),
            "regular": k in regulars,
            "composite": r1(composite), "tier": tier,
            "components": {c: r1(v) for c, v in comp.items()},
            "stats": {
                "starts": starts, "wins": wins,
                "top5": int((t["Finish"] <= 5).sum()) if starts else 0,
                "top10": int((t["Finish"] <= 10).sum()) if starts else 0,
                "dnf": dnfs,
                "avgFinish": r1(wavg(t["Finish"], t["w"])) if starts else None,
                "rating": r1(wavg(t["Rating"], t["w"])) if starts else None,
                "ledPct": r1(wavg(t["led_pct"], t["w"])) if starts else None,
                "avgPlaceDiff": r1(avg_pd),
                "bestFinish": min(finishes) if starts else None,
                "disciplineAvg": r1(p["disc_finish"]),
            },
            "tags": tags,
            "log": log,
            "start": None, "placeDiffTarget": False,
        })

    drivers.sort(key=lambda d: (-d["composite"], d["name"]))
    return {
        "slug": slug, "track": app_name, "discipline": discipline,
        "datasetTracks": ds_names,
        "lengthMi": r1(float(track_rows["Length"].dropna().iloc[0])) if track_rows["Length"].notna().any() else None,
        "surface": str(track_rows["Surface"].dropna().iloc[0]) if track_rows["Surface"].notna().any() else None,
        "nextGenRaces": int(track_rows.groupby(["Season", "Race"]).ngroups),
        "seasons": sorted({int(s) for s in track_rows["Season"]}),
        "winners": winners_at(track_rows),
        "topPerformers": top_performers(track_rows),
        "qualifying": None,
        "drivers": drivers,
    }


def winners_at(track_rows: pd.DataFrame) -> list[dict]:
    w = track_rows[track_rows["Win"] == 1].sort_values(["Season", "Race"], ascending=[False, False])
    return [{"season": int(r.Season), "race": int(r.Race), "driver": str(r.Driver), "car": str(r.Car)} for r in w.itertuples()]


def top_performers(track_rows: pd.DataFrame) -> list[dict]:
    """Best Next Gen record at the track across ALL drivers (not just the active ones)."""
    n_races = track_rows.groupby(["Season", "Race"]).ngroups
    min_starts = min(3, n_races)
    out = []
    for k, g in track_rows.groupby("key"):
        if len(g) < min_starts:
            continue
        out.append({
            "name": str(g["Driver"].iloc[0]), "key": k, "starts": int(len(g)),
            "avgFinish": r1(wavg(g["Finish"], g["w"])), "wins": int((g["Win"] == 1).sum()),
            "top5": int((g["Finish"] <= 5).sum()),
        })
    out.sort(key=lambda d: (d["avgFinish"], -d["wins"]))
    return out[:3]


def insight_tags(starts, finishes, wins, dnfs, avg_pd, comp, t) -> list[str]:
    """Short, plain-English call-outs, most important first, three at most."""
    tags: list[str] = []
    if starts == 0:
        return ["No Next Gen Starts Here"]
    if wins:
        tags.append(f"{wins}x Next Gen Winner Here")
    s5, s10 = streak(finishes, 5), streak(finishes, 10)
    if s5 >= 3:
        tags.append(f"{s5} Straight Top-5s")
    elif s10 >= 3:
        tags.append(f"{s10} Straight Top-10s")
    if starts >= 2 and comp["rating"] >= 70 and (comp["finish"] <= 40 or dnfs / starts >= 0.34):
        tags.append("High Speed / Bad Luck")
    if comp["dominator"] >= 90 and starts >= 2:
        tags.append("Leads Laps Here")
    if starts >= 2 and avg_pd is not None and avg_pd >= 5:
        tags.append(f"Gains {avg_pd:.0f} Spots On Avg")
    if starts >= 3 and dnfs / starts >= 0.4:
        tags.append(f"DNF In {dnfs} Of {starts} Starts")
    if starts >= 2 and avg_pd is not None and avg_pd <= -5:
        tags.append(f"Loses {abs(avg_pd):.0f} Spots On Avg")
    if starts >= 3 and not any(f <= 10 for f in finishes):
        tags.append(f"0 Top-10s In {starts} Starts")
    return tags[:3]


# --- Output --------------------------------------------------------------------------
def write_json(path: Path, obj: dict) -> bool:
    """Write only when the content changed (ignoring generatedAt) so weekly runs don't churn git."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
            same = {k: v for k, v in old.items() if k != "generatedAt"} == {k: v for k, v in obj.items() if k != "generatedAt"}
            if same:
                return False
        except (ValueError, OSError):
            pass
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def apply_qualifying(sheet: dict, csv_path: Path) -> int:
    """Inject starting positions; flag drivers who start P20+ but have Tier 1/2 speed."""
    q = pd.read_csv(csv_path, dtype=str)
    cols = {c.lower().strip(): c for c in q.columns}
    name_col = cols.get("driver") or cols.get("name")
    car_col = cols.get("car") or cols.get("no") or cols.get("number")
    pos_col = next((cols[c] for c in ("start", "pos", "position", "qualifying", "starting position") if c in cols), None)
    if pos_col is None or not (name_col or car_col):
        raise SystemExit("Qualifying CSV needs a Driver (or Car) column and a Start/Pos/Position column.")
    by_key = {d["key"]: d for d in sheet["drivers"]}
    by_car = {d["car"]: d for d in sheet["drivers"]}
    matched = 0
    sheet["qualifying"] = {"source": csv_path.name, "date": date.today().isoformat()}
    for _, row in q.iterrows():
        d = by_key.get(key_of(row[name_col])) if name_col else None
        if d is None and car_col:
            d = by_car.get(str(row[car_col]).strip())
        pos = pd.to_numeric(row[pos_col], errors="coerce")
        if d is None or pd.isna(pos):
            continue
        d["start"] = int(pos)
        d["placeDiffTarget"] = bool(pos >= 20 and d["tier"] <= 2)
        matched += 1
    return matched


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", help="CSV/Parquet URL or local path (default: the nascaR.data Cup CSV)")
    ap.add_argument("--out", type=Path, default=OUT_DIR, help="output folder (default: public/data)")
    ap.add_argument("--qualifying", type=Path, help="CSV of starting positions to inject (needs --track)")
    ap.add_argument("--track", help="track slug the qualifying file belongs to, e.g. daytona")
    args = ap.parse_args()
    cheat_dir = args.out / "cheat_sheets"

    if args.qualifying:
        if not args.track:
            ap.error("--qualifying needs --track <slug>")
        path = cheat_dir / f"{args.track}.json"
        if not path.exists():
            ap.error(f"{path} does not exist yet - run the script once without --qualifying first")
        sheet = json.loads(path.read_text(encoding="utf-8"))
        n = apply_qualifying(sheet, args.qualifying)
        path.write_text(json.dumps(sheet, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        targets = [d for d in sheet["drivers"] if d["placeDiffTarget"]]
        print(f"{args.track}: matched {n} drivers; {len(targets)} place-diff targets: "
              + ", ".join(f"{d['name']} (P{d['start']})" for d in targets))
        return 0

    raw, label = load_results(args.source)
    df = prepare(raw)
    ref = int(df["Season"].max())
    last = df[df["Season"] == ref].sort_values("Race").iloc[-1]
    data_through = {"season": ref, "race": int(last["Race"]), "track": str(last["Track"])}
    active, regulars = active_pool(df)
    print(f"Loaded {len(raw):,} rows from {label}; Next Gen {NEXT_GEN_SINCE}-{ref}, through race {data_through['race']} "
          f"({data_through['track']}). {len(active)} active drivers, {len(regulars)} full-time.")

    master_tracks, changed = [], 0
    for slug, app_name, discipline, ds_names in TRACKS:
        sheet = build_sheet(df, slug, app_name, discipline, ds_names, active, regulars)
        sheet["generatedAt"] = date.today().isoformat()
        # keep injected qualifying data if the file already has some for the same data
        existing = cheat_dir / f"{slug}.json"
        if existing.exists():
            try:
                old = json.loads(existing.read_text(encoding="utf-8"))
                if old.get("qualifying"):
                    sheet["qualifying"] = old["qualifying"]
                    old_by_key = {d["key"]: d for d in old["drivers"]}
                    for d in sheet["drivers"]:
                        o = old_by_key.get(d["key"])
                        if o and o.get("start") is not None:
                            d["start"] = o["start"]
                            d["placeDiffTarget"] = bool(o["start"] >= 20 and d["tier"] <= 2)
            except (ValueError, OSError):
                pass
        changed += write_json(cheat_dir / f"{slug}.json", sheet)
        tiers = [sum(1 for d in sheet["drivers"] if d["tier"] == t) for t in (1, 2, 3, 4)]
        print(f"  {slug:<14} {discipline:<14} {sheet['nextGenRaces']:>2} races  tiers {tiers}")
        master_tracks.append({
            "slug": slug, "track": app_name, "discipline": discipline, "lengthMi": sheet["lengthMi"],
            "surface": sheet["surface"], "nextGenRaces": sheet["nextGenRaces"], "seasons": sheet["seasons"],
            "topPerformers": sheet["topPerformers"],
        })

    disciplines = {}
    for disc, g in df.groupby("discipline"):
        disciplines[disc] = {"nextGenRaces": int(g.groupby(["Season", "Race"]).ngroups),
                             "avgFinishAll": r1(float(g["Finish"].mean()))}
    master = {
        "generatedAt": date.today().isoformat(),
        "source": "nascaR.data (Kyle Grealis) / DriverAverages.com",
        "nextGenSince": NEXT_GEN_SINCE, "dataThrough": data_through,
        "weights": WEIGHTS, "tierCuts": list(TIER_CUTS), "tierLabels": {str(k): v for k, v in TIER_LABELS.items()},
        "recency": {"currentAndLast": 1.0, "twoYearsAgo": 0.75, "threePlus": 0.5},
        "disciplines": disciplines, "tracks": master_tracks,
    }
    changed += write_json(args.out / "tracks_master.json", master)
    print(f"Done: {len(master_tracks)} track sheets, {changed} file(s) changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
