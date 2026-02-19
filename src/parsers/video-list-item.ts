import fallbackValue from "@pico-brief/fallback_value";
import type { YouTubeVideoListItem } from "../types.js";
import { parseAgeText } from "./age.js";
import { parseDuration } from "./duration.js";

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
