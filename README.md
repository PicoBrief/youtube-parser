# @pico-brief/youtube-parser

A TypeScript library for parsing YouTube videos, channels, playlists, and search results. Extracts structured data from YouTube pages including video metadata, transcripts, channel info, and more.

## Installation

```bash
npm install @pico-brief/youtube-parser
```

## Quick Start

```typescript
import {
  YouTubeVideoHandler,
  YouTubeChannelHandler,
  YouTubePlaylistHandler,
  YouTubeSearchHandler,
  configure,
} from "@pico-brief/youtube-parser";

// Optional: configure proxy URLs
configure({ proxyUrls: ["http://proxy.example.com:8080"] });
```

## Usage

### Fetch Video Info

```typescript
const handler = new YouTubeVideoHandler();
await handler.load("dQw4w9WgXcQ");

const result = handler.parse();
if (result.success) {
  console.log(result.info.title);       // Video title
  console.log(result.info.viewCount);   // View count
  console.log(result.info.length);      // Duration in seconds
  console.log(result.info.channelId);   // Channel ID
  console.log(result.captionTracks);    // Available caption tracks
}
```

### Fetch Transcript

```typescript
const handler = new YouTubeVideoHandler();
await handler.load("dQw4w9WgXcQ");

const transcript = await handler.fetchTranscript("en");
if (transcript) {
  for (const snippet of transcript.snippets) {
    console.log(`[${snippet.time}s] ${snippet.text}`);
  }
}
```

### Fetch Channel Info & Videos

```typescript
const handler = new YouTubeChannelHandler();
await handler.load("UCxxxxxxxxxxxxxxxxxxxxxxxx");

const result = handler.parse();
if (result.success) {
  console.log(result.info.title);
  console.log(result.info.description);
}

// Get channel videos
console.log(handler.videoListItems);

// Load more videos (pagination)
await handler.fetchMoreVideos();
console.log(handler.videoListItems);
```

### Fetch Playlist Videos

```typescript
const handler = new YouTubePlaylistHandler();
await handler.load("PLxxxxxxxxxxxxxxxxxxxxxxxx");

const result = handler.parse();
if (result.success) {
  console.log(result.items); // Array of YouTubeVideoListItem
}

// Load more videos
await handler.fetchMoreVideos();
console.log(handler.videoListItems);
```

### Search YouTube

```typescript
const handler = new YouTubeSearchHandler();
await handler.load({
  query: "typescript tutorial",
  sortBy: "upload_date",    // "relevance" | "upload_date" | "view_count" | "rating"
  resultsType: "video",     // "video" | "channel" | "playlist" | "movie"
});

console.log(handler.listItems); // Mixed array of video/channel/playlist items

// Load more results
await handler.fetchMoreItems();
```

### Low-Level Utilities

```typescript
import {
  fetchYoutubePage,
  extractVideos,
  parseRawVideoListItem,
  parseListItemData,
  parseAgeText,
  parseDuration,
  extractInnerTubeApiKey,
} from "@pico-brief/youtube-parser";

// Fetch and parse a YouTube page directly
const page = await fetchYoutubePage({ url: "https://www.youtube.com/watch?v=..." });
if (page.success) {
  const videos = extractVideos(page.pageData);
}

// Parse age strings
parseAgeText("3 days ago");    // { amount: 3, unit: "day" }

// Parse duration strings
parseDuration("1:30:45");      // 5445 (seconds)
```

## Configuration

### Proxy Support

Configure proxy URLs for all HTTP requests. Useful for distributed scraping:

```typescript
import { configure } from "@pico-brief/youtube-parser";

configure({
  proxyUrls: [
    "http://proxy1.example.com:8080",
    "http://user:pass@proxy2.example.com:8080",
    "http://proxy3.example.com/:sessionId",  // :sessionId is replaced with a random value
  ],
});
```

When multiple proxy URLs are configured, a random one is selected for each request.

## API Reference

### Handlers

| Handler | Description |
|---------|-------------|
| `YouTubeVideoHandler` | Load and parse individual video pages, fetch transcripts |
| `YouTubeChannelHandler` | Load and parse channel pages, list channel videos |
| `YouTubePlaylistHandler` | Load and parse playlists, list playlist videos |
| `YouTubeSearchHandler` | Search YouTube, supports sorting and filtering |

### Types

| Type | Description |
|------|-------------|
| `YouTubeVideoInfo` | Full video metadata (title, description, views, etc.) |
| `YouTubeChannelInfo` | Channel metadata (title, description, banner, RSS URL) |
| `YouTubeVideoListItem` | Brief video summary in a list |
| `YouTubeChannelListItem` | Brief channel summary in a list |
| `YouTubePlaylistListItem` | Brief playlist summary in a list |
| `Transcript` | Full transcript with snippets |
| `TranscriptSnippet` | Single transcript entry (text, time, duration) |
| `CaptionTrack` | Available caption track info |
| `TimeUnit` | `"second" \| "minute" \| "hour" \| "day" \| "week" \| "month" \| "year"` |
| `SearchSortBy` | `"relevance" \| "upload_date" \| "view_count" \| "rating"` |
| `SearchResultsType` | `"video" \| "channel" \| "playlist" \| "movie"` |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## License

ISC
