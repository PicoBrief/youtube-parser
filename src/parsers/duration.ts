/**
 * Parse a duration string like "1:23", "1:02:03", or "1:02:03:04" into seconds.
 * Returns undefined if the format is unrecognized.
 */
export function parseDuration(text: string): number | undefined {
    const parts = text.split(":").map((p) => parseInt(p));
    if (parts.some(isNaN)) return undefined;

    switch (parts.length) {
        case 2:
            return parts[0] * 60 + parts[1];
        case 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        case 4:
            return parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3];
        default:
            return undefined;
    }
}
