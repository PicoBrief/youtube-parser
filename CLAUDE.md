# CLAUDE.md — Agent guide to `@pico-brief/youtube-parser`

This file is for LLM coding agents (Claude Code, Cursor, etc.) working in this
repo. It explains the architecture, the JSON-driven extraction system, and the
common task patterns so an agent can act competently after reading just this
file.

> **Scheduled health-check agents:** read [MAINTENANCE.md](./MAINTENANCE.md)
> for the autonomous run procedure (test → triage → JSON-fix → verify →
> push). That file's policies override anything here for scheduled runs.

## What this library does

A TypeScript library that scrapes structured data from YouTube's web pages
(no API key required from the consumer) and exposes it through a small set of
handler classes:

- `YouTubeVideoHandler` — full video metadata, transcripts, caption tracks.
- `YouTubeChannelHandler` — channel metadata + paginated video list.
- `YouTubePlaylistHandler` — playlist metadata + paginated video list.
- `YouTubeSearchHandler` — paginated mixed search results (videos / channels / playlists).

It works by fetching the relevant YouTube HTML page, extracting embedded JSON
blobs (`ytInitialData`, `INNERTUBE_CONTEXT`, `ytInitialPlayerResponse`), and
reading fields out of those blobs. Pagination uses YouTube's internal
InnerTube `/youtubei/v1/{browse,search}` API with continuation tokens
extracted from the page's pageData.

## Why the codebase is shaped the way it is

YouTube reshuffles its page layouts and ViewModel shapes a few times a year.
Without care, every reshuffle would force an `npm publish`. To minimise that,
**all brittle extraction logic — HTML markers, field paths, value transforms,
continuation lookup, request shape — is configured in a single JSON file at
`src/paths.json`.** Code reads from that JSON; consumers can also fetch a
fresh `paths.json` from this repo's `main` branch and call `setPathsConfig`
to get the latest extraction logic without upgrading the package.

A new code release is needed only when YouTube introduces a value format that
no existing transform recognises (for example, a brand-new abbreviation
system). Every other reshuffle is a JSON edit.

## Repository layout

```
src/
  index.ts                  Public re-exports (everything consumers can import)
  config.ts                 Library-wide config (proxy URLs)
  types.ts                  Public types: handler results, list items, page-data shapes
  declarations.d.ts
  paths.json                THE config file. See "DSL config" below.

  dsl/
    types.ts                TS types for paths.json structure
    loader.ts               getPathsConfig / setPathsConfig / resetPathsConfig
    transforms.ts           Named value transforms: abbreviated_count, duration, age_text, …
    resolver.ts             Path resolver: resolveField, resolveItem, nodeMatchesItem
    template.ts             {{var}}-substitution engine for request templates
    html-extract.ts         extractApiKey, extractJsonBlock — HTML → JSON
    pagination.ts           findContinuation — locate continuation tokens

  http/
    fetch-page.ts           fetchYoutubePage: HTTP + html-extract + retry on consent challenge
    pagination.ts           fetchNextPage: render request from JSON template, send to InnerTube
    request.ts              Low-level axios wrapper
    proxy.ts                Proxy URL selection / sessionId substitution

  parsers/
    extract-videos.ts       extractVideos(pageData) — walks tree, finds video items, parses
    video-list-item.ts      parseVideoListItem(raw) — single item → YouTubeVideoListItem
    list-item.ts            parseListItemData — heterogeneous (video/channel/playlist) router used by search
    age.ts                  parseAgeText: "3 days ago" / "9d ago" → { amount, unit }
    duration.ts             parseDuration: "1:30:45" → seconds
    transcript.ts           parseTranscriptJSON, parseTranscriptXml

  handlers/
    video.ts                YouTubeVideoHandler + parseBackendData
    channel.ts              YouTubeChannelHandler
    playlist.ts             YouTubePlaylistHandler
    search.ts               YouTubeSearchHandler

  utils/
    object.ts               findInObject (BFS), getAllDescendantObjects
    html.ts                 unescapeHtml, getJsonFromHtml (legacy util), re-export of extractInnerTubeApiKey
    misc.ts                 removeDuplicates, isTrue, isJSON, getBaseLanguageCode, extractErrorMessage
    async.ts                racePromises (run N candidates in parallel, take first to succeed)
    xml.ts

tests/
  setup.ts                  setupFromEnv: loads PROXY_URLS env, calls configure(...)
  parsers.test.ts           Unit tests for parsers (mock data)
  utils.test.ts             Unit tests for utils
  http.test.ts              Unit tests for http helpers (mocked)
  config.test.ts            Configure() unit tests
  dsl.test.ts               Unit tests for the DSL (transforms, resolver, template, html-extract, pagination)
  integration.test.ts       Live network tests — fetches real YouTube pages

(paths.json lives at src/paths.json — that path is the canonical raw-GitHub URL.)
```

## DSL config — `src/paths.json`

Top-level shape (TypeScript: `PathsConfig` in `src/dsl/types.ts`):

```jsonc
{
  "version": 1,
  "html": {
    "apiKey": { "patterns": [ /* regex strings; first capture group = key */ ] },
    "blocks": {
      "innerTubeContext": [ { "key": "INNERTUBE_CONTEXT", "numChars": 2, "stop": "\"}},", "suffix": "\"}}" } ],
      "ytInitialData": [ /* … */ ],
      "ytInitialPlayerResponse": [ /* … */ ]
    }
  },
  "pagination": {
    "continuation": {
      "strategies": {
        "default": [ { "type": "find_key", "key": "continuationEndpoint" } ],
        "deep":    [ { "type": "find_descendant_last", "requireKeys": ["clickTrackingParams","continuationCommand"] } ]
      },
      "tokenPaths": [ "continuationCommand.token" ],
      "clickTrackingPaths": [ "clickTrackingParams" ]
    },
    "sortChip": {
      "containerKey": "feedFilterChipBarRenderer",
      "contentsPath": "contents",
      "endpointPath": "chipCloudChipRenderer.navigationEndpoint",
      "indexBySort": { "newest": 0, "popular": 1, "oldest": 2 }
    },
    "request": {
      "url": "https://www.youtube.com/youtubei/v1/{{endpoint}}?key={{apiKey}}",
      "method": "POST",
      "headers": {
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": "{{clientData.client.clientVersion}}",
        "User-Agent": "...",
        "Accept-Language": "en"
      },
      "body": {
        "context": {
          "clickTracking": { "clickTrackingParams": "{{clickTrackingParams}}" },
          "client": "{{clientData.client}}"
        },
        "continuation": "{{continuationToken}}"
      }
    }
  },
  "videoListItem": {
    "required": [ "id", "title", "thumbnail" ],
    "fields": {
      "id":          { "paths": [ "videoId", "contentId" ] },
      "title":       { "paths": [ "title.runs[0].text", "title.simpleText", "metadata.lockupMetadataViewModel.title.content" ] },
      "thumbnail":   { "paths": [ "thumbnail.thumbnails[0].url", "contentImage.thumbnailViewModel.image.sources[0].url" ] },
      "length":      { "paths": [ "lengthText.simpleText", { "find_in_array": "...overlays[*]...badges[*].thumbnailBadgeViewModel.text", "match": "^\\d+(:\\d+){1,2}$" } ], "transform": "duration" },
      "viewCount":   { "paths": [ "viewCountText.simpleText", { "find_in_array": "...metadataRows[*].metadataParts[*].text.content", "match": "view" } ], "transform": "abbreviated_count" },
      "age":         { "paths": [ "publishedTimeText.simpleText", { "find_in_array": "...metadataRows[*].metadataParts[*].text.content", "match": "ago" } ], "transform": "age_text" },
      "channelName": { "paths": [ "shortBylineText.runs[0].text" ] },
      "channelId":   { "paths": [ "shortBylineText.runs[0].navigationEndpoint.browseEndpoint.browseId" ] }
    }
  }
}
```

### How fields resolve (`src/dsl/resolver.ts`)

A `FieldSpec` looks like:
```ts
{ paths: PathExpr[], transform?: string | string[], default?: unknown }
```
- Each path is tried in order; the first non-null/undefined result wins.
- `PathExpr` is either a dotted/bracketed string (`"a.b[0].c"`) passed to
  `@pico-brief/fallback_value`, or a `FindInArrayExpr`:
  ```ts
  { find_in_array: "a.b[*].c[*].text", match: "regex", match_case?: boolean }
  ```
  which walks every `[*]` axis and returns the first leaf whose string form
  matches the regex (case-insensitive by default).
- The resolved value is passed through the named transform(s) in
  `transform` (single name or array, applied left-to-right).

### Transforms (`src/dsl/transforms.ts`)

| Name | Behavior |
|---|---|
| `abbreviated_count` | Parses count strings: plain integers, comma-separated, `K/M/B/T`, and CJK suffixes `千/万/萬/亿/億`. **Important:** `K = 10³` but `万 = 10⁴` — they are intentionally distinct. |
| `duration` | `"mm:ss"` / `"hh:mm:ss"` / `"dd:hh:mm:ss"` → seconds. |
| `age_text` | Delegates to `parseAgeText`. Handles `"3 days ago"` and `"9d ago"`. |
| `id_from_channel_url` | Extracts `UC…` from `/channel/UC…` paths or full URLs. |
| `to_int` | Parses an int (accepts comma separators). |
| `trim` | String trim, no-op for non-strings. |

Adding a new transform: append to `TRANSFORMS` in `src/dsl/transforms.ts`,
add a unit test in `tests/dsl.test.ts`, then it becomes callable by name
from `paths.json`.

### Item detection (`nodeMatchesItem`)

`extractVideos` walks the entire pageData tree and qualifies a node as a
video item iff **every field listed in `videoListItem.required` resolves**
through at least one of its declared paths. This naturally rejects bare
`watchEndpoint` objects (which have `videoId` but no title/thumbnail).
Adding a new layout = adding paths under `fields[*]`. No detection code
changes needed.

### Template engine (`src/dsl/template.ts`)

`applyTemplate(template, ctx)` recursively walks any JSON value and
substitutes `{{path}}` placeholders. Two important behaviors:

1. **Whole-string placeholders preserve type.** `"client": "{{clientData.client}}"`
   substitutes the entire `clientData.client` object, not its string form.
2. **Embedded placeholders interpolate as strings.** `"https://x/{{a}}"`
   produces `"https://x/<a>"`.
3. **Null / undefined → omit.** If a whole-string placeholder resolves to
   null or undefined, the key is dropped from the output object.

Used by `http/pagination.ts` to render the InnerTube request URL, headers,
and body from `paths.json → pagination.request`.

### HTML extraction (`src/dsl/html-extract.ts`)

- `extractApiKey(html)` — tries each regex in `html.apiKey.patterns`,
  returns the first capture-group match.
- `extractJsonBlock(html, blockName)` — for each pattern under
  `html.blocks[blockName]`, takes `html.indexOf(key) + key.length + numChars`
  through `html.indexOf(stop, …)`, appends `suffix`, and tries `JSON.parse`.
  Returns the first successfully parsed result, or `null`.

`fetch-page.ts` calls these for `INNERTUBE_CONTEXT` (→ clientData),
`ytInitialData` (→ pageData), `ytInitialPlayerResponse` (→ playerData,
optional). Missing `clientData` or `pageData` throws so the outer
try/catch returns a failure result.

### Pagination (`src/dsl/pagination.ts` + `src/http/pagination.ts`)

`findContinuation(pageData, strategyName, sortBy?)`:
- If `sortBy` is non-default (not `"newest"` / index 0), looks for the
  sort-chip endpoint at
  `feedFilterChipBarRenderer.contents[indexBySort[sortBy]].chipCloudChipRenderer.navigationEndpoint`.
- Otherwise runs the named strategy from
  `pagination.continuation.strategies[strategyName]`. Two strategy types:
  - `find_key` — `findInObject(pageData, key)`.
  - `find_descendant_first | _last` — collect every descendant whose keys
    contain all `requireKeys`, return the first or last.
- Resolves `token` and `clickTrackingParams` from the endpoint object via
  the configured `tokenPaths` / `clickTrackingPaths` lists.

Strategies in use:
- `default` — channel, search.
- `deep` — playlist (where `findInObject(pageData, "continuationEndpoint")`
  returns the wrong endpoint, so we walk for the deepest valid one).

`fetchNextPage({ endpoint, apiKey, proxyUrl, clientData, pageData, strategy, sortBy })`
calls `findContinuation`, builds the substitution context
`{ endpoint, apiKey, clientData, continuationToken, clickTrackingParams }`,
renders URL/headers/body via `applyTemplate`, and POSTs.

## Handler lifecycle pattern

All four handlers follow the same pattern:

```ts
const h = new YouTubeFooHandler();
const loadResult = await h.load(idOrParams);    // fetch + parse + retry up to 3x
if (!loadResult.success) { /* inspect loadResult.errorCode */ }

const result = h.parse();                        // synchronous re-parse from cached pageData
if (result.success) { /* result.info / result.items */ }

await h.fetchMoreVideos();                       // pagination — appends to internal list, dedupes by id
console.log(h.videoListItems);                   // accumulated list
```

Retry semantics: handlers retry `load(...)` up to 3 times unless the error
is in `NON_RETRYABLE_ERRORS = ["not_found", "member_only"]`.

`HandlerErrorCode` values: `"unknown" | "not_found" | "member_only" |
"youtube.apiKey.notFound" | "not_loaded"`.

## Build / module config

- `tsconfig.json` uses `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`,
  `"resolveJsonModule": true`. **This is required** because `paths.json` is
  imported via `import defaultPaths from "../paths.json" with { type: "json" }`
  in `src/dsl/loader.ts`, and Node 24+ requires the import attribute at
  runtime — only NodeNext accepts the attribute syntax in source.
- `npm run build` invokes `tsc -p tsconfig.build.json`. tsc copies
  `src/paths.json` to `dist/paths.json` automatically because it's an
  imported JSON module.
- `package.json` `"files": ["dist"]` ships the compiled JS plus
  `dist/paths.json`.

## Tests

- Test runner: native `node --test` with the `tsx` import hook.
- `npm test` — all tests, including integration.
- `npm run test:unit` — unit tests only (no network).
- `npm run test:integration` — integration tests only.
- `tests/setup.ts` reads `PROXY_URLS` from the environment (a comma- or
  newline-separated list) and calls `configure({ proxyUrls })` before live
  tests run.
- Integration tests hit live YouTube. They are mildly flaky because YouTube
  serves multiple layout variants and intermittently throttles. Re-run
  before assuming a regression.

## Common task playbook

### "YouTube renamed a field path"

Edit the relevant entry in `src/paths.json` to add the new path **before** the
old one in the `paths` array (so new requests find the new path; old
cached HTML still works). Run `npm test`. Commit, push to `main` — consumers
who fetch `paths.json` from main get the fix immediately.

### "YouTube introduced a new layout (e.g. a new ViewModel)"

Same as above: append paths to each affected field's `paths` array. The
`required` list ensures detection still works as long as `id`, `title`,
and `thumbnail` all resolve through *some* path.

### "YouTube uses a new value format my transform doesn't understand"

This *does* require code. Add a transform function in
`src/dsl/transforms.ts`, register it in the `TRANSFORMS` table, add a unit
test in `tests/dsl.test.ts`, then update the relevant field's `transform`
in `paths.json` to use it. Bump version, publish.

### "Add a new field to the parsed video list item"

1. Add the field to `YouTubeVideoListItem` in `src/types.ts`.
2. Add a `paths` (and optional `transform`) entry under
   `videoListItem.fields[NEW_FIELD]` in `src/paths.json`.
3. Plumb the field in `parseVideoListItem` (`src/parsers/video-list-item.ts`)
   so it's surfaced in the typed return.
4. Add a unit test under `parseVideoListItem` in `tests/parsers.test.ts`.

### "The continuation lookup broke"

Check `pagination.continuation.strategies` in `paths.json`. The most
likely scenarios:
- `continuationEndpoint` was renamed → add the new key to the `default`
  strategy as a second `find_key` entry.
- A handler is hitting the wrong endpoint → switch its `strategy` to
  `"deep"` (or add a new named strategy).
- Token sub-path moved → add to `tokenPaths` array.

### "Add a new handler (e.g. YouTubeShortsHandler)"

1. Create `src/handlers/shorts.ts` mirroring the shape of `channel.ts`.
2. Reuse `extractVideos` if the items match the existing `videoListItem`
   spec; otherwise add a new top-level item type to `paths.json` (e.g.
   `shortsListItem`) and resolve via `resolveItem` directly.
3. For pagination, add a strategy under `pagination.continuation.strategies`
   if the existing `default` / `deep` don't fit.
4. Export from `src/index.ts`.

## Pitfalls

- **Resolver and template engine treat `null` and `undefined` the same**
  ("missing → try next path / omit key"). YouTube page data sometimes
  contains a literal `null` for fields that don't apply to an item, and
  we want to fall through to the next path in either case. Don't write
  code in the DSL pipeline that depends on distinguishing the two.
  (Note: `@pico-brief/fallback_value` ≥ 1.0.2 returns `undefined` for
  missing paths; older 1.0.1 returned `null`. The DSL is robust to either.)
- **`getAllDescendantObjects` walks into matched nodes.** It returns
  matches *and* keeps recursing. Fine for deduplicated extraction
  (`extractVideos` dedupes by id), but be careful when adding new
  matchers.
- **Integration test variance.** YouTube serves both legacy renderer and
  `lockupViewModel` layouts on the same channel page non-deterministically.
  The DSL handles both; tests pass against either. If a single run fails,
  re-run before debugging.
- **Don't import `paths.json` directly in non-DSL code.** Always go
  through `getPathsConfig()` so consumers' `setPathsConfig` overrides
  take effect.
- **`@pico-brief/fallback_value` path syntax** uses `[N]` for array
  indexing. The DSL adds `[*]` for array iteration in `find_in_array`
  expressions — that's a DSL extension, not native fallbackValue syntax.
- **HTML JSON-block extraction is fragile by design.** The marker
  patterns (`"INNERTUBE_CONTEXT"`, `"var ytInitialData = "`) and stop
  sequences are exact-match on raw HTML. If a YouTube page has those
  tokens in unexpected places (e.g. inside a string literal earlier on
  the page), extraction will fail. Adding a more specific marker (like
  `"INNERTUBE_CONTEXT\":"`) is the right fix — bump the
  `html.blocks[*]` array with a more-specific pattern *first* and keep
  the looser one as fallback.

## Pinning and consumer override workflow

Consumers should fetch `paths.json` from a pinned commit SHA in
production (so a bad config push to main doesn't immediately break them):

```ts
const PATHS_URL = "https://raw.githubusercontent.com/PicoBrief/youtube-parser/<commit-sha>/src/paths.json";
const config = await fetch(PATHS_URL).then(r => r.json());
setPathsConfig(config);
```

Or fall back to the bundled default by simply not calling `setPathsConfig`.

## Versioning

- Bump **patch** when paths.json schema is unchanged and behavior is
  preserved.
- Bump **minor** when adding new transforms, new pagination strategies,
  new public API surface (no breaking changes).
- Bump **major** when changing the public API of handlers or the
  `paths.json` schema in a way that requires consumers' overrides to
  change.

The `paths.json` `version` field is independent of the package
`semver` and should be bumped when the schema changes (current: 1).
