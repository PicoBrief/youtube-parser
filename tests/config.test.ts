import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { configure, getProxyUrls } from "../src/config.js";

describe("configure", () => {
    beforeEach(() => {
        configure({ proxyUrls: [] });
    });

    it("sets proxy URLs", () => {
        configure({ proxyUrls: ["http://proxy1.com", "http://proxy2.com"] });
        assert.deepStrictEqual(getProxyUrls(), ["http://proxy1.com", "http://proxy2.com"]);
    });

    it("defaults to empty proxy list", () => {
        assert.deepStrictEqual(getProxyUrls(), []);
    });

    it("does not modify proxyUrls when not provided", () => {
        configure({ proxyUrls: ["http://proxy.com"] });
        configure({});
        assert.deepStrictEqual(getProxyUrls(), ["http://proxy.com"]);
    });
});
