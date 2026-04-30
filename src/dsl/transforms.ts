import { parseAgeText } from "../parsers/age.js";
import { parseDuration } from "../parsers/duration.js";
import type { Transform } from "./types.js";

/**
 * Multipliers for abbreviation suffixes. Locale-aware: K/万 are NOT the same
 * (K = 10³ = 1,000 vs 万 = 10⁴ = 10,000). Likewise 亿/億 = 10⁸, not 10⁹.
 */
const SUFFIX_MULTIPLIERS: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
    t: 1_000_000_000_000,
    千: 1_000,
    万: 10_000,
    萬: 10_000,
    亿: 100_000_000,
    億: 100_000_000,
};

const ABBREV_REGEX = /([\d.,]+)\s*([kmbtKMBT千万萬亿億])?/;

/**
 * Parse a count string into a number. Handles plain integers, comma-separated
 * thousands, and abbreviations (K/M/B/T + CJK 千/万/萬/亿/億). Strips
 * surrounding words like "views" so it can run on raw label text.
 *
 * Examples: "1,234 views" → 1234, "9.1K views" → 9100, "9.1万" → 91000.
 */
function abbreviated_count(input: unknown): number | undefined {
    if (typeof input === "number") return input;
    if (typeof input !== "string") return undefined;
    const match = input.match(ABBREV_REGEX);
    if (!match) return undefined;
    const numeric = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(numeric)) return undefined;
    const suffix = match[2];
    if (!suffix) return Math.round(numeric);
    const mult = SUFFIX_MULTIPLIERS[suffix.toLowerCase()];
    if (mult === undefined) return Math.round(numeric);
    return Math.round(numeric * mult);
}

/** Parse "mm:ss" / "hh:mm:ss" / "dd:hh:mm:ss" → seconds. */
function duration(input: unknown): number | undefined {
    if (typeof input !== "string") return undefined;
    return parseDuration(input);
}

/** Parse "3 days ago" / "9d ago" → { amount, unit } or undefined. */
function age_text(input: unknown): ReturnType<typeof parseAgeText> {
    if (typeof input !== "string") return undefined;
    return parseAgeText(input);
}

/**
 * Extract a channel ID from a URL like "/channel/UCxxx" or
 * "https://youtube.com/channel/UCxxx". Returns null if the input doesn't
 * contain a `/channel/` segment.
 */
function id_from_channel_url(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const match = input.match(/\/channel\/([^/?#]+)/);
    return match ? match[1] : null;
}

function to_int(input: unknown): number | undefined {
    if (typeof input === "number") return Math.trunc(input);
    if (typeof input !== "string") return undefined;
    const n = parseInt(input.replace(/,/g, ""), 10);
    return isNaN(n) ? undefined : n;
}

/** Trim surrounding whitespace; pass through non-strings unchanged. */
function trim(input: unknown): unknown {
    return typeof input === "string" ? input.trim() : input;
}

export const TRANSFORMS: Record<string, Transform> = {
    abbreviated_count,
    duration,
    age_text,
    id_from_channel_url,
    to_int,
    trim,
};

/** Apply one or more named transforms left-to-right. */
export function applyTransforms(value: unknown, names: string | string[] | undefined): unknown {
    if (names === undefined) return value;
    const list = Array.isArray(names) ? names : [names];
    let current = value;
    for (const name of list) {
        const fn = TRANSFORMS[name];
        if (!fn) throw new Error(`Unknown transform: ${name}`);
        current = fn(current);
        if (current === undefined || current === null) return current;
    }
    return current;
}
