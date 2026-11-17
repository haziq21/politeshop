import { format, isSameYear } from "date-fns";

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Weekday, day and month, with the year only if it differs from `today`'s */
export const dayTitle = (d: Date, today: Date) => format(d, `EEEE d MMM${isSameYear(d, today) ? "" : " yyyy"}`);
