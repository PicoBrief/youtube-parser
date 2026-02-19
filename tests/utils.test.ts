import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unescapeHtml, getJsonFromHtml, extractInnerTubeApiKey } from "../src/utils/html.js";
import { getAllDescendantObjects, findInObject } from "../src/utils/object.js";
import { removeDuplicates, isTrue, isJSON, getBaseLanguageCode, extractErrorMessage } from "../src/utils/misc.js";

// ── unescapeHtml ─────────────────────────────────────────────────────────────

describe("unescapeHtml", () => {
    it("unescapes common HTML entities", () => {
        assert.strictEqual(unescapeHtml("&amp;"), "&");
        assert.strictEqual(unescapeHtml("&lt;"), "<");
        assert.strictEqual(unescapeHtml("&gt;"), ">");
        assert.strictEqual(unescapeHtml("&#39;"), "'");
        assert.strictEqual(unescapeHtml("&#x27;"), "'");
        assert.strictEqual(unescapeHtml("&#x2F;"), "/");
        assert.strictEqual(unescapeHtml("&#x60;"), "`");
        assert.strictEqual(unescapeHtml("&#x3D;"), "=");
    });

    it("handles multiple entities in a string", () => {
        assert.strictEqual(unescapeHtml("1 &lt; 2 &amp; 3 &gt; 2"), "1 < 2 & 3 > 2");
    });

    it("leaves unknown entities unchanged", () => {
        assert.strictEqual(unescapeHtml("&unknown;"), "&unknown;");
    });

    it("handles strings with no entities", () => {
        assert.strictEqual(unescapeHtml("hello world"), "hello world");
    });
});

// ── getJsonFromHtml ──────────────────────────────────────────────────────────

describe("getJsonFromHtml", () => {
    it("extracts a substring between markers", () => {
        const html = 'var data = "hello world";';
        assert.strictEqual(getJsonFromHtml(html, "data = ", 0, ";"), '"hello world"');
    });

    it("extracts with numChars offset", () => {
        const html = 'var ytInitialData = {"tabs":[1,2]};';
        assert.strictEqual(getJsonFromHtml(html, "var ytInitialData = ", 0, "};"), '{"tabs":[1,2]');
    });
});

// ── extractInnerTubeApiKey ───────────────────────────────────────────────────

describe("extractInnerTubeApiKey", () => {
    it("extracts API key from HTML", () => {
        const html = 'some content "INNERTUBE_API_KEY": "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8" more content';
        assert.strictEqual(
            extractInnerTubeApiKey(html),
            "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        );
    });

    it("returns null when no key found", () => {
        assert.strictEqual(extractInnerTubeApiKey("no key here"), null);
    });

    it("handles extra whitespace", () => {
        const html = '"INNERTUBE_API_KEY":  "abc123_def"';
        assert.strictEqual(extractInnerTubeApiKey(html), "abc123_def");
    });
});

// ── getAllDescendantObjects ───────────────────────────────────────────────────

describe("getAllDescendantObjects", () => {
    it("finds objects matching a predicate using parentKey", () => {
        const tree = {
            videoRenderer: { videoId: "1", title: "Video A" },
            other: {
                videoRenderer: { videoId: "2", title: "Video B" },
            },
        };

        const results = getAllDescendantObjects({
            rootNode: tree,
            isMatch: ({ node, parentKey }) =>
                parentKey === "videoRenderer" &&
                typeof node === "object" &&
                node !== null &&
                !Array.isArray(node) &&
                "videoId" in node,
        });

        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0].videoId, "1");
        assert.strictEqual(results[1].videoId, "2");
    });

    it("handles arrays", () => {
        const data = {
            items: [
                { videoRenderer: { videoId: "1" } },
                { videoRenderer: { videoId: "2" } },
            ],
        };

        const results = getAllDescendantObjects({
            rootNode: data,
            isMatch: ({ node, parentKey }) =>
                parentKey === "videoRenderer" &&
                typeof node === "object" &&
                node !== null &&
                !Array.isArray(node),
        });

        assert.strictEqual(results.length, 2);
    });

    it("passes parentKey to isMatch", () => {
        const data = {
            videoRenderer: { videoId: "1" },
            otherRenderer: { videoId: "2" },
        };

        const results = getAllDescendantObjects({
            rootNode: data,
            isMatch: ({ node, parentKey }) =>
                parentKey === "videoRenderer" &&
                typeof node === "object" &&
                node !== null &&
                !Array.isArray(node),
        });

        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].videoId, "1");
    });

    it("returns empty for primitives", () => {
        assert.deepStrictEqual(
            getAllDescendantObjects({ rootNode: 42, isMatch: () => true }),
            []
        );
        assert.deepStrictEqual(
            getAllDescendantObjects({ rootNode: null, isMatch: () => true }),
            []
        );
    });
});

// ── findInObject ─────────────────────────────────────────────────────────────

describe("findInObject", () => {
    it("finds a key in a flat object", () => {
        assert.strictEqual(findInObject({ name: "test" }, "name"), "test");
    });

    it("finds a key in a nested object", () => {
        const obj = { a: { b: { target: "found" } } };
        assert.strictEqual(findInObject(obj, "target"), "found");
    });

    it("finds a key inside an array", () => {
        const obj = { list: [{ id: 1 }, { id: 2, target: "here" }] };
        assert.strictEqual(findInObject(obj, "target"), "here");
    });

    it("returns empty array when key not found", () => {
        assert.deepStrictEqual(findInObject({ a: 1 }, "missing"), []);
    });
});

// ── removeDuplicates ─────────────────────────────────────────────────────────

describe("removeDuplicates", () => {
    it("removes duplicates by evaluator", () => {
        const items = [
            { id: 1, name: "a" },
            { id: 2, name: "b" },
            { id: 1, name: "c" },
        ];
        const result = removeDuplicates(items, (item) => item.id);
        assert.strictEqual(result.length, 2);
        // Last occurrence wins
        assert.strictEqual(result[0].name, "c");
        assert.strictEqual(result[1].name, "b");
    });

    it("handles empty array", () => {
        assert.deepStrictEqual(removeDuplicates([], (x: any) => x), []);
    });
});

// ── isTrue ───────────────────────────────────────────────────────────────────

describe("isTrue", () => {
    it("handles booleans", () => {
        assert.strictEqual(isTrue(true), true);
        assert.strictEqual(isTrue(false), false);
    });

    it("handles numbers", () => {
        assert.strictEqual(isTrue(1), true);
        assert.strictEqual(isTrue(0), false);
        assert.strictEqual(isTrue(-1), true);
    });

    it("handles strings", () => {
        assert.strictEqual(isTrue("true"), true);
        assert.strictEqual(isTrue("True"), true);
        assert.strictEqual(isTrue("TRUE"), true);
        assert.strictEqual(isTrue("t"), true);
        assert.strictEqual(isTrue("yes"), true);
        assert.strictEqual(isTrue("false"), false);
        assert.strictEqual(isTrue("no"), false);
        assert.strictEqual(isTrue("1"), true);
        assert.strictEqual(isTrue("0"), false);
    });

    it("handles other types", () => {
        assert.strictEqual(isTrue(null), false);
        assert.strictEqual(isTrue(undefined), false);
        assert.strictEqual(isTrue({}), false);
    });
});

// ── isJSON ───────────────────────────────────────────────────────────────────

describe("isJSON", () => {
    it("returns true for valid JSON", () => {
        assert.strictEqual(isJSON('{"key": "value"}'), true);
        assert.strictEqual(isJSON("[1, 2, 3]"), true);
        assert.strictEqual(isJSON('"string"'), true);
        assert.strictEqual(isJSON("123"), true);
        assert.strictEqual(isJSON("null"), true);
    });

    it("returns false for invalid JSON", () => {
        assert.strictEqual(isJSON("{key: value}"), false);
        assert.strictEqual(isJSON("<xml>"), false);
        assert.strictEqual(isJSON(""), false);
        assert.strictEqual(isJSON("undefined"), false);
    });
});

// ── getBaseLanguageCode ──────────────────────────────────────────────────────

describe("getBaseLanguageCode", () => {
    it("extracts base language code", () => {
        assert.strictEqual(getBaseLanguageCode("en-US"), "en");
        assert.strictEqual(getBaseLanguageCode("pt-BR"), "pt");
        assert.strictEqual(getBaseLanguageCode("zh-Hans-CN"), "zh");
    });

    it("returns the code itself when no hyphen", () => {
        assert.strictEqual(getBaseLanguageCode("en"), "en");
        assert.strictEqual(getBaseLanguageCode("fr"), "fr");
    });

    it("returns null for null/undefined/empty", () => {
        assert.strictEqual(getBaseLanguageCode(null), null);
        assert.strictEqual(getBaseLanguageCode(undefined), null);
        assert.strictEqual(getBaseLanguageCode(""), null);
    });
});

// ── extractErrorMessage ──────────────────────────────────────────────────────

describe("extractErrorMessage", () => {
    it("extracts message from Error", () => {
        assert.strictEqual(extractErrorMessage(new Error("test error")), "test error");
    });

    it("returns string as-is", () => {
        assert.strictEqual(extractErrorMessage("raw message"), "raw message");
    });

    it("stringifies non-string non-Error values", () => {
        assert.strictEqual(extractErrorMessage({ code: 404 }), '{"code":404}');
        assert.strictEqual(extractErrorMessage(42), "42");
    });
});
