import fallbackValue from "@pico-brief/fallback_value";
import { findInObject } from "../utils/object.js";
import { parseAgeText } from "./age.js";
import { parseDuration } from "./duration.js";
import type {
    YouTubeVideoListItem,
    YouTubeChannelListItem,
    YouTubePlaylistListItem,
} from "../types.js";

/**
 * Parse a raw YouTube list-item data object into the appropriate typed list item.
 * Returns null if the data doesn't match any known type.
 */
export function parseListItemData(
    data: Record<string, any>
): YouTubeVideoListItem | YouTubeChannelListItem | YouTubePlaylistListItem | null {
    if (data.hasOwnProperty("videoId")) return parseVideoItem(data);
    if (data.hasOwnProperty("channelId")) return parseChannelItem(data);
    if (data.hasOwnProperty("contentId")) return parsePlaylistItem(data);
    return null;
}

// ── Video item ───────────────────────────────────────────────────────────────

function parseVideoItem(data: Record<string, any>): YouTubeVideoListItem {
    const title = data.title.runs[0].text;
    const thumbnail = data.thumbnail.thumbnails[0].url;

    let viewCount: number | undefined = parseInt(
        (data.viewCountText?.simpleText ?? "")
            .toLowerCase()
            .replaceAll(",", "")
            .replaceAll(".", "")
            .replaceAll("views", "")
            .trim()
    );
    if (isNaN(viewCount)) viewCount = undefined;

    const lengthText = data.lengthText?.simpleText ?? null;
    const length = lengthText ? parseDuration(lengthText) : undefined;

    const ageText = data.publishedTimeText?.simpleText ?? null;
    const age = ageText ? parseAgeText(ageText) : undefined;

    const { channelId, channelName, thumbnailUrl } = parseVideoChannelData(data);

    return {
        type: "video",
        id: data.videoId,
        title,
        thumbnail,
        channelName,
        channelThumbnail: thumbnailUrl,
        channelId,
        length,
        viewCount,
        age,
    };
}

function parseVideoChannelData(data: Record<string, any>): {
    thumbnailUrl: string | null;
    channelId: string | null;
    channelName: string | null;
} {
    let thumbnailUrl: string | null = null;

    // Try channelThumbnailWithLinkRenderer
    const channelThumbData = findInObject(data, "channelThumbnailWithLinkRenderer") ?? {};
    const thumbList = findInObject(channelThumbData, "thumbnails") ?? [];
    thumbnailUrl = thumbList[0]?.url ?? null;

    // Fallback: try avatar node
    const avatar = findInObject(data, "avatar") ?? {};
    if (thumbnailUrl === null) {
        const avatarViewModel = findInObject(avatar, "avatarViewModel") ?? {};
        const sources = findInObject(avatarViewModel, "sources") ?? [];
        thumbnailUrl = sources[0]?.url ?? null;
    }

    const parseChannelIdFromUrl = (url: string): string | null => {
        if (url.includes("channel/")) return url.split("/").at(-1) ?? null;
        return null;
    };

    let channelId: string | null = null;
    let channelName: string | null = null;

    // Try multiple byline text nodes for channel info
    const bylineSources = ["longBylineText", "ownerText", "shortBylineText"];
    for (const key of bylineSources) {
        const runs = ((findInObject(data, key) ?? {}).runs ?? [])[0] ?? {};
        if (channelId === null)
            channelId = parseChannelIdFromUrl(findInObject(runs, "url") ?? "");
        if (channelId === null)
            channelId = parseChannelIdFromUrl(findInObject(runs, "canonicalBaseUrl") ?? "");
        if (channelId === null) channelId = findInObject(runs, "browseId") || null;
        if (channelName === null) channelName = findInObject(runs, "text") || null;
    }

    // Fallback: channelThumbnailData
    if (channelId === null)
        channelId = parseChannelIdFromUrl(findInObject(channelThumbData, "url") ?? "");
    if (channelId === null)
        channelId = parseChannelIdFromUrl(findInObject(channelThumbData, "canonicalBaseUrl") ?? "");
    if (channelId === null) channelId = findInObject(channelThumbData, "browseId") || null;

    // Fallback: avatar
    const avatarMeta = findInObject(avatar, "webCommandMetadata") ?? {};
    if (channelId === null)
        channelId = parseChannelIdFromUrl(findInObject(avatarMeta, "url") ?? "");
    if (channelId === null) channelId = findInObject(avatarMeta, "browseId") || null;

    return { thumbnailUrl, channelId, channelName };
}

// ── Channel item ─────────────────────────────────────────────────────────────

function parseChannelItem(data: Record<string, any>): YouTubeChannelListItem {
    const title = fallbackValue(data, "title.simpleText") ?? "";
    const thumbnail = fallbackValue(data, "thumbnail.thumbnails", [])?.at(-1)?.url ?? "";
    const description = fallbackValue(data, "descriptionSnippet.runs", [])?.at(0)?.text ?? "";
    const handle = extractChannelHandle(data);

    return { type: "channel", id: data.channelId, title, thumbnail, description, handle };
}

function extractChannelHandle(data: Record<string, any>): string | null {
    const sources = [
        findInObject(data, "navigationEndpoint") ?? {},
        findInObject(data, "shortBylineText") ?? {},
        findInObject(data, "longBylineText") ?? {},
    ];

    for (const src of sources) {
        for (const key of ["url", "canonicalBaseUrl"]) {
            const handle = extractHandleFromString(findInObject(src, key) ?? "");
            if (handle) return handle;
        }
    }

    // Try subscriberCountText
    const subText = findInObject(data, "subscriberCountText") ?? {};
    const handle = extractHandleFromString(findInObject(subText, "simpleText") ?? "");
    if (handle) return handle;

    return null;
}

function extractHandleFromString(val: string): string | null {
    if (!val.includes("@")) return null;
    return (val.split("@").at(-1) ?? "").split("/")[0] ?? null;
}

// ── Playlist item ────────────────────────────────────────────────────────────

function parsePlaylistItem(data: Record<string, any>): YouTubePlaylistListItem | null {
    const playlistTitle =
        fallbackValue(findInObject(data, "title"), "content") ?? null;
    if (playlistTitle === null) return null;

    let thumbnail: string | null = null;
    const thumbSources = findInObject(findInObject(data, "thumbnailViewModel"), "sources") ?? [];
    if (Array.isArray(thumbSources) && thumbSources.length > 0) {
        const sorted = [...thumbSources]
            .filter((item: any) => {
                const keys = Object.keys(item);
                return keys.includes("url") && keys.includes("width");
            })
            .sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0));
        thumbnail = sorted[0]?.url ?? null;
    }

    let numVideos: number | null = null;
    const badgeVM =
        findInObject(
            findInObject(findInObject(data, "thumbnailViewModel"), "overlays"),
            "thumbnailBadgeViewModel"
        ) ?? {};
    const badgeText = badgeVM.text ?? null;
    if (badgeText && typeof badgeText === "string") {
        numVideos = parseInt(badgeText.replaceAll(",", ""));
        if (isNaN(numVideos)) numVideos = null;
    }

    return { type: "playlist", id: data.contentId, title: playlistTitle, thumbnail, numVideos };
}
