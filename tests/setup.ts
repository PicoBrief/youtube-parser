import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configure } from "../src/config.js";

/**
 * Read PROXY_URLS from .env and configure the library.
 * If .env doesn't exist or PROXY_URLS is empty, proceeds without proxy.
 */
export function setupFromEnv(): { hasProxy: boolean } {
    let proxyUrls: string[] = [];

    try {
        const envPath = resolve(import.meta.dirname, "..", ".env");
        const envContent = readFileSync(envPath, "utf-8");

        for (const line of envContent.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("PROXY_URLS")) {
                const match = trimmed.match(/^PROXY_URLS\s*=\s*"?(.+?)"?\s*$/);
                if (match?.[1]) {
                    proxyUrls = match[1]
                        .split(",")
                        .map((u) => u.trim())
                        .filter(Boolean);
                }
            }
        }
    } catch {
        // .env not found — proceed without proxy
    }

    if (proxyUrls.length > 0) {
        console.log(`  [setup] Using ${proxyUrls.length} proxy URL(s)`);
        configure({ proxyUrls });
    } else {
        console.log("  [setup] No proxy configured — making direct calls");
        configure({ proxyUrls: [] });
    }

    return { hasProxy: proxyUrls.length > 0 };
}
