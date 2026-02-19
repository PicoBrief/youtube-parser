import type {
    YouTubeVideoInfo,
    YouTubeVideoBackendData,
    CaptionTrack,
    HandlerErrorCode,
    Transcript,
} from "../types.js";
import { fetchYoutubePage } from "../http/fetch-page.js";
import { makeHttpRequest } from "../http/request.js";
import { isTrue } from "../utils/misc.js";
import { findInObject } from "../utils/object.js";
import { parseCaptionTracks, fetchTranscript } from "../parsers/transcript.js";
import { DateTime } from "luxon";

export type VideoLoadResult =
    | { success: true; backendData: YouTubeVideoBackendData }
    | { success: false; errorCode: HandlerErrorCode };

export type VideoParseResult =
    | { success: true; info: YouTubeVideoInfo; captionTracks: CaptionTrack[] | null }
    | { success: false; errorCode: HandlerErrorCode };

const NON_RETRYABLE_ERRORS: HandlerErrorCode[] = ["not_found", "member_only"];

export class YouTubeVideoHandler {
    loadResult: VideoLoadResult | null = null;

    async load(videoId: string): Promise<VideoLoadResult> {
        let result: VideoLoadResult | null = null;
        let tries = 0;
        while (tries < 3 && (result === null || (!result.success && !NON_RETRYABLE_ERRORS.includes(result.errorCode)))) {
            result = await loadVideo(videoId);
            tries++;
        }
        this.loadResult = result!;
        return result!;
    }

    parse(): VideoParseResult {
        if (!this.loadResult) return { success: false, errorCode: "not_loaded" };
        if (!this.loadResult.success) return { success: false, errorCode: "not_found" };
        return parseBackendData(this.loadResult.backendData);
    }

    async fetchTranscript(languageCode: string): Promise<Transcript | null> {
        if (!this.loadResult?.success) return null;
        return fetchTranscript(this.loadResult.backendData, languageCode);
    }
}

async function loadVideo(videoId: string): Promise<VideoLoadResult> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const fetchResult = await fetchYoutubePage({ url });
    if (!fetchResult.success) return fetchResult;
    if (fetchResult.apiKey === null) return { success: false, errorCode: "youtube.apiKey.notFound" };

    const { cookies, proxyUrl, apiKey } = fetchResult;
    const metadataResult = await getVideoMetadata({ videoId, apiKey, proxyUrl });
    if (!metadataResult.success) return metadataResult;

    let uploadTime = findInObject(fetchResult as Record<string, any>, "uploadDate") ?? null;
    if (uploadTime === null) uploadTime = findInObject(fetchResult as Record<string, any>, "publishDate") ?? null;
    if (typeof uploadTime === "string") uploadTime = DateTime.fromISO(uploadTime).toSeconds();
    if (typeof uploadTime !== "number") uploadTime = null;

    return {
        success: true,
        backendData: {
            id: videoId,
            apiKey,
            proxyUrl,
            cookies,
            metadata: metadataResult.metadata,
            uploadTime,
            dataFetchedTime: Date.now() / 1000,
        },
    };
}

async function getVideoMetadata(params: {
    videoId: string;
    apiKey: string;
    proxyUrl: string | null;
}): Promise<{ success: true; metadata: Record<string, any> } | { success: false; errorCode: HandlerErrorCode }> {
    const { videoId, apiKey, proxyUrl } = params;
    const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;

    const response = await makeHttpRequest({
        url,
        proxyUrl,
        method: "POST",
        requestData: JSON.stringify({
            context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
            videoId,
        }),
    });

    if (response.status >= 400) return { success: false, errorCode: "unknown" };

    const metadata: Record<string, any> = JSON.parse(response.text);
    const { playabilityStatus } = metadata;
    if (playabilityStatus && playabilityStatus.status !== "OK") {
        const reason: string = playabilityStatus.reason ?? "";
        if (reason.includes("unavailable") || reason.includes("not available") || reason.includes("not exist")) {
            return { success: false, errorCode: "not_found" };
        }
        if (reason.includes("member")) return { success: false, errorCode: "member_only" };
        return { success: false, errorCode: "unknown" };
    }

    return { success: true, metadata };
}

/**
 * Parse raw backend data into structured video info and caption tracks.
 */
export function parseBackendData(backendData: YouTubeVideoBackendData): VideoParseResult {
    const { metadata } = backendData;
    const videoDetails = metadata.videoDetails ?? {};

    const thumbnails: { url: string; width: number; height: number }[] =
        videoDetails.thumbnail?.thumbnails ?? [];
    thumbnails.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

    let uploadedTime: number | null = backendData.uploadTime;
    if (uploadedTime === null) {
        const streamingData = metadata.streamingData ?? {};
        const mediaFiles = [
            ...(streamingData.formats ?? []),
            ...(streamingData.adaptiveFormats ?? []),
        ];
        const lastModifiedTimes = mediaFiles
            .filter((f: any) => f.hasOwnProperty("lastModified"))
            .map((f: any) => Math.round(parseInt(f.lastModified) / 1_000_000))
            .filter((v: number) => !isNaN(v) && v > 1_200_000_000)
            .filter((v: number) => v < Date.now() / 1000 + 3_000_000);
        uploadedTime = lastModifiedTimes.length > 0 ? Math.min(...lastModifiedTimes) : null;
    }

    const availableTranscripts = (
        metadata.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    ).map((t: Record<string, any>) => ({
        name: t.name?.runs?.[0]?.text,
        languageCode: t.languageCode ?? "",
        isGenerated: (t.kind ?? "").toLowerCase() === "asr",
    }));

    return {
        success: true,
        info: {
            type: "video",
            id: videoDetails.videoId ?? "",
            title: videoDetails.title ?? "",
            description: videoDetails.shortDescription ?? "",
            thumbnailUrl: thumbnails.at(-1)?.url ?? "",
            uploadedTime,
            length: videoDetails.lengthSeconds ? parseInt(videoDetails.lengthSeconds, 10) : 0,
            isLive: isTrue(videoDetails.isLive),
            isLiveContent: isTrue(videoDetails.isLiveContent),
            viewCount: videoDetails.viewCount ? parseInt(videoDetails.viewCount, 10) : 0,
            channelId: videoDetails.channelId ?? "",
            author: videoDetails.author ?? "",
            isPrivate: videoDetails.isPrivate ?? false,
            availableTranscripts,
            dataFetchedTime: Math.round(Date.now() / 1000),
        },
        captionTracks: parseCaptionTracks(metadata),
    };
}
