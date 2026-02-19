// ── Time ──────────────────────────────────────────────────────────────────────

export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

// ── Transcript ───────────────────────────────────────────────────────────────

export type Transcript = {
    snippets: TranscriptSnippet[];
    language?: string;
    language_code: string;
    is_generated: boolean;
};

export type TranscriptSnippet = {
    text: string;
    time: number;
    duration: number;
    speaker?: string;
    locale?: string;
};

// ── Video ────────────────────────────────────────────────────────────────────

export type YouTubeVideoInfo = {
    type: "video";
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    uploadedTime: number | null;
    length: number;
    isLive: boolean;
    isLiveContent: boolean;
    viewCount: number;
    channelId: string;
    author: string;
    isPrivate: boolean;
    availableTranscripts: { name: string; languageCode: string; isGenerated: boolean }[];
    dataFetchedTime: number;
};

export type YouTubeVideoBackendData = {
    id: string;
    apiKey: string;
    proxyUrl: string | null;
    cookies: { [key: string]: string };
    metadata: { [key: string]: any };
    uploadTime: number | null;
    dataFetchedTime: number;
};

export type CaptionTrack = {
    languageCode: string;
    name: string;
    url: string;
    isGenerated: boolean;
};

// ── Channel ──────────────────────────────────────────────────────────────────

export type YouTubeChannelInfo = {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    banner: string | null;
    rssUrl: string;
    channelUrl: string;
    vanityChannelUrl: string;
    dataFetchedTime: number;
};

// ── List items ───────────────────────────────────────────────────────────────

export type YouTubeVideoListItem = {
    type: "video";
    id: string;
    title: string;
    thumbnail: string | null;
    channelName: string | null;
    channelThumbnail: string | null;
    channelId: string | null;
    length?: number;
    viewCount?: number;
    age?: { amount: number; unit: TimeUnit };
};

export type YouTubeChannelListItem = {
    type: "channel";
    id: string;
    title: string;
    thumbnail: string;
    description: string;
    handle: string | null;
};

export type YouTubePlaylistListItem = {
    type: "playlist";
    id: string;
    title: string;
    thumbnail: string | null;
    numVideos: number | null;
};

export type YouTubeSearchListItem =
    | YouTubeVideoListItem
    | YouTubeChannelListItem
    | YouTubePlaylistListItem;

// ── Shared handler types ─────────────────────────────────────────────────────

export type PageBackendData = {
    id: string;
    apiKey: string;
    proxyUrl: string | null;
    cookies: any;
    clientData: { [key: string]: any };
    pageData: { [key: string]: any };
    dataFetchedTime: number;
};

export type SearchBackendData = PageBackendData & { query: string };

export type HandlerErrorCode =
    | "unknown"
    | "not_found"
    | "member_only"
    | "youtube.apiKey.notFound"
    | "not_loaded";

// ── Fetch page types ─────────────────────────────────────────────────────────

export type FetchPageErrorCode = "unknown" | "not_found" | "member_only";

export type FetchPageFailureResponse = {
    success: false;
    errorCode: FetchPageErrorCode;
};

export type FetchPageSuccessResponse = {
    success: true;
    html: string;
    cookies: { [key: string]: string };
    clientData: { [key: string]: any };
    pageData: { [key: string]: any };
    playerData: { [key: string]: any } | null;
    proxyUrl: string | null;
    apiKey: string | null;
};

// ── Search options ───────────────────────────────────────────────────────────

export type SearchSortBy = "relevance" | "upload_date" | "view_count" | "rating";
export type SearchResultsType = "video" | "channel" | "playlist" | "movie";

// ── ObjNode (for object traversal) ──────────────────────────────────────────

export type ObjNode =
    | { [key: string]: any }
    | ObjNode[]
    | number
    | boolean
    | string
    | null
    | undefined;
