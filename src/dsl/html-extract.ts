import { getPathsConfig } from "./loader.js";
import type { HtmlBlockPattern, HtmlExtractConfig } from "./types.js";

/**
 * Extract the InnerTube API key from raw YouTube HTML by trying each
 * configured regex pattern. Returns null if none match.
 */
export function extractApiKey(html: string, config?: HtmlExtractConfig): string | null {
    const cfg = config ?? getPathsConfig().html;
    for (const pattern of cfg.apiKey.patterns) {
        const m = html.match(new RegExp(pattern));
        if (m && m[1]) return m[1];
    }
    return null;
}

/**
 * Extract a named JSON block from the HTML, trying each configured pattern in
 * order. Returns the parsed JSON of the first pattern whose extraction parses
 * successfully, or null if no pattern works.
 */
export function extractJsonBlock(
    html: string,
    blockName: string,
    config?: HtmlExtractConfig
): any | null {
    const cfg = config ?? getPathsConfig().html;
    const patterns = cfg.blocks[blockName];
    if (!patterns) return null;
    for (const p of patterns) {
        const body = sliceByMarkers(html, p);
        if (body === null) continue;
        try {
            return JSON.parse(body + p.suffix);
        } catch {
            // try next pattern
        }
    }
    return null;
}

function sliceByMarkers(html: string, p: HtmlBlockPattern): string | null {
    const keyAt = html.indexOf(p.key);
    if (keyAt < 0) return null;
    const start = keyAt + p.key.length + p.numChars;
    const end = html.indexOf(p.stop, start);
    if (end < 0) return null;
    return html.substring(start, end);
}
