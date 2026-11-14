import { useMemo, useCallback } from "react";
import { SCHEDULE } from "../constants";
import { nameKey } from "../driverKey";
import { getScouting } from "../engine/draftBoard";
import {
  getTrackForm, getToRear, isPlayoffWeek, activePlayoffKeys, scoutingTags, getTrackStrategy,
} from "../engine/scouting";
import { useStartingGrid } from "./useNascarFeeds";

/**
 * Everything the scouting UI needs for one race week, computed once:
 *   ty, grid (qualifying), season (avg finish / track rating), form (last 5 at
 *   this archetype), rear (to-the-rear flags), strategy callout, tagsFor(driver),
 *   formFor(driver).
 */
export function useScouting(data, week, { enabled = true } = {}) {
  const weekInfo = SCHEDULE.find(s => s.w === week) || null;
  const ty = weekInfo?.ty || null;
  const grid = useStartingGrid(week, enabled && !!weekInfo);
  const season = useMemo(() => getScouting(data, ty), [data, ty]);
  const form = useMemo(() => (ty ? getTrackForm(data, ty) : {}), [data, ty]);
  const rear = useMemo(() => new Set(getToRear(data, week)), [data, week]);
  const playoff = useMemo(
    () => (isPlayoffWeek(week) ? activePlayoffKeys(data?.chaseField) : new Set()),
    [data?.chaseField, week]
  );

  const tagsFor = useCallback(driver => {
    const k = nameKey(driver);
    return scoutingTags({
      start: grid?.[k] ?? null,
      avgFinish: season[k]?.avgFinish ?? null,
      toRear: rear.has(driver),
      playoff: playoff.has(k),
    });
  }, [grid, season, rear, playoff]);

  const formFor = useCallback(driver => form[nameKey(driver)] || null, [form]);

  return { weekInfo, ty, grid, season, form, rear, tagsFor, formFor, strategy: getTrackStrategy(ty) };
}
