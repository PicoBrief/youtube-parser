import fallbackValue from "@pico-brief/fallback_value";
import type { FieldSpec, FindInArrayExpr, ItemSpec, PathExpr } from "./types.js";
import { applyTransforms } from "./transforms.js";

/**
 * Resolve a single PathExpr against a node. Returns null/undefined when the
 * path doesn't reach a value.
 */
function resolvePath(node: any, expr: PathExpr): unknown {
    if (typeof expr === "string") {
        return fallbackValue(node, expr, undefined);
    }
    return resolveFindInArray(node, expr);
}

/**
 * Walk `expr.find_in_array` (a path with one or more `[*]` markers) and
 * return the first leaf whose string form matches `expr.match`.
 */
function resolveFindInArray(node: any, expr: FindInArrayExpr): unknown {
    const flags = expr.match_case ? "" : "i";
    const re = new RegExp(expr.match, flags);
    const leaves = walkArrayPath(node, expr.find_in_array);
    for (const leaf of leaves) {
        if (typeof leaf === "string" && re.test(leaf)) return leaf;
    }
    return undefined;
}

/**
 * Walk a path with `[*]` array-iteration markers, yielding all leaf values.
 * E.g. `"a.b[*].c[*].text"` will iterate every `b` element's every `c`
 * element's `text` field.
 */
function walkArrayPath(node: any, path: string): unknown[] {
    const segments = path.split(/\[\*\]/);
    let current: any[] = [node];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].replace(/^\.+|\.+$/g, "");
        const isLast = i === segments.length - 1;
        const next: any[] = [];
        for (const item of current) {
            const resolved = seg ? fallbackValue(item, seg, undefined) : item;
            if (resolved == null) continue;
            if (isLast) {
                next.push(resolved);
            } else if (Array.isArray(resolved)) {
                for (const sub of resolved) next.push(sub);
            }
        }
        current = next;
    }
    return current;
}

/**
 * Resolve a FieldSpec against a node: try each path in order, take the first
 * non-null/undefined value, then run the transform pipeline.
 */
export function resolveField(node: any, spec: FieldSpec): unknown {
    let value: unknown = undefined;
    for (const expr of spec.paths) {
        const v = resolvePath(node, expr);
        if (v !== undefined && v !== null) {
            value = v;
            break;
        }
    }
    const transformed = applyTransforms(value, spec.transform);
    if (transformed !== undefined && transformed !== null) return transformed;
    return spec.default ?? transformed;
}

/**
 * Test whether a node qualifies as the given item type. Qualifies iff every
 * field listed in `spec.required` resolves to a non-null/undefined value.
 */
export function nodeMatchesItem(node: any, spec: ItemSpec): boolean {
    if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
    for (const fieldName of spec.required) {
        const fieldSpec = spec.fields[fieldName];
        if (!fieldSpec) return false;
        const v = resolveField(node, fieldSpec);
        if (v === undefined || v === null) return false;
    }
    return true;
}

/** Resolve all fields declared in `spec.fields` against `node`. */
export function resolveItem(node: any, spec: ItemSpec): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, fieldSpec] of Object.entries(spec.fields)) {
        const value = resolveField(node, fieldSpec);
        if (value !== undefined) result[name] = value;
    }
    return result;
}
