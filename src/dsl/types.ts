/**
 * Path-extraction DSL types. The DSL drives field extraction from YouTube's
 * page-data objects so that layout shifts can be patched by editing
 * `paths.json` rather than republishing the package.
 */

/** A path expression. Either a dotted/bracketed string path, or a structured operator. */
export type PathExpr = string | FindInArrayExpr;

/**
 * Walk an array (or array-of-arrays via multiple `[*]` markers) and return the
 * first leaf whose value matches `match`. The `at` path uses `[*]` to indicate
 * iteration, e.g. `"a.b[*].c[*].text"`.
 */
export type FindInArrayExpr = {
    find_in_array: string;
    /** Regex source. Tested case-insensitively unless `match_case` is true. */
    match: string;
    match_case?: boolean;
};

/** Specification for extracting one field from a raw item. */
export type FieldSpec = {
    /** Tried in order; first non-null/undefined value wins. */
    paths: PathExpr[];
    /** Named transform(s) applied left-to-right on the resolved value. */
    transform?: string | string[];
    /** Returned when no path resolves and no transform produces a value. */
    default?: unknown;
};

/** Specification for one type of list item (e.g. videoListItem). */
export type ItemSpec = {
    /** Field names that must all resolve for an object to qualify as this item type. */
    required: string[];
    /** Field-name → FieldSpec map. */
    fields: Record<string, FieldSpec>;
};

/** A single HTML JSON-block extraction pattern. */
export type HtmlBlockPattern = {
    /** Marker substring to locate in the HTML. */
    key: string;
    /** Characters to skip after the key before the JSON value starts. */
    numChars: number;
    /** Stop marker; the substring up to (but excluding) this is treated as the body. */
    stop: string;
    /** String appended to the extracted body to form valid JSON. */
    suffix: string;
};

/** HTML-level extraction config: API key patterns + named JSON blocks. */
export type HtmlExtractConfig = {
    apiKey: { patterns: string[] };
    blocks: Record<string, HtmlBlockPattern[]>;
};

/** Strategy for locating a continuation endpoint object inside pageData. */
export type ContinuationStrategy =
    | { type: "find_key"; key: string }
    | { type: "find_descendant_last"; requireKeys: string[] }
    | { type: "find_descendant_first"; requireKeys: string[] };

/** Pagination config: how to extract continuation tokens and shape requests. */
export type PaginationConfig = {
    continuation: {
        strategies: Record<string, ContinuationStrategy[]>;
        tokenPaths: string[];
        clickTrackingPaths: string[];
    };
    sortChip: {
        containerKey: string;
        contentsPath: string;
        endpointPath: string;
        indexBySort: Record<string, number>;
    };
    request: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body: any;
    };
};

/** Top-level config (the structure of paths.json). */
export type PathsConfig = {
    version: number;
    html: HtmlExtractConfig;
    pagination: PaginationConfig;
    videoListItem: ItemSpec;
};

/** Function signature for a named transform. */
export type Transform = (input: unknown) => unknown;
