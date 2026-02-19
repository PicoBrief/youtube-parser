import { getProxyUrls } from "../config.js";

/**
 * Select a random proxy URL from the configured list, replacing the
 * `:sessionId` placeholder with a random numeric value.
 * Returns null when no proxies are configured.
 */
export async function generateProxyUrl(): Promise<string | null> {
    const proxyUrls = getProxyUrls();
    if (proxyUrls.length === 0) return null;

    const selected = proxyUrls[Math.floor(Math.random() * proxyUrls.length)];
    const sessionId = Math.round(Math.random() * 10 ** 6).toString();
    return selected.replaceAll(":sessionId", sessionId);
}
