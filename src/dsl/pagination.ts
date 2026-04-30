import fallbackValue from "@pico-brief/fallback_value";
import { findInObject, getAllDescendantObjects } from "../utils/object.js";
import { getPathsConfig } from "./loader.js";
import type { ContinuationStrategy, PaginationConfig } from "./types.js";

export type ContinuationData = {
    token: string;
    clickTrackingParams: string;
};

/**
 * Locate a continuation endpoint object inside `pageData` using the named
 * strategy from paths.json (e.g. "default", "deep"). Falls through the
 * configured strategy list in order.
 */
function findEndpoint(pageData: any, strategyName: string, cfg: PaginationConfig): any {
    const list = cfg.continuation.strategies[strategyName];
    if (!list) return null;
    for (const strat of list) {
        const ep = runStrategy(pageData, strat);
        if (ep) return ep;
    }
    return null;
}

function runStrategy(pageData: any, strat: ContinuationStrategy): any {
    if (strat.type === "find_key") {
        return findInObject(pageData, strat.key) || null;
    }
    const matches = getAllDescendantObjects({
        rootNode: pageData,
        isMatch: ({ node }) => {
            if (Array.isArray(node) || typeof node !== "object" || node === null) return false;
            const keys = new Set(Object.keys(node).map((k) => k.toLowerCase()));
            return strat.requireKeys.every((rk) => keys.has(rk.toLowerCase()));
        },
    });
    if (matches.length === 0) return null;
    return strat.type === "find_descendant_last" ? matches[matches.length - 1] : matches[0];
}

/**
 * Locate a sort-chip's navigation endpoint by sort name (e.g. "popular").
 * Returns null if the sort chip bar isn't present or the sort name is unknown.
 */
function findSortChipEndpoint(pageData: any, sortBy: string, cfg: PaginationConfig): any {
    const idx = cfg.sortChip.indexBySort[sortBy];
    if (idx === undefined) return null;
    const container = findInObject(pageData, cfg.sortChip.containerKey);
    if (!container) return null;
    const contents = fallbackValue(container, cfg.sortChip.contentsPath, undefined) as any[] | undefined;
    if (!Array.isArray(contents)) return null;
    const chip = contents[idx];
    if (!chip) return null;
    return fallbackValue(chip, cfg.sortChip.endpointPath, undefined);
}

/**
 * Resolve a continuation token + clickTrackingParams from pageData using the
 * configured strategy. When `sortBy` is given (and not the default first
 * entry), the sort-chip endpoint is preferred over the strategy lookup.
 */
export function findContinuation(
    pageData: any,
    strategyName: string,
    sortBy?: string,
    config?: PaginationConfig
): ContinuationData | null {
    const cfg = config ?? getPathsConfig().pagination;
    let endpoint: any = null;
    if (sortBy && cfg.sortChip.indexBySort[sortBy] !== 0) {
        endpoint = findSortChipEndpoint(pageData, sortBy, cfg);
    }
    if (!endpoint) endpoint = findEndpoint(pageData, strategyName, cfg);
    if (!endpoint) return null;

    const token = firstNonNullPath(endpoint, cfg.continuation.tokenPaths);
    const clickTrackingParams = firstNonNullPath(endpoint, cfg.continuation.clickTrackingPaths);
    if (typeof token !== "string" || typeof clickTrackingParams !== "string") return null;
    return { token, clickTrackingParams };
}

function firstNonNullPath(node: any, paths: string[]): unknown {
    for (const p of paths) {
        const v = fallbackValue(node, p, undefined);
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}
