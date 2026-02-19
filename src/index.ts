// ── Configuration ────────────────────────────────────────────────────────────
export { configure } from "./config.js";

// ── Handlers ─────────────────────────────────────────────────────────────────
export { YouTubeVideoHandler, parseBackendData } from "./handlers/video.js";
export type { VideoLoadResult, VideoParseResult } from "./handlers/video.js";

export { YouTubeChannelHandler } from "./handlers/channel.js";
export type { ChannelParseResult } from "./handlers/channel.js";

export { YouTubePlaylistHandler } from "./handlers/playlist.js";
export type { PlaylistParseResult } from "./handlers/playlist.js";

export { YouTubeSearchHandler } from "./handlers/search.js";
export type { SearchParseResult } from "./handlers/search.js";

// ── Parsers ──────────────────────────────────────────────────────────────────
export { extractVideos } from "./parsers/extract-videos.js";
export { parseRawVideoListItem } from "./parsers/video-list-item.js";
export { parseListItemData } from "./parsers/list-item.js";
export { parseAgeText } from "./parsers/age.js";
export { parseDuration } from "./parsers/duration.js";
export { parseTranscriptJSON, parseTranscriptXml } from "./parsers/transcript.js";

// ── HTTP ─────────────────────────────────────────────────────────────────────
export { fetchYoutubePage } from "./http/fetch-page.js";

// ── Utilities ────────────────────────────────────────────────────────────────
export { extractInnerTubeApiKey } from "./utils/html.js";

// ── Types ────────────────────────────────────────────────────────────────────
export type {
    // Core types
    TimeUnit,
    Transcript,
    TranscriptSnippet,

    // Video
    YouTubeVideoInfo,
    YouTubeVideoBackendData,
    CaptionTrack,

    // Channel
    YouTubeChannelInfo,

    // List items
    YouTubeVideoListItem,
    YouTubeChannelListItem,
    YouTubePlaylistListItem,
    YouTubeSearchListItem,

    // Fetch page
    FetchPageSuccessResponse,
    FetchPageFailureResponse,
    FetchPageErrorCode,

    // Search options
    SearchSortBy,
    SearchResultsType,

    // Handler
    HandlerErrorCode,
} from "./types.js";
