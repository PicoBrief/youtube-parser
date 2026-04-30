import type { YouTubeVideoListItem } from "../types.js";
import type { ItemSpec } from "../dsl/types.js";
import { resolveItem } from "../dsl/resolver.js";
import { getPathsConfig } from "../dsl/loader.js";

/**
 * Parse a raw YouTube video item (legacy `*Renderer` or new `lockupViewModel`)
 * into a YouTubeVideoListItem using the path-DSL spec. The default spec is
 * read from the bundled paths.json; pass `spec` to override per call.
 */
export function parseVideoListItem(
    raw: Record<string, any>,
    spec?: ItemSpec
): YouTubeVideoListItem {
    const itemSpec = spec ?? getPathsConfig().videoListItem;
    const r = resolveItem(raw, itemSpec);
    return {
        type: "video",
        id: (r.id as string) ?? "",
        title: (r.title as string) ?? "(Video Title)",
        thumbnail: (r.thumbnail as string | null) ?? null,
        viewCount: typeof r.viewCount === "number" ? r.viewCount : undefined,
        length: typeof r.length === "number" ? r.length : undefined,
        age: (r.age as YouTubeVideoListItem["age"]) ?? undefined,
        channelName: (r.channelName as string | null) ?? null,
        channelId: (r.channelId as string | null) ?? null,
        channelThumbnail: (r.channelThumbnail as string | null) ?? null,
    };
}
