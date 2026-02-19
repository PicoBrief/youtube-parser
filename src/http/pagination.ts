import { findInObject } from "../utils/object.js";
import { getAllDescendantObjects } from "../utils/object.js";
import { makeHttpRequest } from "./request.js";

type ContinuationData = {
    token: string;
    clickParams: { clickTrackingParams: string };
};

/**
 * Extract continuation endpoint data from a YouTube page data object.
 * Used for pagination (loading more results).
 */
export function getContinuationData(
    pageData: Record<string, any>,
    sortBy?: string
): ContinuationData | null {
    const sortByPositions: Record<string, number> = { newest: 0, popular: 1, oldest: 2 };
    let endpoint: any;

    if (sortBy && sortBy !== "newest") {
        const feedFilter = findInObject(pageData, "feedFilterChipBarRenderer");
        if (feedFilter?.contents) {
            const chip = feedFilter.contents[sortByPositions[sortBy]];
            endpoint = chip?.chipCloudChipRenderer?.navigationEndpoint;
        }
    } else {
        endpoint = findInObject(pageData, "continuationEndpoint");
    }

    if (!endpoint) return null;

    return {
        token: endpoint.continuationCommand.token,
        clickParams: { clickTrackingParams: endpoint.clickTrackingParams },
    };
}

/**
 * Same as getContinuationData but searches for continuation endpoints
 * by matching objects with both clickTrackingParams and continuationCommand keys.
 * Used by the playlist handler where the standard approach doesn't work.
 */
export function getContinuationDataDeep(
    pageData: Record<string, any>,
    sortBy?: string
): ContinuationData | null {
    const sortByPositions: Record<string, number> = { newest: 0, popular: 1, oldest: 2 };

    if (sortBy && sortBy !== "newest") {
        const feedFilter = findInObject(pageData, "feedFilterChipBarRenderer");
        if (feedFilter?.contents) {
            const chip = feedFilter.contents[sortByPositions[sortBy]];
            const endpoint = chip?.chipCloudChipRenderer?.navigationEndpoint;
            if (endpoint) {
                return {
                    token: endpoint.continuationCommand.token,
                    clickParams: { clickTrackingParams: endpoint.clickTrackingParams },
                };
            }
        }
        return null;
    }

    const endpoint = getAllDescendantObjects({
        rootNode: pageData,
        isMatch: ({ node }) => {
            if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
            const keys = Object.keys(node).map((k) => k.toLowerCase());
            return (
                keys.includes("clicktrackingparams") &&
                keys.includes("continuationcommand")
            );
        },
    }).at(-1) ?? null;

    if (!endpoint) return null;

    return {
        token: endpoint.continuationCommand.token,
        clickParams: { clickTrackingParams: endpoint.clickTrackingParams },
    };
}

export function getClientHeaders(clientData: any): Record<string, string> {
    return {
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": clientData.client?.clientVersion ?? "",
    };
}

/**
 * Fetch the next page of results using a continuation token.
 */
export async function fetchNextPage(params: {
    endpoint: string;
    apiKey: string;
    proxyUrl: string | null;
    clientData: Record<string, any>;
    pageData: Record<string, any>;
    getContinuation?: (pageData: Record<string, any>) => ContinuationData | null;
}): Promise<Record<string, any>> {
    const {
        endpoint,
        apiKey,
        proxyUrl,
        clientData,
        pageData,
        getContinuation = getContinuationData,
    } = params;
    const continuation = getContinuation(pageData);
    if (!continuation) return {};

    const headers = getClientHeaders(clientData);
    const response = await makeHttpRequest({
        url: `https://www.youtube.com/youtubei/v1/${endpoint}?key=${apiKey}`,
        proxyUrl,
        method: "POST",
        requestData: JSON.stringify({
            context: {
                clickTracking: continuation.clickParams,
                client: clientData.client,
            },
            continuation: continuation.token,
        }),
        headers: {
            ...headers,
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Accept-Language": "en",
        },
    });

    return JSON.parse(response.text);
}
