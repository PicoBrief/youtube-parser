const HTML_ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
};

export function unescapeHtml(text: string): string {
    return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => HTML_ENTITIES[match] || match);
}

/**
 * Extract a substring from HTML between a start key and a stop marker.
 * `numChars` is the number of characters to skip after the key before the value starts.
 */
export function getJsonFromHtml(html: string, key: string, numChars: number = 2, stop: string = '"'): string {
    const startPos = html.indexOf(key) + key.length + numChars;
    const endPos = html.indexOf(stop, startPos);
    return html.substring(startPos, endPos);
}

/**
 * Extract the InnerTube API key from raw YouTube HTML.
 */
export function extractInnerTubeApiKey(html: string): string | null {
    const match = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    return match?.[1] ?? null;
}
