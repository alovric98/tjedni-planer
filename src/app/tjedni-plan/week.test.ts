import { describe, expect, it } from "vitest";
import { formatWeekRange, getCurrentWeek } from "./week";

const summary = (iso: string) => {
  const week = getCurrentWeek(new Date(iso));
  return {
    first: `${week[0].dayOfMonth}.${week[0].month}.${week[0].year}`,
    last: `${week[6].dayOfMonth}.${week[6].month}.${week[6].year}`,
    today: week.find((d) => d.isToday)?.dayOfWeek,
    range: formatWeekRange(week),
  };
};

describe("getCurrentWeek", () => {
  it("returns Monday-Sunday with today marked (mid-week)", () => {
    // 2026-09-30 is a Wednesday
    expect(summary("2026-09-30T10:00:00Z")).toEqual({
      first: "28.9.2026",
      last: "4.10.2026",
      today: 3,
      range: "28. rujna – 4. listopada",
    });
  });

  it("treats Sunday as the last day of the week", () => {
    expect(summary("2026-10-04T10:00:00Z")).toMatchObject({ first: "28.9.2026", today: 7 });
  });

  it("treats Monday as the first day of the week", () => {
    expect(summary("2026-09-28T10:00:00Z")).toMatchObject({ first: "28.9.2026", today: 1 });
  });

  it("uses Zagreb time, not UTC, around midnight", () => {
    // 22:30 UTC on Wed 30 Sep = 00:30 CEST on Thu 1 Oct
    expect(summary("2026-09-30T22:30:00Z")).toMatchObject({ today: 4, first: "28.9.2026" });
  });

  it("handles a week that crosses the year boundary", () => {
    // 23:30 UTC on Thu 31 Dec = 00:30 CET on Fri 1 Jan 2027
    expect(summary("2026-12-31T23:30:00Z")).toEqual({
      first: "28.12.2026",
      last: "3.1.2027",
      today: 5,
      range: "28. prosinca – 3. siječnja 2027.",
    });
  });

  it("omits the repeated month when the week stays inside one month", () => {
    expect(summary("2026-10-14T10:00:00Z").range).toBe("12. – 18. listopada");
  });

  it("numbers days 1..7 and marks exactly one day as today", () => {
    const week = getCurrentWeek(new Date("2026-09-30T10:00:00Z"));
    expect(week.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
  });
});
