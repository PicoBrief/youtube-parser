import type { YouTubeVideoListItem } from "../types.js";
import type { ItemSpec } from "../dsl/types.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { nodeMatchesItem } from "../dsl/resolver.js";
import { getPathsConfig } from "../dsl/loader.js";
import { parseVideoListItem } from "./video-list-item.js";

/**
 * Extract all video list items from a YouTube page-data tree. An object
 * qualifies as a video item iff every field listed in `spec.required`
 * resolves via at least one of its declared paths — this naturally handles
 * any layout YouTube uses, as long as paths.json has an entry for it.
 * Deduplicates by video ID.
 */
export function extractVideos(
    pageData: Record<string, any>,
    spec?: ItemSpec
): YouTubeVideoListItem[] {
    const itemSpec = spec ?? getPathsConfig().videoListItem;
    const matches = getAllDescendantObjects({
        rootNode: pageData,
        isMatch: ({ node }) => nodeMatchesItem(node, itemSpec),
    });

    const unique = new Map<string, YouTubeVideoListItem>();
    for (const raw of matches) {
        const item = parseVideoListItem(raw, itemSpec);
        if (!item.id || unique.has(item.id)) continue;
        unique.set(item.id, item);
    }
    return Array.from(unique.values());
}
