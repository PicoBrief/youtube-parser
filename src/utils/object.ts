import type { ObjNode } from "../types.js";

/**
 * Recursively find all descendant objects in a nested structure that match a predicate.
 */
export function getAllDescendantObjects(params: {
    rootNode: ObjNode;
    isMatch: (params: { node: ObjNode; parentKey?: string | null }) => boolean;
    parentKey?: string | null;
}): Record<string, any>[] {
    const { rootNode, isMatch, parentKey = null } = params;

    if (Array.isArray(rootNode)) {
        return rootNode.flatMap((rn) => getAllDescendantObjects({ rootNode: rn, isMatch, parentKey }));
    }

    if (typeof rootNode !== "object" || rootNode === null) return [];
    if (isMatch({ node: rootNode })) return [rootNode];

    const results: Record<string, any>[] = [];
    for (const [key, value] of Object.entries(rootNode)) {
        if (isMatch({ node: value, parentKey: key })) {
            results.push(value);
        }
        results.push(...getAllDescendantObjects({ rootNode: value, isMatch, parentKey: key }));
    }
    return results;
}

/**
 * Breadth-first search for a key in a nested object. Returns the value if found.
 */
export function findInObject(obj: Record<string, unknown>, searchKey: string): any {
    const queue: unknown[] = [obj];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current && typeof current === "object") {
            if (Array.isArray(current)) {
                queue.push(...current);
            } else {
                for (const [key, value] of Object.entries(current)) {
                    if (key === searchKey) return value;
                    queue.push(value);
                }
            }
        }
    }

    return [];
}
