import { makeHttpRequest } from "./request.js";
import { findContinuation } from "../dsl/pagination.js";
import { applyTemplate } from "../dsl/template.js";
import { getPathsConfig } from "../dsl/loader.js";

/** Strategy name (matches a key in paths.json → pagination.continuation.strategies). */
export type ContinuationStrategyName = string;

/**
 * Fetch the next page of results using a continuation token. The request
 * URL, headers, and body are all driven by paths.json's pagination.request
 * template, so layout shifts in YouTube's InnerTube API can be patched
 * without a code release.
 */
export async function fetchNextPage(params: {
    endpoint: string;
    apiKey: string;
    proxyUrl: string | null;
    clientData: Record<string, any>;
    pageData: Record<string, any>;
    /** Strategy name from paths.json (default "default"; playlist uses "deep"). */
    strategy?: ContinuationStrategyName;
    sortBy?: string;
}): Promise<Record<string, any>> {
    const {
        endpoint,
        apiKey,
        proxyUrl,
        clientData,
        pageData,
        strategy = "default",
        sortBy,
    } = params;

    const cfg = getPathsConfig().pagination;
    const continuation = findContinuation(pageData, strategy, sortBy, cfg);
    if (!continuation) return {};

    const ctx = {
        endpoint,
        apiKey,
        clientData,
        continuationToken: continuation.token,
        clickTrackingParams: continuation.clickTrackingParams,
    };

    const url = applyTemplate(cfg.request.url, ctx) as string;
    const headers = applyTemplate(cfg.request.headers, ctx) as Record<string, string>;
    const body = applyTemplate(cfg.request.body, ctx);

    const response = await makeHttpRequest({
        url,
        proxyUrl,
        method: cfg.request.method as any,
        requestData: JSON.stringify(body),
        headers,
    });

    return JSON.parse(response.text);
}
