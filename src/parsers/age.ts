import type { TimeUnit } from "../types.js";

const UNIT_MAP: Record<string, TimeUnit> = {
    second: "second",
    seconds: "second",
    sec: "second",
    s: "second",
    minute: "minute",
    minutes: "minute",
    min: "minute",
    m: "minute",
    hour: "hour",
    hours: "hour",
    hr: "hour",
    h: "hour",
    day: "day",
    days: "day",
    d: "day",
    week: "week",
    weeks: "week",
    w: "week",
    month: "month",
    months: "month",
    mo: "month",
    year: "year",
    years: "year",
    yr: "year",
    y: "year",
};

/**
 * Parse a human-readable age string (e.g. "3 days ago" or "9d ago") into a structured object.
 * Returns undefined if the string cannot be parsed.
 */
export function parseAgeText(ageString: string): { amount: number; unit: TimeUnit } | undefined {
    const parts = ageString.split(" ");

    // Standard format: "3 days ago"
    if (parts.length === 3) {
        const amount = parseInt(parts[0]);
        if (isNaN(amount)) return undefined;
        const unit = UNIT_MAP[parts[1].toLowerCase()];
        if (!unit) return undefined;
        return { amount, unit };
    }

    // Abbreviated format: "9d ago" or "2h ago"
    if (parts.length === 2) {
        const match = parts[0].match(/^(\d+)([a-zA-Z]+)$/);
        if (!match) return undefined;
        const amount = parseInt(match[1]);
        if (isNaN(amount)) return undefined;
        const unit = UNIT_MAP[match[2].toLowerCase()];
        if (!unit) return undefined;
        return { amount, unit };
    }

    return undefined;
}
