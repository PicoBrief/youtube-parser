import type {
    YouTubeVideoListItem,
    PageBackendData,
    HandlerErrorCode,
} from "../types.js";
import { fetchYoutubePage } from "../http/fetch-page.js";
import { fetchNextPage, getContinuationDataDeep } from "../http/pagination.js";
import { extractVideos } from "../parsers/extract-videos.js";
import { removeDuplicates } from "../utils/misc.js";

type LoadResult =
    | { success: true; backendData: PageBackendData }
    | { success: false; errorCode: HandlerErrorCode };

export type PlaylistParseResult =
    | { success: true; items: YouTubeVideoListItem[] }
    | { success: false; errorCode: HandlerErrorCode };

const NON_RETRYABLE_ERRORS: HandlerErrorCode[] = ["not_found", "member_only"];

export class YouTubePlaylistHandler {
    loadResult: LoadResult | null = null;
    pageData: Record<string, any> = {};
    private _videoListItems: YouTubeVideoListItem[] = [];

    get videoListItems(): YouTubeVideoListItem[] {
        const result = this.parse();
        if (result.success) return this._videoListItems;
        return [];
    }

    async load(playlistId: string): Promise<LoadResult> {
        let result: LoadResult | null = null;
        let tries = 0;
        while (tries < 3 && (result === null || (!result.success && !NON_RETRYABLE_ERRORS.includes(result.errorCode)))) {
            result = await loadPlaylist(playlistId);
            tries++;
        }
        this.loadResult = result!;
        if (result?.success) {
            this.pageData = result.backendData.pageData;
            this._videoListItems = extractVideos(result.backendData.pageData);
        }
        return result!;
    }

    parse(): PlaylistParseResult {
        if (!this.loadResult) return { success: false, errorCode: "not_loaded" };
        if (!this.loadResult.success) return { success: false, errorCode: "not_found" };
        return { success: true, items: this._videoListItems };
    }

    async fetchMoreVideos(): Promise<void> {
        if (!this.loadResult?.success) return;
        const bd = this.loadResult.backendData;
        bd.pageData = await fetchNextPage({
            endpoint: "browse",
            apiKey: bd.apiKey,
            proxyUrl: bd.proxyUrl,
            clientData: bd.clientData,
            pageData: bd.pageData,
            getContinuation: getContinuationDataDeep,
        });

        const videos = extractVideos(bd.pageData);
        this._videoListItems = removeDuplicates(
            this._videoListItems.concat(videos),
            (v) => v.id
        );
    }
}

async function loadPlaylist(playlistId: string): Promise<LoadResult> {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const fetchResult = await fetchYoutubePage({ url });
    if (!fetchResult.success) return fetchResult;
    if (fetchResult.apiKey === null)
        return { success: false, errorCode: "youtube.apiKey.notFound" };

    const { cookies, proxyUrl, apiKey, clientData, pageData } = fetchResult;
    return {
        success: true,
        backendData: {
            id: playlistId,
            apiKey,
            proxyUrl,
            cookies,
            clientData,
            pageData,
            dataFetchedTime: Date.now() / 1000,
        },
    };
}
