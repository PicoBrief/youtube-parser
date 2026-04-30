import fallbackValue from "@pico-brief/fallback_value";

const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Recursively walk a JSON value and substitute `{{path}}` placeholders against
 * the given context.
 *
 * - Whole-string placeholders ("{{x.y}}") preserve the resolved value's type
 *   (object, array, number, etc.) — useful when a body field needs an object.
 * - Embedded placeholders ("a {{x}} b") are interpolated as strings.
 * - Missing paths resolve to the empty string in embedded mode and to
 *   undefined in whole-string mode (the field is omitted from objects).
 */
export function applyTemplate(template: any, context: Record<string, any>): any {
    if (template == null) return template;
    if (typeof template === "string") return substituteString(template, context);
    if (Array.isArray(template)) return template.map((v) => applyTemplate(v, context));
    if (typeof template === "object") {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(template)) {
            const sub = applyTemplate(v, context);
            if (sub !== undefined && sub !== null) out[k] = sub;
        }
        return out;
    }
    return template;
}

function substituteString(str: string, context: Record<string, any>): any {
    const wholeMatch = str.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (wholeMatch) {
        return fallbackValue(context, wholeMatch[1], undefined);
    }
    return str.replace(PLACEHOLDER_RE, (_, path: string) => {
        const v = fallbackValue(context, path.trim(), undefined);
        return v == null ? "" : String(v);
    });
}
