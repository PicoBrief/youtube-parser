import fallbackValue from "@pico-brief/fallback_value";
import type { YouTubeVideoListItem } from "../types.js";
import { parseAgeText } from "./age.js";
import { parseDuration } from "./duration.js";

const ABBREV_MULTIPLIERS: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
};

function parseAbbreviatedCount(text: string): number | undefined {
    const cleaned = text.toLowerCase().replace(/views?/g, "").replace(/,/g, "").trim();
    const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/);
    if (!match) {
        const n = parseInt(cleaned);
        return isNaN(n) ? undefined : n;
    }
    const num = parseFloat(match[1]);
    if (isNaN(num)) return undefined;
    const mult = match[2] ? ABBREV_MULTIPLIERS[match[2]] ?? 1 : 1;
    return Math.round(num * mult);
}

/**
 * Parse a YouTube `lockupViewModel` (LOCKUP_CONTENT_TYPE_VIDEO) into a YouTubeVideoListItem.
 * This is the newer ViewModel-based layout YouTube has begun using on channel video tabs.
 */
export function parseLockupVideoListItem(raw: Record<string, any>): YouTubeVideoListItem {
    const id: string = raw.contentId;
    const title: string =
        fallbackValue(raw, "metadata.lockupMetadataViewModel.title.content") ?? "(Video Title)";
    const thumbnail: string | null =
        fallbackValue(raw, "contentImage.thumbnailViewModel.image.sources[0].url") ?? null;

    let length: number | undefined;
    const overlays: any[] =
        fallbackValue(raw, "contentImage.thumbnailViewModel.overlays", [])! ?? [];
    for (const ov of overlays) {
        const badges: any[] =
            fallbackValue(ov, "thumbnailBottomOverlayViewModel.badges", [])! ?? [];
        for (const b of badges) {
            const text = fallbackValue(b, "thumbnailBadgeViewModel.text");
            if (typeof text === "string" && /^\d+(:\d+){1,2}$/.test(text)) {
                length = parseDuration(text);
                break;
            }
        }
        if (length !== undefined) break;
    }

    let viewCount: number | undefined;
    let age: ReturnType<typeof parseAgeText>;
    const rows: any[] = fallbackValue(
        raw,
        "metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows",
        []
    )! ?? [];
    for (const row of rows) {
        const parts: any[] = row?.metadataParts ?? [];
        for (const part of parts) {
            const text: string | undefined = part?.text?.content;
            if (!text) continue;
            if (/view/i.test(text) && viewCount === undefined) {
                viewCount = parseAbbreviatedCount(text);
            } else if (/ago/i.test(text) && !age) {
                age = parseAgeText(text);
            }
        }
    }

    return {
        id,
        type: "video",
        title,
        thumbnail,
        viewCount,
        length,
        age,
        channelName: null,
        channelId: null,
        channelThumbnail: null,
    };
}

/**
 * Parse a raw YouTube video renderer object into a YouTubeVideoListItem.
 */
export function parseRawVideoListItem(raw: Record<string, any>): YouTubeVideoListItem {
    const { videoId } = raw;

    let title = fallbackValue(raw, "title.runs[0].text", null);
    if (!title) title = fallbackValue(raw, "title.simpleText", "(Video Title)")!;

    const thumbnail = fallbackValue(raw, "thumbnail.thumbnails[0].url");

    // View count
    const viewCountText: string = fallbackValue(raw, "viewCountText.simpleText", "")!;
    let viewCount: number | undefined = parseInt(
        viewCountText.toLowerCase().replaceAll(",", "").replaceAll(".", "").replaceAll("views", "").trim()
    );
    if (isNaN(viewCount)) viewCount = undefined;

    // Length
    const lengthText = fallbackValue(raw, "lengthText.simpleText");
    const length = lengthText ? parseDuration(lengthText) : undefined;

    // Age
    const ageText = fallbackValue(raw, "publishedTimeText.simpleText");
    const age = ageText ? parseAgeText(ageText) : undefined;

    // Channel info
    let channelName: string | null = null;
    let channelId: string | null = null;
    const shortBylineText: any = fallbackValue(raw, "shortBylineText.runs[0]");
    if (shortBylineText) {
        channelName = shortBylineText.text ?? null;
        channelId = fallbackValue(shortBylineText, "navigationEndpoint.browseEndpoint.browseId") ?? null;
    }

    return {
        id: videoId,
        type: "video",
        title,
        thumbnail,
        viewCount,
        length,
        age,
        channelName,
        channelId,
        channelThumbnail: null,
    };
}
