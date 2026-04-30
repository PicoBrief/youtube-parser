import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRANSFORMS, applyTransforms } from "../src/dsl/transforms.js";
import { resolveField, resolveItem, nodeMatchesItem } from "../src/dsl/resolver.js";
import { extractApiKey, extractJsonBlock } from "../src/dsl/html-extract.js";
import { applyTemplate } from "../src/dsl/template.js";
import { findContinuation } from "../src/dsl/pagination.js";
import type { ItemSpec, PaginationConfig } from "../src/dsl/types.js";

// ── transforms ───────────────────────────────────────────────────────────────

describe("abbreviated_count", () => {
    const f = TRANSFORMS.abbreviated_count;

    it("parses plain integers and comma-separated values", () => {
        assert.strictEqual(f("1234"), 1234);
        assert.strictEqual(f("1,234"), 1234);
        assert.strictEqual(f("1,234 views"), 1234);
        assert.strictEqual(f("9,183 views"), 9183);
    });

    it("parses English K/M/B/T suffixes", () => {
        assert.strictEqual(f("9.1K views"), 9100);
        assert.strictEqual(f("1.2M views"), 1_200_000);
        assert.strictEqual(f("3B"), 3_000_000_000);
        assert.strictEqual(f("2T"), 2_000_000_000_000);
        assert.strictEqual(f("1k"), 1_000);
    });

    it("treats CJK suffixes with correct multipliers (K ≠ 万)", () => {
        // 万 = 10,000 (NOT 1,000)
        assert.strictEqual(f("9.1万"), 91_000);
        assert.strictEqual(f("1万"), 10_000);
        // 萬 (traditional) same as 万
        assert.strictEqual(f("1萬"), 10_000);
        // 千 = 1,000 (matches K)
        assert.strictEqual(f("3千"), 3_000);
        // 亿/億 = 100,000,000
        assert.strictEqual(f("1.5亿"), 150_000_000);
        assert.strictEqual(f("1.5億"), 150_000_000);
        // explicit distinction: 1K vs 1万
        assert.notStrictEqual(f("1K"), f("1万"));
    });

    it("returns undefined for non-numeric input", () => {
        assert.strictEqual(f("no number here"), undefined);
        assert.strictEqual(f(""), undefined);
        assert.strictEqual(f(null), undefined);
        assert.strictEqual(f(undefined), undefined);
    });

    it("passes through numeric input", () => {
        assert.strictEqual(f(42), 42);
    });
});

describe("duration transform", () => {
    it("delegates to parseDuration", () => {
        assert.strictEqual(TRANSFORMS.duration("3:45"), 225);
        assert.strictEqual(TRANSFORMS.duration("1:02:03"), 3723);
    });
    it("returns undefined for non-strings", () => {
        assert.strictEqual(TRANSFORMS.duration(225), undefined);
    });
});

describe("age_text transform", () => {
    it("parses ago strings", () => {
        assert.deepStrictEqual(TRANSFORMS.age_text("3 days ago"), { amount: 3, unit: "day" });
        assert.deepStrictEqual(TRANSFORMS.age_text("9d ago"), { amount: 9, unit: "day" });
    });
});

describe("id_from_channel_url", () => {
    it("extracts channel id from path or full URL", () => {
        assert.strictEqual(TRANSFORMS.id_from_channel_url("/channel/UC123"), "UC123");
        assert.strictEqual(
            TRANSFORMS.id_from_channel_url("https://www.youtube.com/channel/UCxyz/videos"),
            "UCxyz"
        );
    });
    it("returns null when no /channel/ segment", () => {
        assert.strictEqual(TRANSFORMS.id_from_channel_url("/c/SomeName"), null);
        assert.strictEqual(TRANSFORMS.id_from_channel_url(""), null);
    });
});

describe("applyTransforms", () => {
    it("applies a single named transform", () => {
        assert.strictEqual(applyTransforms("9.1K", "abbreviated_count"), 9100);
    });
    it("chains multiple transforms left-to-right", () => {
        assert.strictEqual(applyTransforms(" 1234 ", ["trim", "abbreviated_count"]), 1234);
    });
    it("throws on unknown transform name", () => {
        assert.throws(() => applyTransforms("x", "does_not_exist"));
    });
});

// ── resolver ─────────────────────────────────────────────────────────────────

describe("resolveField — simple paths", () => {
    it("returns value at the first resolving path", () => {
        const node = { a: { b: "first" }, c: "second" };
        const v = resolveField(node, { paths: ["a.b", "c"] });
        assert.strictEqual(v, "first");
    });
    it("falls through to the next path when earlier ones don't resolve", () => {
        const node = { c: "second" };
        const v = resolveField(node, { paths: ["a.b", "c"] });
        assert.strictEqual(v, "second");
    });
    it("returns undefined when no path resolves", () => {
        const v = resolveField({}, { paths: ["a.b"] });
        assert.strictEqual(v, undefined);
    });
    it("applies transform after resolving", () => {
        const node = { count: "9.1K views" };
        const v = resolveField(node, { paths: ["count"], transform: "abbreviated_count" });
        assert.strictEqual(v, 9100);
    });
});

describe("resolveField — find_in_array", () => {
    it("walks `[*]` markers and matches by regex", () => {
        const node = {
            rows: [
                { parts: [{ text: "1.2K views" }, { text: "8 days ago" }] },
            ],
        };
        const v = resolveField(node, {
            paths: [{ find_in_array: "rows[*].parts[*].text", match: "view" }],
            transform: "abbreviated_count",
        });
        assert.strictEqual(v, 1200);
    });

    it("returns undefined when nothing matches", () => {
        const node = { rows: [{ parts: [{ text: "no match" }] }] };
        const v = resolveField(node, {
            paths: [{ find_in_array: "rows[*].parts[*].text", match: "view" }],
        });
        assert.strictEqual(v, undefined);
    });
});

describe("nodeMatchesItem", () => {
    const spec: ItemSpec = {
        required: ["id", "title"],
        fields: {
            id: { paths: ["videoId", "contentId"] },
            title: { paths: ["title.simpleText", "metadata.lockupMetadataViewModel.title.content"] },
        },
    };

    it("matches when all required fields resolve", () => {
        assert.strictEqual(
            nodeMatchesItem({ videoId: "x", title: { simpleText: "T" } }, spec),
            true
        );
        assert.strictEqual(
            nodeMatchesItem(
                { contentId: "y", metadata: { lockupMetadataViewModel: { title: { content: "T" } } } },
                spec
            ),
            true
        );
    });

    it("rejects when a required field cannot resolve (e.g. bare watchEndpoint)", () => {
        assert.strictEqual(nodeMatchesItem({ videoId: "x" }, spec), false);
    });

    it("rejects non-objects", () => {
        assert.strictEqual(nodeMatchesItem(null, spec), false);
        assert.strictEqual(nodeMatchesItem("string", spec), false);
        assert.strictEqual(nodeMatchesItem([], spec), false);
    });
});

describe("resolveItem", () => {
    it("resolves all declared fields", () => {
        const spec: ItemSpec = {
            required: ["id"],
            fields: {
                id: { paths: ["videoId"] },
                title: { paths: ["title.simpleText"] },
            },
        };
        const out = resolveItem({ videoId: "v", title: { simpleText: "T" } }, spec);
        assert.deepStrictEqual(out, { id: "v", title: "T" });
    });
});

// ── html extractors ──────────────────────────────────────────────────────────

describe("extractApiKey", () => {
    it("extracts via the bundled default pattern", () => {
        const html = '...stuff..."INNERTUBE_API_KEY":"abc123_def-XYZ"...';
        assert.strictEqual(extractApiKey(html), "abc123_def-XYZ");
    });
    it("returns null when no pattern matches", () => {
        assert.strictEqual(extractApiKey("no key here"), null);
    });
    it("falls through multiple configured patterns", () => {
        const html = "...key='zyx987'...";
        const v = extractApiKey(html, {
            apiKey: { patterns: ["NEVER_MATCH:(\\d+)", "key='([a-z0-9]+)'"] },
            blocks: {},
        });
        assert.strictEqual(v, "zyx987");
    });
});

// ── template engine ──────────────────────────────────────────────────────────

describe("applyTemplate", () => {
    it("substitutes embedded placeholders as strings", () => {
        const out = applyTemplate("https://x.test/{{a}}/{{b.c}}", { a: "1", b: { c: "two" } });
        assert.strictEqual(out, "https://x.test/1/two");
    });
    it("preserves the resolved value's type for whole-string placeholders", () => {
        const ctx = { client: { name: "WEB", version: "2.0" } };
        const out = applyTemplate({ context: { client: "{{client}}" } }, ctx);
        assert.deepStrictEqual(out, { context: { client: { name: "WEB", version: "2.0" } } });
    });
    it("walks arrays and nested objects recursively", () => {
        const tpl = { items: [{ id: "{{id}}" }, { id: "literal" }] };
        const out = applyTemplate(tpl, { id: "X" });
        assert.deepStrictEqual(out, { items: [{ id: "X" }, { id: "literal" }] });
    });
    it("omits keys whose whole-string placeholder resolves to undefined", () => {
        const out = applyTemplate({ a: "{{missing}}", b: "kept" }, {});
        assert.deepStrictEqual(out, { b: "kept" });
    });
    it("renders missing values as empty strings in embedded mode", () => {
        const out = applyTemplate("[{{missing}}]", {});
        assert.strictEqual(out, "[]");
    });
});

// ── continuation finder ──────────────────────────────────────────────────────

const PAGINATION_CFG: PaginationConfig = {
    continuation: {
        strategies: {
            default: [{ type: "find_key", key: "continuationEndpoint" }],
            deep: [
                { type: "find_descendant_last", requireKeys: ["clickTrackingParams", "continuationCommand"] },
            ],
        },
        tokenPaths: ["continuationCommand.token"],
        clickTrackingPaths: ["clickTrackingParams"],
    },
    sortChip: {
        containerKey: "feedFilterChipBarRenderer",
        contentsPath: "contents",
        endpointPath: "chipCloudChipRenderer.navigationEndpoint",
        indexBySort: { newest: 0, popular: 1, oldest: 2 },
    },
    request: { url: "", method: "POST", headers: {}, body: {} },
};

describe("findContinuation — default strategy", () => {
    it("locates a continuationEndpoint by key", () => {
        const pageData = {
            wrapper: {
                continuationEndpoint: {
                    clickTrackingParams: "ctp1",
                    continuationCommand: { token: "tok1" },
                },
            },
        };
        const c = findContinuation(pageData, "default", undefined, PAGINATION_CFG);
        assert.deepStrictEqual(c, { token: "tok1", clickTrackingParams: "ctp1" });
    });
    it("returns null when no endpoint is found", () => {
        const c = findContinuation({}, "default", undefined, PAGINATION_CFG);
        assert.strictEqual(c, null);
    });
});

describe("findContinuation — deep strategy", () => {
    it("picks the last descendant with required keys", () => {
        const pageData = {
            list: [
                {
                    clickTrackingParams: "ctpA",
                    continuationCommand: { token: "tokA" },
                },
                {
                    clickTrackingParams: "ctpB",
                    continuationCommand: { token: "tokB" },
                },
            ],
        };
        const c = findContinuation(pageData, "deep", undefined, PAGINATION_CFG);
        assert.deepStrictEqual(c, { token: "tokB", clickTrackingParams: "ctpB" });
    });
});

describe("findContinuation — sort chip", () => {
    it("prefers the sort-chip endpoint when sortBy is non-default", () => {
        const pageData = {
            feedFilterChipBarRenderer: {
                contents: [
                    {},
                    {
                        chipCloudChipRenderer: {
                            navigationEndpoint: {
                                clickTrackingParams: "popCtp",
                                continuationCommand: { token: "popTok" },
                            },
                        },
                    },
                ],
            },
            // would otherwise be picked
            continuationEndpoint: {
                clickTrackingParams: "newCtp",
                continuationCommand: { token: "newTok" },
            },
        };
        const c = findContinuation(pageData, "default", "popular", PAGINATION_CFG);
        assert.deepStrictEqual(c, { token: "popTok", clickTrackingParams: "popCtp" });
    });
});

describe("extractJsonBlock", () => {
    it("extracts ytInitialData via the bundled pattern", () => {
        const html = 'prefix var ytInitialData = {"a":1,"b":[2,3]}; suffix';
        assert.deepStrictEqual(extractJsonBlock(html, "ytInitialData"), { a: 1, b: [2, 3] });
    });
    it("returns null when block name is not configured", () => {
        assert.strictEqual(extractJsonBlock("anything", "doesNotExist"), null);
    });
    it("falls through multiple patterns until one parses", () => {
        const html = 'BEGIN_NEW {"x":42} END';
        const v = extractJsonBlock(html, "test", {
            apiKey: { patterns: [] },
            blocks: {
                test: [
                    { key: "BEGIN_OLD ", numChars: 0, stop: " END", suffix: "" },
                    { key: "BEGIN_NEW ", numChars: 0, stop: " END", suffix: "" },
                ],
            },
        });
        assert.deepStrictEqual(v, { x: 42 });
    });
});
