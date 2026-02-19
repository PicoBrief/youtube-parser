import type {
    YouTubeSearchListItem,
    SearchBackendData,
    HandlerErrorCode,
    SearchSortBy,
    SearchResultsType,
} from "../types.js";
import { fetchYoutubePage } from "../http/fetch-page.js";
import { fetchNextPage, getContinuationData } from "../http/pagination.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { parseListItemData } from "../parsers/list-item.js";
import { removeDuplicates } from "../utils/misc.js";
import type { ObjNode } from "../types.js";

type LoadResult =
    | { success: true; backendData: SearchBackendData }
    | { success: false; errorCode: HandlerErrorCode };

export type SearchParseResult =
    | { success: true; items: YouTubeSearchListItem[] }
    | { success: false; errorCode: HandlerErrorCode };

const NON_RETRYABLE_ERRORS: HandlerErrorCode[] = ["not_found", "member_only"];

const SORT_BY_MAP: Record<string, string> = {
    relevance: "A",
    upload_date: "I",
    view_count: "M",
    rating: "E",
};

const RESULTS_TYPE_MAP: Record<string, [string, string]> = {
    video: ["B", "videoRenderer"],
    channel: ["C", "channelRenderer"],
    playlist: ["D", "playlistRenderer"],
    movie: ["E", "videoRenderer"],
};

export class YouTubeSearchHandler {
    loadResult: LoadResult | null = null;
    pageData: Record<string, any> = {};
    private _listItems: YouTubeSearchListItem[] = [];

    get listItems(): YouTubeSearchListItem[] {
        const result = this.parse();
        if (result.success) return this._listItems;
        return [];
    }

    async load(params: {
        query: string;
        sortBy?: SearchSortBy;
        resultsType?: SearchResultsType;
    }): Promise<LoadResult> {
        let result: LoadResult | null = null;
        let tries = 0;
        while (tries < 3 && (result === null || (!result.success && !NON_RETRYABLE_ERRORS.includes(result.errorCode)))) {
            result = await loadSearch(params);
            tries++;
        }
        this.loadResult = result!;
        if (result?.success) {
            this.pageData = result.backendData.pageData;
            this._listItems = extractSearchItems(this.pageData)
                .map(parseListItemData)
                .filter((item): item is YouTubeSearchListItem => item !== null);
        }
        return result!;
    }

    parse(): SearchParseResult {
        return { success: true, items: Array.from(this._listItems) };
    }

    async fetchMoreItems(): Promise<{ success: boolean; errorCode?: HandlerErrorCode }> {
        if (!this.loadResult) return { success: false, errorCode: "not_loaded" };
        if (!this.loadResult.success) return { success: false, errorCode: "not_found" };

        const bd = this.loadResult.backendData;
        bd.pageData = await fetchNextPage({
            endpoint: "search",
            apiKey: bd.apiKey,
            proxyUrl: bd.proxyUrl,
            clientData: bd.clientData,
            pageData: bd.pageData,
            getContinuation: getContinuationData,
        });

        const items = extractSearchItems(bd.pageData)
            .map(parseListItemData)
            .filter((item): item is YouTubeSearchListItem => item !== null);
        this._listItems = removeDuplicates(this._listItems.concat(items), (item) => item.id);

        return { success: true };
    }
}

async function loadSearch(params: {
    query: string;
    sortBy?: SearchSortBy;
    resultsType?: SearchResultsType;
}): Promise<LoadResult> {
    const { query, sortBy = "relevance", resultsType } = params;
    const paramString = resultsType
        ? `CA${SORT_BY_MAP[sortBy]}SAhA${RESULTS_TYPE_MAP[resultsType][0]}`
        : null;

    let url = `https://www.youtube.com/results?search_query=${query}`;
    if (paramString) url += `&sp=${paramString}`;

    const fetchResult = await fetchYoutubePage({ url });
    if (!fetchResult.success) return fetchResult;
    if (fetchResult.apiKey === null)
        return { success: false, errorCode: "youtube.apiKey.notFound" };

    const { cookies, proxyUrl, apiKey, clientData, pageData } = fetchResult;
    return {
        success: true,
        backendData: {
            id: query,
            query,
            apiKey,
            proxyUrl,
            cookies,
            clientData,
            pageData,
            dataFetchedTime: Date.now() / 1000,
        },
    };
}

function extractSearchItems(pageData: any): Record<string, any>[] {
    const isVideoMatch = ({ node, parentKey }: { node: ObjNode; parentKey?: string | null }) => {
        if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
        const keys = Object.keys(node).map((k) => k.toLowerCase());
        return (
            (keys.includes("videoid") || keys.includes("video_id")) &&
            (keys.includes("thumbnail") || keys.includes("thumbnails")) &&
            keys.includes("title") &&
            parentKey === "videoRenderer"
        );
    };

    const isChannelMatch = ({ node, parentKey }: { node: ObjNode; parentKey?: string | null }) => {
        if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
        const keys = Object.keys(node).map((k) => k.toLowerCase());
        return (
            (keys.includes("channelid") || keys.includes("channel_id")) &&
            (keys.includes("thumbnail") || keys.includes("thumbnails")) &&
            keys.includes("title") &&
            parentKey === "channelRenderer"
        );
    };

    const isPlaylistMatch = ({ node, parentKey }: { node: ObjNode; parentKey?: string | null }) => {
        if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
        const keys = Object.keys(node).map((k) => k.toLowerCase());
        return (
            keys.includes("contentid") &&
            keys.includes("contentimage") &&
            keys.includes("contenttype") &&
            (node as any).contentType?.toLowerCase().includes("playlist") &&
            parentKey === "lockupViewModel"
        );
    };

    return getAllDescendantObjects({
        rootNode: pageData,
        isMatch: (data) => isVideoMatch(data) || isChannelMatch(data) || isPlaylistMatch(data),
    });
}
