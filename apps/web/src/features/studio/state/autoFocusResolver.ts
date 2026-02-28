import { ScriptNode } from "../types";

export type AutoFocusResult = {
    expandPathIds: string[];
    selectNodeId: string;
} | null;

/**
 * Empty stage safety mechanism (AutoFocus Resolver)
 * Evaluates the tree outline to decide automatic initial focus logic
 * 
 * Rules:
 * 1. If only 1 Episode & 1 Scene & 1 Shot: Focus & expand to the only Shot.
 * 2. If only 1 Episode & (has multiple Scenes): Expand Episode. If inside that there is only 1 Scene, expand Scene too. Select the "best" target (Shot preferably).
 * 3. Default: return null, avoid interfering with users.
 */
export function resolveAutoFocus(
    tree: ScriptNode[],
    counts: { episodes: number; scenes: number; shots: number },
    existingSelection?: string
): AutoFocusResult {
    // If the user currently has an active selection (cached or linked), do not interfere
    if (existingSelection) return null;

    if (counts.episodes === 0 || tree.length === 0) return null;

    // Rule 1 & 2: At most 1 episode
    if (counts.episodes === 1) {
        const theOnlyEp = tree[0];
        if (theOnlyEp.type !== 'episode' || !('children' in theOnlyEp)) return null;

        const expandPathIds: string[] = [theOnlyEp.id];
        let selectNodeId: string | undefined = undefined;

        // If specifically 1 Scene
        if (counts.scenes === 1 && theOnlyEp.children.length === 1) {
            const theOnlySc = theOnlyEp.children[0];
            if (theOnlySc.type === 'scene' && 'children' in theOnlySc) {
                expandPathIds.push(theOnlySc.id);
                // Try grabbing the first shot
                if (theOnlySc.children.length > 0) {
                    selectNodeId = theOnlySc.children[0].id;
                } else {
                    selectNodeId = theOnlySc.id; // Fallback to scene
                }
            }
        } else {
            // we have 1 Episode, but MULTIPLE scenes.
            // Still expand the episode, but we shouldn't force select a specific scene/shot automatically.
            return { expandPathIds, selectNodeId: theOnlyEp.id };
        }

        if (selectNodeId) {
            return { expandPathIds, selectNodeId };
        }
    }

    return null; // For standard multi-episode projects, leave as is
}
