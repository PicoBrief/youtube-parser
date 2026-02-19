import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAgeText } from "../src/parsers/age.js";
import { parseDuration } from "../src/parsers/duration.js";
import { parseRawVideoListItem } from "../src/parsers/video-list-item.js";
import { parseListItemData } from "../src/parsers/list-item.js";
import { extractVideos } from "../src/parsers/extract-videos.js";
import { parseTranscriptJSON, parseTranscriptXml } from "../src/parsers/transcript.js";

// ── parseAgeText ─────────────────────────────────────────────────────────────

describe("parseAgeText", () => {
    it("parses singular time units", () => {
        assert.deepStrictEqual(parseAgeText("1 day ago"), { amount: 1, unit: "day" });
        assert.deepStrictEqual(parseAgeText("1 hour ago"), { amount: 1, unit: "hour" });
        assert.deepStrictEqual(parseAgeText("1 minute ago"), { amount: 1, unit: "minute" });
        assert.deepStrictEqual(parseAgeText("1 second ago"), { amount: 1, unit: "second" });
        assert.deepStrictEqual(parseAgeText("1 week ago"), { amount: 1, unit: "week" });
        assert.deepStrictEqual(parseAgeText("1 month ago"), { amount: 1, unit: "month" });
        assert.deepStrictEqual(parseAgeText("1 year ago"), { amount: 1, unit: "year" });
    });

    it("parses plural time units", () => {
        assert.deepStrictEqual(parseAgeText("3 days ago"), { amount: 3, unit: "day" });
        assert.deepStrictEqual(parseAgeText("12 hours ago"), { amount: 12, unit: "hour" });
        assert.deepStrictEqual(parseAgeText("5 minutes ago"), { amount: 5, unit: "minute" });
        assert.deepStrictEqual(parseAgeText("45 seconds ago"), { amount: 45, unit: "second" });
        assert.deepStrictEqual(parseAgeText("2 weeks ago"), { amount: 2, unit: "week" });
        assert.deepStrictEqual(parseAgeText("6 months ago"), { amount: 6, unit: "month" });
        assert.deepStrictEqual(parseAgeText("10 years ago"), { amount: 10, unit: "year" });
    });

    it("returns undefined for invalid strings", () => {
        assert.strictEqual(parseAgeText(""), undefined);
        assert.strictEqual(parseAgeText("ago"), undefined);
        assert.strictEqual(parseAgeText("3 bananas ago"), undefined);
        assert.strictEqual(parseAgeText("abc days ago"), undefined);
        assert.strictEqual(parseAgeText("3 days"), undefined);
        assert.strictEqual(parseAgeText("just now"), undefined);
        assert.strictEqual(parseAgeText("3 days ago extra"), undefined);
    });
});

// ── parseDuration ────────────────────────────────────────────────────────────

describe("parseDuration", () => {
    it("parses mm:ss format", () => {
        assert.strictEqual(parseDuration("1:30"), 90);
        assert.strictEqual(parseDuration("0:05"), 5);
        assert.strictEqual(parseDuration("10:00"), 600);
        assert.strictEqual(parseDuration("59:59"), 3599);
    });

    it("parses hh:mm:ss format", () => {
        assert.strictEqual(parseDuration("1:00:00"), 3600);
        assert.strictEqual(parseDuration("2:30:45"), 9045);
        assert.strictEqual(parseDuration("0:01:00"), 60);
    });

    it("parses dd:hh:mm:ss format", () => {
        assert.strictEqual(parseDuration("1:00:00:00"), 86400);
        assert.strictEqual(parseDuration("1:02:03:04"), 86400 + 7200 + 180 + 4);
    });

    it("returns undefined for invalid formats", () => {
        assert.strictEqual(parseDuration(""), undefined);
        assert.strictEqual(parseDuration("abc"), undefined);
        assert.strictEqual(parseDuration("1:2:3:4:5"), undefined);
        assert.strictEqual(parseDuration("a:b"), undefined);
    });
});

// ── parseRawVideoListItem ────────────────────────────────────────────────────

describe("parseRawVideoListItem", () => {
    it("parses a full video object", () => {
        const raw = {
            videoId: "abc123",
            title: { runs: [{ text: "My Video" }] },
            thumbnail: { thumbnails: [{ url: "https://img.youtube.com/vi/abc123/0.jpg" }] },
            viewCountText: { simpleText: "1,234 views" },
            lengthText: { simpleText: "3:45" },
            publishedTimeText: { simpleText: "2 days ago" },
            shortBylineText: {
                runs: [
                    {
                        text: "Channel Name",
                        navigationEndpoint: { browseEndpoint: { browseId: "UCxyz" } },
                    },
                ],
            },
        };

        const result = parseRawVideoListItem(raw);
        assert.strictEqual(result.id, "abc123");
        assert.strictEqual(result.type, "video");
        assert.strictEqual(result.title, "My Video");
        assert.strictEqual(result.thumbnail, "https://img.youtube.com/vi/abc123/0.jpg");
        assert.strictEqual(result.viewCount, 1234);
        assert.strictEqual(result.length, 225);
        assert.deepStrictEqual(result.age, { amount: 2, unit: "day" });
        assert.strictEqual(result.channelName, "Channel Name");
        assert.strictEqual(result.channelId, "UCxyz");
        assert.strictEqual(result.channelThumbnail, null);
    });

    it("handles missing optional fields", () => {
        const raw = {
            videoId: "def456",
            title: { simpleText: "Fallback Title" },
            thumbnail: { thumbnails: [{ url: "https://example.com/thumb.jpg" }] },
        };

        const result = parseRawVideoListItem(raw);
        assert.strictEqual(result.id, "def456");
        assert.strictEqual(result.title, "Fallback Title");
        assert.strictEqual(result.viewCount, undefined);
        assert.strictEqual(result.length, undefined);
        assert.strictEqual(result.age, undefined);
        assert.strictEqual(result.channelName, null);
        assert.strictEqual(result.channelId, null);
    });
});

// ── parseListItemData ────────────────────────────────────────────────────────

describe("parseListItemData", () => {
    it("parses a video item", () => {
        const data = {
            videoId: "vid1",
            title: { runs: [{ text: "Test Video" }] },
            thumbnail: { thumbnails: [{ url: "https://example.com/thumb.jpg" }] },
        };
        const result = parseListItemData(data);
        assert.ok(result);
        assert.strictEqual(result.type, "video");
        assert.strictEqual(result.id, "vid1");
        assert.strictEqual(result.title, "Test Video");
    });

    it("parses a channel item", () => {
        const data = {
            channelId: "UC123",
            title: { simpleText: "My Channel" },
            thumbnail: { thumbnails: [{ url: "https://example.com/avatar.jpg" }] },
            descriptionSnippet: { runs: [{ text: "Channel description" }] },
        };
        const result = parseListItemData(data);
        assert.ok(result);
        assert.strictEqual(result.type, "channel");
        assert.strictEqual(result.id, "UC123");
        assert.strictEqual(result.title, "My Channel");
    });

    it("parses a playlist item", () => {
        const data = {
            contentId: "PLabc",
            title: { content: "My Playlist" },
            thumbnailViewModel: {
                sources: [{ url: "https://example.com/pl.jpg", width: 320 }],
                overlays: {
                    thumbnailBadgeViewModel: { text: "15" },
                },
            },
            contentType: "PLAYLIST",
        };

        // The playlist parser needs the title to be found via findInObject,
        // and the contentId triggers the playlist branch
        const result = parseListItemData(data);
        assert.ok(result);
        assert.strictEqual(result.type, "playlist");
        assert.strictEqual(result.id, "PLabc");
        assert.strictEqual(result.title, "My Playlist");
    });

    it("returns null for unknown data", () => {
        assert.strictEqual(parseListItemData({ unknownKey: "value" }), null);
        assert.strictEqual(parseListItemData({}), null);
    });
});

// ── extractVideos ────────────────────────────────────────────────────────────

describe("extractVideos", () => {
    it("extracts videos from nested page data", () => {
        const pageData = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    richGridRenderer: {
                                        contents: [
                                            {
                                                richItemRenderer: {
                                                    content: {
                                                        videoRenderer: {
                                                            videoId: "vid1",
                                                            title: { runs: [{ text: "Video 1" }] },
                                                            thumbnail: {
                                                                thumbnails: [{ url: "thumb1.jpg" }],
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            {
                                                richItemRenderer: {
                                                    content: {
                                                        videoRenderer: {
                                                            videoId: "vid2",
                                                            title: { runs: [{ text: "Video 2" }] },
                                                            thumbnail: {
                                                                thumbnails: [{ url: "thumb2.jpg" }],
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        };

        const result = extractVideos(pageData);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].id, "vid1");
        assert.strictEqual(result[1].id, "vid2");
    });

    it("deduplicates videos by id", () => {
        const pageData = {
            list1: {
                videoId: "dup",
                title: { runs: [{ text: "Duplicate" }] },
                thumbnail: { thumbnails: [{ url: "thumb.jpg" }] },
            },
            list2: {
                videoId: "dup",
                title: { runs: [{ text: "Duplicate" }] },
                thumbnail: { thumbnails: [{ url: "thumb.jpg" }] },
            },
        };

        const result = extractVideos(pageData);
        assert.strictEqual(result.length, 1);
    });

    it("returns empty array for empty input", () => {
        assert.deepStrictEqual(extractVideos({}), []);
    });
});

// ── parseTranscriptJSON ──────────────────────────────────────────────────────

describe("parseTranscriptJSON", () => {
    it("parses JSON3 transcript with tStartMs and dDurationMs", () => {
        const json = JSON.stringify({
            events: [
                {
                    tStartMs: 5000,
                    dDurationMs: 3000,
                    segs: [{ utf8: "Hello " }, { utf8: "world" }],
                },
                {
                    tStartMs: 8000,
                    dDurationMs: 2000,
                    segs: [{ utf8: "Second line" }],
                },
            ],
        });

        const result = parseTranscriptJSON(json);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].time, 5);
        assert.strictEqual(result[0].duration, 3);
        assert.strictEqual(result[0].text, "Hello  world");
        assert.strictEqual(result[1].time, 8);
        assert.strictEqual(result[1].duration, 2);
        assert.strictEqual(result[1].text, "Second line");
    });

    it("parses transcript with start/duration (seconds)", () => {
        const json = JSON.stringify({
            items: [{ start: 10, duration: 5, segs: [{ utf8: "Text" }] }],
        });

        const result = parseTranscriptJSON(json);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].time, 10);
        assert.strictEqual(result[0].duration, 5);
    });

    it("skips entries with no text segments", () => {
        const json = JSON.stringify({
            events: [
                { tStartMs: 1000, dDurationMs: 500, segs: [] },
                { tStartMs: 2000, dDurationMs: 500, segs: [{ utf8: "Real text" }] },
            ],
        });

        const result = parseTranscriptJSON(json);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].text, "Real text");
    });
});

// ── parseTranscriptXml ───────────────────────────────────────────────────────

describe("parseTranscriptXml", () => {
    it("parses standard XML transcript with start/dur attributes", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
    <text start="0" dur="5">Hello world</text>
    <text start="5.5" dur="3.2">Second line</text>
</transcript>`;

        const result = parseTranscriptXml(xml);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].time, 0);
        assert.strictEqual(result[0].duration, 5);
        assert.strictEqual(result[0].text, "Hello world");
        assert.strictEqual(result[1].time, 5.5);
        assert.strictEqual(result[1].duration, 3.2);
        assert.strictEqual(result[1].text, "Second line");
    });

    it("parses XML with t/d attributes (milliseconds)", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
    <text t="5000" d="3000">Hello</text>
</transcript>`;

        const result = parseTranscriptXml(xml);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].time, 5);
        assert.strictEqual(result[0].duration, 3);
    });

    it("unescapes HTML entities in text", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
    <text start="0" dur="1">rock &amp; roll</text>
</transcript>`;

        const result = parseTranscriptXml(xml);
        assert.strictEqual(result[0].text, "rock & roll");
    });

    it("strips HTML tags from text content", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
    <text start="0" dur="1">Hello <b>world</b></text>
</transcript>`;

        const result = parseTranscriptXml(xml);
        assert.strictEqual(result[0].text, "Hello world");
    });
});
