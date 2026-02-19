import type { TimeUnit } from "../types.js";

const UNIT_MAP: Record<string, TimeUnit> = {
    second: "second",
    seconds: "second",
    minute: "minute",
    minutes: "minute",
    hour: "hour",
    hours: "hour",
    day: "day",
    days: "day",
    week: "week",
    weeks: "week",
    month: "month",
    months: "month",
    year: "year",
    years: "year",
};

/**
 * Parse a human-readable age string (e.g. "3 days ago") into a structured object.
 * Returns undefined if the string cannot be parsed.
 */
export function parseAgeText(ageString: string): { amount: number; unit: TimeUnit } | undefined {
    const parts = ageString.split(" ");
    if (parts.length !== 3) return undefined;

    const amount = parseInt(parts[0]);
    if (isNaN(amount)) return undefined;

    const unit = UNIT_MAP[parts[1].toLowerCase()];
    if (!unit) return undefined;

    return { amount, unit };
}
