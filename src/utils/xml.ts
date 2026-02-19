/**
 * Recursively find all descendant XML nodes matching a predicate.
 */
export function getXMLDescendantNodes(node: Node, isMatch: (n: Node) => boolean): Node[] {
    if (isMatch(node)) return [node];
    if (!node.childNodes?.length) return [];

    const matched: Node[] = [];
    for (const childNode of Array.from(node.childNodes)) {
        if (isMatch(childNode)) {
            matched.push(childNode);
        } else {
            matched.push(...getXMLDescendantNodes(childNode, isMatch));
        }
    }
    return matched;
}
