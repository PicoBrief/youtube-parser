import { racePromises } from "../utils/async.js";
import { makeHttpRequest } from "./request.js";
import { generateProxyUrl } from "./proxy.js";
import { extractErrorMessage } from "../utils/misc.js";
import { unescapeHtml, getJsonFromHtml, extractInnerTubeApiKey } from "../utils/html.js";
import type { FetchPageSuccessResponse, FetchPageFailureResponse, FetchPageErrorCode } from "../types.js";

/**
 * Fetch a YouTube page and extract embedded JSON data structures
 * (pageData, clientData, playerData) along with the InnerTube API key.
 * Handles consent cookie challenges automatically.
 */
export async function fetchYoutubePage(params: {
    url: string;
}): Promise<FetchPageSuccessResponse | FetchPageFailureResponse> {
    const { url } = params;
    const cookies: Record<string, string> = {};

    try {
        const response = await racePromises({
            generatePromise: async () =>
                makeHttpRequest({ url, proxyUrl: await generateProxyUrl() }),
            amount: 3,
            waitTime: 10,
            shouldRetry,
        });

        let html = unescapeHtml(response.text);
        const proxyUrl = response.proxyUrl ?? null;

        // Handle consent cookie challenge
        if (html.includes('action="https://consent.youtube.com/s"')) {
            const match = html.match(/name="v" value="(.*?)"/);
            if (match) {
                cookies.CONSENT = `YES+${match[1]}`;
                const retryResponse = await makeHttpRequest({
                    url,
                    proxyUrl,
                    headers: {
                        Cookie: Object.entries(cookies)
                            .map(([k, v]) => `${k}=${v}`)
                            .join("; "),
                    },
                });
                html = unescapeHtml(retryResponse.text);
            }
        }

        const apiKey = extractInnerTubeApiKey(html);
        const clientData = JSON.parse(
            `${getJsonFromHtml(html, "INNERTUBE_CONTEXT", 2, '"}},')}"}}`
        );
        const pageData = JSON.parse(
            `${getJsonFromHtml(html, "var ytInitialData = ", 0, "};")}}`
        );
        let playerData = null;
        try {
            playerData = JSON.parse(
                `${getJsonFromHtml(html, "var ytInitialPlayerResponse = ", 0, "};")}}`
            );
        } catch {}

        return { success: true, html, cookies, proxyUrl, apiKey, clientData, pageData, playerData };
    } catch (e) {
        const msg = extractErrorMessage(e).toLowerCase();
        let errorCode: FetchPageErrorCode = "unknown";
        if (msg.includes("member")) errorCode = "member_only";
        else if (msg.includes("avail") || msg.includes("exist") || msg.includes("not found"))
            errorCode = "not_found";
        return { success: false, errorCode };
    }
}

function shouldRetry(e: any): boolean {
    const msg = extractErrorMessage(e);
    return (
        !msg.includes("unavailable") &&
        !msg.includes("exist") &&
        !msg.includes("avail") &&
        !msg.includes("members-only") &&
        !msg.includes("members only") &&
        !msg.includes("member only") &&
        !msg.includes("member-only")
    );
}
