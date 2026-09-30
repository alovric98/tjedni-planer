const TIME_ZONE = "Europe/Zagreb";

// Genitive ("28. rujna") because the date is shown as part of a phrase, not as a title.
const MONTHS_GENITIVE = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
];

const SHORT_DAY_LABELS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

export type WeekDay = {
  /** 1 = Monday ... 7 = Sunday (same as `weekly_plan_days.day_of_week`). */
  dayOfWeek: number;
  shortLabel: string;
  dayOfMonth: number;
  /** 1-12 */
  month: number;
  year: number;
  isToday: boolean;
};

/** Calendar date in Zagreb for the given instant (the server runs in UTC). */
function zonedDate(now: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The Monday-Sunday week containing `now`, computed in the Zagreb time zone
 * rather than the server's - otherwise between 00:00 and 02:00 Croatian time
 * the previous day would still be shown as "today".
 */
export function getCurrentWeek(now: Date = new Date(), timeZone: string = TIME_ZONE): WeekDay[] {
  const today = zonedDate(now, timeZone);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const todayIndex = (new Date(todayUtc).getUTCDay() + 6) % 7; // 0 = Monday
  const mondayUtc = todayUtc - todayIndex * 86_400_000;

  return SHORT_DAY_LABELS.map((shortLabel, i) => {
    const d = new Date(mondayUtc + i * 86_400_000);
    return {
      dayOfWeek: i + 1,
      shortLabel,
      dayOfMonth: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      year: d.getUTCFullYear(),
      isToday: i === todayIndex,
    };
  });
}

/** "28. rujna – 4. listopada" (year only when the week spans two years). */
export function formatWeekRange(week: WeekDay[]): string {
  const first = week[0];
  const last = week[week.length - 1];
  const start =
    first.month === last.month
      ? `${first.dayOfMonth}.`
      : `${first.dayOfMonth}. ${MONTHS_GENITIVE[first.month - 1]}`;
  const end = `${last.dayOfMonth}. ${MONTHS_GENITIVE[last.month - 1]}`;
  const year = first.year === last.year ? "" : ` ${last.year}.`;
  return `${start} – ${end}${year}`;
}
