import { DOMParser } from "xmldom";
import type { TranscriptSnippet, CaptionTrack, YouTubeVideoBackendData } from "../types.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { getXMLDescendantNodes } from "../utils/xml.js";
import { unescapeHtml } from "../utils/html.js";
import { findInObject } from "../utils/object.js";
import { isJSON, getBaseLanguageCode } from "../utils/misc.js";
import { makeHttpRequest } from "../http/request.js";
import fallbackValue from "@pico-brief/fallback_value";

/**
 * Extract caption tracks from video metadata.
 */
export function parseCaptionTracks(metadata: Record<string, any>): CaptionTrack[] | null {
    const tracks = findInObject(metadata, "captionTracks") as Record<string, any>[] | null;
    if (!tracks) return null;

    return tracks
        .map((t) => {
            const languageCode: string | null = t.languageCode ?? null;
            let url: string | null = t.baseUrl ?? null;
            if (!languageCode || !url) return null;
            url = url.replace("&fmt=srv3", "");
            const name = fallbackValue(t, "name.runs[0].text");
            const isGenerated = fallbackValue(t, "kind") === "asr";
            return { languageCode, url, name, isGenerated };
        })
        .filter((t): t is CaptionTrack => t !== null);
}

/**
 * Fetch and parse a transcript for a specific language.
 */
export async function fetchTranscript(
    backendData: YouTubeVideoBackendData,
    languageCode: string
): Promise<{
    snippets: TranscriptSnippet[];
    language: string;
    language_code: string;
    is_generated: boolean;
} | null> {
    const tracks = parseCaptionTracks(backendData.metadata);
    if (!tracks?.length) return null;

    // Find matching track: exact match first, then base language code
    let matched = tracks.filter((t) => t.languageCode === languageCode);
    if (matched.length === 0) {
        matched = tracks.filter(
            (t) => getBaseLanguageCode(t.languageCode) === getBaseLanguageCode(languageCode)
        );
    }
    if (matched.length === 0) return null;

    const track = matched[0];
    let transcriptUrl = track.url.replace("&fmt=srv3", "");

    const response = await makeHttpRequest({ url: transcriptUrl, proxyUrl: backendData.proxyUrl });

    const snippets = isJSON(response.text)
        ? parseTranscriptJSON(response.text)
        : parseTranscriptXml(response.text);

    return {
        snippets,
        language: track.name,
        language_code: track.languageCode,
        is_generated: track.isGenerated,
    };
}

// ── JSON3 transcript format ──────────────────────────────────────────────────

const START_MS_KEYS = ["tstartms", "startms"];
const START_SEC_KEYS = ["tstart", "start"];
const DURATION_MS_KEYS = ["ddurationms", "durationms"];
const DURATION_SEC_KEYS = ["dduration", "duration"];
const ENCODINGS = ["utf8", "utf-8", "utf16", "utf-16", "unicode"];

export function parseTranscriptJSON(text: string): TranscriptSnippet[] {
    const rawData = JSON.parse(text);

    const rawSnippets = getAllDescendantObjects({
        rootNode: rawData,
        isMatch: ({ node }) => {
            if (!node || typeof node !== "object" || Array.isArray(node)) return false;
            const keys = Object.keys(node).map((k) => k.toLowerCase());
            return [...START_MS_KEYS, ...START_SEC_KEYS].some((k) => keys.includes(k));
        },
    });

    return rawSnippets
        .map((raw) => {
            const keys = Object.keys(raw);

            // Parse start time
            let time = NaN;
            for (const key of keys) {
                const lk = key.toLowerCase();
                if (START_MS_KEYS.includes(lk)) { time = raw[key] / 1000; break; }
                if (START_SEC_KEYS.includes(lk)) { time = raw[key]; break; }
            }

            // Parse duration
            let duration = NaN;
            for (const key of keys) {
                const lk = key.toLowerCase();
                if (DURATION_MS_KEYS.includes(lk)) { duration = raw[key] / 1000; break; }
                if (DURATION_SEC_KEYS.includes(lk)) { duration = raw[key]; break; }
            }

            // Parse text segments
            const segs: string[] = (raw.segs ?? [])
                .map((seg: Record<string, any>) => {
                    const segKeys = Object.keys(seg);
                    if (segKeys.length === 0) return null;
                    for (const enc of ENCODINGS) {
                        if (segKeys.includes(enc)) return seg[enc];
                    }
                    for (const k of segKeys) {
                        if (typeof seg[k] === "string") return seg[k];
                    }
                    return null;
                })
                .filter((txt: string | null): txt is string => txt !== null);

            if (segs.length === 0) return null;
            return { time, duration, text: segs.join(" ") };
        })
        .filter((s): s is TranscriptSnippet => s !== null);
}

// ── XML transcript format ────────────────────────────────────────────────────

const HTML_TAG_REGEX = /<[^>]*>/gi;

export function parseTranscriptXml(xmlText: string): TranscriptSnippet[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const hasVal = (v: any) => v !== null && v !== undefined && v !== "";

    const elements = getXMLDescendantNodes(doc, (cn: Node) => {
        if (cn.nodeType !== 1) return false;
        const el = cn as Element;
        return hasVal(el.getAttribute("t")) || hasVal(el.getAttribute("start"));
    });

    return elements.map((element) => {
        const el = element as any;
        const rawText = el.textContent || "";
        const text = unescapeHtml(rawText.replace(HTML_TAG_REGEX, ""));

        const start = el.getAttribute("start");
        const t = el.getAttribute("t");
        const time = hasVal(start) ? parseFloat(start) : hasVal(t) ? parseFloat(t) / 1000 : 0;

        const d = el.getAttribute("d");
        const dur = el.getAttribute("dur");
        const duration = hasVal(dur) ? parseFloat(dur) : hasVal(d) ? parseFloat(d) / 1000 : 0;

        return { text, time, duration };
    });
}
