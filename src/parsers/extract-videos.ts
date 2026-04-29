import type { YouTubeVideoListItem } from "../types.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { parseRawVideoListItem, parseLockupVideoListItem } from "./video-list-item.js";

/**
 * Extract all video list items from a YouTube page data object.
 * Handles two layouts:
 *   1. Legacy `*Renderer` objects with videoId + thumbnail + title.
 *   2. Newer `lockupViewModel` objects with contentType=LOCKUP_CONTENT_TYPE_VIDEO
 *      (used on channel "Videos" tabs as of 2026).
 * Deduplicates by video ID.
 */
export function extractVideos(pageData: Record<string, any>): YouTubeVideoListItem[] {
    const matches = getAllDescendantObjects({
        rootNode: pageData,
        isMatch: ({ node }) => {
            if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
            if (isLockupVideo(node)) return true;
            const keys = Object.keys(node).map((k) => k.toLowerCase());
            const hasVideoId = keys.includes("videoid") || keys.includes("video_id");
            const hasThumbnail = keys.includes("thumbnail") || keys.includes("thumbnails");
            const hasTitle = keys.includes("title");
            return hasVideoId && hasThumbnail && hasTitle;
        },
    });

    const unique = new Map<string, YouTubeVideoListItem>();
    for (const raw of matches) {
        const item = isLockupVideo(raw)
            ? parseLockupVideoListItem(raw)
            : parseRawVideoListItem(raw);
        if (!item.id) continue;
        if (!unique.has(item.id)) unique.set(item.id, item);
    }
    return Array.from(unique.values());
}

function isLockupVideo(node: Record<string, any>): boolean {
    return (
        node.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" &&
        typeof node.contentId === "string" &&
        node.contentImage != null
    );
}
