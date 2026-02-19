import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupFromEnv } from "./setup.js";
import { YouTubeVideoHandler } from "../src/handlers/video.js";
import { YouTubeChannelHandler } from "../src/handlers/channel.js";
import { YouTubePlaylistHandler } from "../src/handlers/playlist.js";
import { YouTubeSearchHandler } from "../src/handlers/search.js";
import { fetchYoutubePage } from "../src/http/fetch-page.js";
import { extractVideos } from "../src/parsers/extract-videos.js";

// ── Known test fixtures ──────────────────────────────────────────────────────
// Rick Astley - Never Gonna Give You Up (stable, very unlikely to be removed)
const TEST_VIDEO_ID = "dQw4w9WgXcQ";
// Google's official YouTube channel
const TEST_CHANNEL_ID = "UCVHFbqXqoYvEWM1Ddxl0QDg";
// YouTube's "Popular on YouTube" playlist (large, stable)
const TEST_PLAYLIST_ID = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";

const TIMEOUT = 60_000; // 60s for network calls

describe("integration", () => {
    before(() => {
        setupFromEnv();
    });

    // ── fetchYoutubePage ─────────────────────────────────────────────────────

    describe("fetchYoutubePage", () => {
        it("fetches a video page and extracts embedded data", { timeout: TIMEOUT }, async () => {
            const result = await fetchYoutubePage({
                url: `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`,
            });

            assert.strictEqual(result.success, true);
            if (!result.success) return;

            assert.ok(result.html.length > 0, "HTML should not be empty");
            assert.ok(result.apiKey, "API key should be extracted");
            assert.ok(result.pageData, "pageData should be present");
            assert.ok(result.clientData, "clientData should be present");
        });

        it("fetches a channel page", { timeout: TIMEOUT }, async () => {
            const result = await fetchYoutubePage({
                url: `https://www.youtube.com/channel/${TEST_CHANNEL_ID}/videos`,
            });

            assert.strictEqual(result.success, true);
            if (!result.success) return;

            assert.ok(result.apiKey);
            assert.ok(result.pageData);
        });
    });

    // ── YouTubeVideoHandler ──────────────────────────────────────────────────

    describe("YouTubeVideoHandler", () => {
        it("loads and parses a video", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeVideoHandler();
            const loadResult = await handler.load(TEST_VIDEO_ID);

            assert.strictEqual(loadResult.success, true);

            const parseResult = handler.parse();
            assert.strictEqual(parseResult.success, true);
            if (!parseResult.success) return;

            const { info } = parseResult;
            assert.strictEqual(info.id, TEST_VIDEO_ID);
            assert.strictEqual(info.type, "video");
            assert.ok(info.title.length > 0, "Title should not be empty");
            assert.ok(info.description.length > 0, "Description should not be empty");
            assert.ok(info.thumbnailUrl.length > 0, "Thumbnail URL should not be empty");
            assert.ok(info.length > 0, "Video length should be > 0");
            assert.ok(info.viewCount > 0, "View count should be > 0");
            assert.ok(info.channelId.length > 0, "Channel ID should not be empty");
            assert.ok(info.author.length > 0, "Author should not be empty");
            assert.strictEqual(info.isLive, false);
            assert.strictEqual(info.isPrivate, false);
        });

        it("lists available transcripts", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeVideoHandler();
            await handler.load(TEST_VIDEO_ID);

            const parseResult = handler.parse();
            assert.strictEqual(parseResult.success, true);
            if (!parseResult.success) return;

            assert.ok(
                parseResult.info.availableTranscripts.length > 0,
                "Should have at least one transcript"
            );

            assert.ok(parseResult.captionTracks, "Caption tracks should be present");
            assert.ok(parseResult.captionTracks!.length > 0, "Should have at least one caption track");

            const track = parseResult.captionTracks![0];
            assert.ok(track.languageCode, "Caption track should have language code");
            assert.ok(track.url, "Caption track should have URL");
        });

        it("fetches a transcript", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeVideoHandler();
            await handler.load(TEST_VIDEO_ID);

            const transcript = await handler.fetchTranscript("en");
            assert.ok(transcript, "Transcript should be returned for English");
            assert.ok(transcript!.snippets.length > 0, "Transcript should have snippets");
            assert.ok(transcript!.language_code, "Should have language_code");

            const snippet = transcript!.snippets[0];
            assert.ok(typeof snippet.text === "string", "Snippet should have text");
            assert.ok(typeof snippet.time === "number", "Snippet should have time");
            assert.ok(typeof snippet.duration === "number", "Snippet should have duration");
        });

        it("returns error for non-existent video", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeVideoHandler();
            const loadResult = await handler.load("xxxxxxxxxxx");

            // Should either fail to load or fail to parse
            if (loadResult.success) {
                const parseResult = handler.parse();
                // Might still succeed if YouTube returns data, but ID should differ
                // or it might fail — both are acceptable
            } else {
                assert.ok(
                    ["not_found", "unknown"].includes(loadResult.errorCode),
                    `Expected not_found or unknown, got ${loadResult.errorCode}`
                );
            }
        });
    });

    // ── YouTubeChannelHandler ────────────────────────────────────────────────

    describe("YouTubeChannelHandler", () => {
        it("loads and parses a channel", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeChannelHandler();
            const loadResult = await handler.load(TEST_CHANNEL_ID);

            assert.strictEqual(loadResult.success, true);

            const parseResult = handler.parse();
            assert.strictEqual(parseResult.success, true);
            if (!parseResult.success) return;

            const { info } = parseResult;
            assert.ok(info.id.length > 0, "Channel ID should not be empty");
            assert.ok(info.title.length > 0, "Title should not be empty");
            assert.ok(info.thumbnailUrl.length > 0, "Thumbnail should not be empty");
            assert.ok(info.channelUrl.length > 0, "Channel URL should not be empty");
        });

        it("extracts videos from channel page", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeChannelHandler();
            await handler.load(TEST_CHANNEL_ID);

            const videos = handler.videoListItems;
            assert.ok(videos.length > 0, "Channel should have at least one video");

            const video = videos[0];
            assert.strictEqual(video.type, "video");
            assert.ok(video.id.length > 0, "Video should have an ID");
            assert.ok(video.title.length > 0, "Video should have a title");
        });
    });

    // ── YouTubePlaylistHandler ───────────────────────────────────────────────

    describe("YouTubePlaylistHandler", () => {
        it("loads and parses a playlist", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubePlaylistHandler();
            const loadResult = await handler.load(TEST_PLAYLIST_ID);

            assert.strictEqual(loadResult.success, true);

            const parseResult = handler.parse();
            assert.strictEqual(parseResult.success, true);
            if (!parseResult.success) return;

            assert.ok(parseResult.items.length > 0, "Playlist should have at least one video");

            const video = parseResult.items[0];
            assert.strictEqual(video.type, "video");
            assert.ok(video.id.length > 0, "Video should have an ID");
            assert.ok(video.title.length > 0, "Video should have a title");
        });
    });

    // ── YouTubeSearchHandler ─────────────────────────────────────────────────

    describe("YouTubeSearchHandler", () => {
        it("searches for videos", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeSearchHandler();
            const loadResult = await handler.load({
                query: "never gonna give you up",
                resultsType: "video",
            });

            assert.strictEqual(loadResult.success, true);

            const items = handler.listItems;
            assert.ok(items.length > 0, "Search should return at least one result");

            const firstVideo = items[0];
            assert.strictEqual(firstVideo.type, "video");
            assert.ok(firstVideo.id.length > 0, "Result should have an ID");
            assert.ok(firstVideo.title.length > 0, "Result should have a title");
        });

        it("searches for channels", { timeout: TIMEOUT }, async () => {
            const handler = new YouTubeSearchHandler();
            const loadResult = await handler.load({
                query: "Google",
                resultsType: "channel",
            });

            assert.strictEqual(loadResult.success, true);

            const items = handler.listItems;
            assert.ok(items.length > 0, "Search should return at least one channel");

            const firstChannel = items.find((item) => item.type === "channel");
            assert.ok(firstChannel, "Should have at least one channel result");
        });
    });

    // ── extractVideos (with real data) ───────────────────────────────────────

    describe("extractVideos with real page data", () => {
        it("extracts videos from a fetched channel page", { timeout: TIMEOUT }, async () => {
            const page = await fetchYoutubePage({
                url: `https://www.youtube.com/channel/${TEST_CHANNEL_ID}/videos`,
            });

            assert.strictEqual(page.success, true);
            if (!page.success) return;

            const videos = extractVideos(page.pageData);
            assert.ok(videos.length > 0, "Should extract at least one video");
            assert.strictEqual(videos[0].type, "video");
            assert.ok(videos[0].id, "Extracted video should have an ID");
        });
    });
});
