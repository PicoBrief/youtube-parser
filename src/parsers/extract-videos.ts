import type { YouTubeVideoListItem } from "../types.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { parseRawVideoListItem } from "./video-list-item.js";

/**
 * Extract all video list items from a YouTube page data object.
 * Finds all objects that look like video renderers (have videoId + thumbnail + title),
 * deduplicates by video ID.
 */
export function extractVideos(pageData: Record<string, any>): YouTubeVideoListItem[] {
    const rawList = getAllDescendantObjects({
        rootNode: pageData,
        isMatch: ({ node }) => {
            if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
            const keys = Object.keys(node).map((k) => k.toLowerCase());
            const hasVideoId = keys.includes("videoid") || keys.includes("video_id");
            const hasThumbnail = keys.includes("thumbnail") || keys.includes("thumbnails");
            const hasTitle = keys.includes("title");
            return hasVideoId && hasThumbnail && hasTitle;
        },
    });

    const unique = new Map<string, YouTubeVideoListItem>();
    for (const raw of rawList) {
        const item = parseRawVideoListItem(raw);
        unique.set(item.id, item);
    }
    return Array.from(unique.values());
}
