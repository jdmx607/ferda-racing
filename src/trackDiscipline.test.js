import { describe, test, expect } from "vitest";
import { DISCIPLINE, disciplineOf, multLabel, trackSpecTag, TRACK_MILES } from "./trackDiscipline.js";
import { SCHEDULES } from "./constants.js";

describe("track disciplines", () => {
  test("accent, label and code per discipline", () => {
    expect(DISCIPLINE.short_track).toMatchObject({ code: "ST", accent: "#F97316", label: "BULLRING" });
    expect(DISCIPLINE.road_course).toMatchObject({ code: "RC", accent: "#8B5CF6", label: "ROAD COURSE" });
    expect(DISCIPLINE.intermediate).toMatchObject({ code: "INT", accent: "#38BDF8", label: "INTERMEDIATE" });
    expect(DISCIPLINE.superspeedway).toMatchObject({ code: "SS", accent: "#22C55E", label: "SUPERSPEEDWAY" });
    expect(disciplineOf("nope")).toBeNull();
  });
  test("multiplier labels always show one decimal", () => {
    expect(multLabel("short_track")).toBe("ST ×0.2");
    expect(multLabel("road_course")).toBe("RC ×1.5");
    expect(multLabel("intermediate")).toBe("INT ×0.5");
    expect(multLabel("superspeedway")).toBe("SS ×1.0");
    expect(multLabel("nope")).toBe("");
  });
  test("spec + strategy tags", () => {
    expect(trackSpecTag("short_track", "Martinsville")).toBe("BULLRING • PD > LAPS");
    expect(trackSpecTag("road_course", "Sonoma")).toBe("LEFT & RIGHT • ×1.5 LAPS");
    expect(trackSpecTag("intermediate", "Homestead")).toBe("1.5 MI OVAL • TIRE WEAR");
    expect(trackSpecTag("intermediate", "Michigan")).toBe("2.0 MI OVAL • TIRE WEAR");
    expect(trackSpecTag("intermediate", "Somewhere New")).toBe("OVAL • TIRE WEAR");
    expect(trackSpecTag("superspeedway", "Talladega")).toBe("PACK DRAFT • SURVIVAL");
  });
  test("every intermediate on the 2026 and 2027 schedules has a length", () => {
    const ints = new Set(Object.values(SCHEDULES).flat().filter(s => s.ty === "intermediate").map(s => s.t));
    expect([...ints].filter(t => !TRACK_MILES[t])).toEqual([]);
  });
});
