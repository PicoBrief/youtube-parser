import fallbackValue from "@pico-brief/fallback_value";
import type {
    YouTubeChannelInfo,
    YouTubeVideoListItem,
    PageBackendData,
    HandlerErrorCode,
} from "../types.js";
import { fetchYoutubePage } from "../http/fetch-page.js";
import { fetchNextPage, getContinuationData } from "../http/pagination.js";
import { extractVideos } from "../parsers/extract-videos.js";
import { removeDuplicates } from "../utils/misc.js";

type LoadResult =
    | { success: true; backendData: PageBackendData }
    | { success: false; errorCode: HandlerErrorCode };

export type ChannelParseResult =
    | { success: true; info: YouTubeChannelInfo }
    | { success: false; errorCode: HandlerErrorCode };

const NON_RETRYABLE_ERRORS: HandlerErrorCode[] = ["not_found", "member_only"];

export class YouTubeChannelHandler {
    loadResult: LoadResult | null = null;
    pageData: Record<string, any> = {};
    private _videoListItems: YouTubeVideoListItem[] = [];

    get videoListItems(): YouTubeVideoListItem[] {
        const result = this.parse();
        if (!result.success) return this._videoListItems;
        const info = result.info;
        return this._videoListItems.map((item) => ({
            ...item,
            channelName: info.title,
            channelId: info.id,
            channelThumbnail: info.thumbnailUrl,
        }));
    }

    async load(channelId: string): Promise<LoadResult> {
        let result: LoadResult | null = null;
        let tries = 0;
        while (tries < 3 && (result === null || (!result.success && !NON_RETRYABLE_ERRORS.includes(result.errorCode)))) {
            result = await loadChannel(channelId);
            tries++;
        }
        this.loadResult = result!;
        if (result?.success) {
            this.pageData = result.backendData.pageData;
            this._videoListItems = extractVideos(result.backendData.pageData);
        }
        return result!;
    }

    parse(): ChannelParseResult {
        if (!this.loadResult) return { success: false, errorCode: "not_loaded" };
        if (!this.loadResult.success) return { success: false, errorCode: "not_found" };

        const pageData = this.pageData;
        const meta = pageData.metadata?.channelMetadataRenderer ?? {};
        const pageHeader = pageData.header;

        return {
            success: true,
            info: {
                id: fallbackValue(meta, "externalId") ?? "",
                title: meta.title ?? "",
                description: meta.description ?? "",
                thumbnailUrl: meta.avatar?.thumbnails?.[0]?.url ?? "",
                banner: fallbackValue(
                    pageHeader,
                    "pageHeaderRenderer.content.pageHeaderViewModel.banner.imageBannerViewModel.image.sources[0].url",
                    null
                ),
                rssUrl: meta.rssUrl ?? "",
                channelUrl: meta.channelUrl ?? "",
                vanityChannelUrl: meta.vanityChannelUrl ?? "",
                dataFetchedTime: Math.round(Date.now() / 1000),
            },
        };
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
            getContinuation: getContinuationData,
        });

        const videos = extractVideos(bd.pageData);
        this._videoListItems = removeDuplicates(
            this._videoListItems.concat(videos),
            (v) => v.id
        );
    }
}

async function loadChannel(channelId: string): Promise<LoadResult> {
    const url = `https://www.youtube.com/channel/${channelId}/videos`;
    const fetchResult = await fetchYoutubePage({ url });
    if (!fetchResult.success) return fetchResult;
    if (fetchResult.apiKey === null)
        return { success: false, errorCode: "youtube.apiKey.notFound" };

    const { cookies, proxyUrl, apiKey, clientData, pageData } = fetchResult;
    return {
        success: true,
        backendData: {
            id: channelId,
            apiKey,
            proxyUrl,
            cookies,
            clientData,
            pageData,
            dataFetchedTime: Date.now() / 1000,
        },
    };
}
