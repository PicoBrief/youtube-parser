import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { configure } from "../src/config.js";
import { generateProxyUrl } from "../src/http/proxy.js";

describe("generateProxyUrl", () => {
    beforeEach(() => {
        configure({ proxyUrls: [] });
    });

    it("returns null when no proxies configured", async () => {
        const result = await generateProxyUrl();
        assert.strictEqual(result, null);
    });

    it("returns a proxy URL when configured", async () => {
        configure({ proxyUrls: ["http://proxy.example.com:8080"] });
        const result = await generateProxyUrl();
        assert.strictEqual(result, "http://proxy.example.com:8080");
    });

    it("replaces :sessionId placeholder", async () => {
        configure({ proxyUrls: ["http://proxy.example.com/:sessionId"] });
        const result = await generateProxyUrl();
        assert.ok(result);
        assert.ok(!result.includes(":sessionId"));
        assert.match(result, /http:\/\/proxy\.example\.com\/\d+/);
    });

    it("selects from multiple proxies", async () => {
        const proxies = ["http://a.com", "http://b.com", "http://c.com"];
        configure({ proxyUrls: proxies });

        const results = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const result = await generateProxyUrl();
            if (result) results.add(result);
        }

        // Should have selected at least 2 different proxies in 100 tries
        assert.ok(results.size >= 2, `Expected at least 2 unique proxies, got ${results.size}`);
    });
});
