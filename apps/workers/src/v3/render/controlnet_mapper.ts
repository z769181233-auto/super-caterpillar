/**
 * Standardized ControlNet Settings Structure
 * Corresponds to V3.0 Phase P1-2 Spec
 */
export interface ControlNetSettings {
    modules: ControlNetModule[];
}

export interface ControlNetModule {
    type: 'canny' | 'depth' | 'pose' | 'openpose' | 'scribble' | 'reference_only';
    model?: string;
    weight: number;
    guidanceStart?: number;
    guidanceEnd?: number;
    inputImage?: string; // Relative path (C1)
    pixelPerfect?: boolean;
    controlMode?: 'Balanced' | 'My prompt is more important' | 'ControlNet is more important';
}

/**
 * Standardized Asset Bindings (C1 Complaint)
 * Maps logical keys to storage relative paths
 */
export interface AssetBindings {
    [key: string]: string; // e.g., "character_ref_0": "project_x/assets/char_0.png"
}

export class ControlNetMapper {
    // private readonly logger = new Logger(ControlNetMapper.name);

    /**
     * Map Graph State Snapshot to ControlNet Settings
     * Heuristic logic to determine which ControlNets are needed based on character state, items, or environment.
     */
    static mapFromGraphState(graphState: any, refSheetId?: string): { settings: ControlNetSettings; bindings: AssetBindings } {
        const settings: ControlNetSettings = { modules: [] };
        const bindings: AssetBindings = {};

        if (!graphState) {
            return { settings, bindings };
        }

        // 1. Character Reference Logic (Reference Only)
        // If graph state has characters, we might want to bind their reference sheet
        if (graphState.characters && Array.isArray(graphState.characters) && graphState.characters.length > 0) {
            const char = graphState.characters[0]; // Focus on primary character for MVP

            // If we have a reference sheet binding ID, we can assume there's a reference image
            // ideally we'd know the path, but for now we simulate the intention
            // In a real flow, we'd lookup the asset path from the refSheetId
            if (refSheetId) {
                // Heuristic: Use Reference Only for consistency
                // Note: Actual image path resolution requires DB lookup, here we just set the intention
                // The renderer will resolve 'binding:character_ref_primary' to the actual path
                bindings['character_ref_primary'] = `_dynamic/refs/${char.id || 'unknown'}_ref.png`; // Placeholder relative path

                settings.modules.push({
                    type: 'reference_only',
                    weight: 0.8,
                    inputImage: 'binding:character_ref_primary', // Logical binding reference
                    controlMode: 'Balanced'
                });
            }
        }

        // 2. Action/Pose Logic
        // If character status implies specific action (e.g. "running", "sitting")
        // We could enable OpenPose. For now, strict mapping is not implemented, just structure.

        // 3. Environment/Depth Logic
        // If locations implies complexity, maybe Depth?

        return { settings, bindings };
    }

    /**
     * Validate that all asset paths are C1 compliant
     * Rule: Must NOT start with /, must not contain .., must not contain ://
     * Allowlist: Must start with "assets/" or "_dynamic/"
     */
    static validateBindings(bindings: AssetBindings): { valid: boolean; error?: string } {
        for (const key of Object.keys(bindings)) {
            const path = bindings[key];
            if (!path) continue;

            // 1. Blacklist check
            if (path.startsWith('/') || path.match(/^[A-Za-z]:\\/) || path.includes('..') || path.includes('://')) {
                return { valid: false, error: `Invalid (Blacklisted) Path in binding [${key}]: ${path}` };
            }

            // 2. Allowlist check
            if (!path.startsWith('assets/') && !path.startsWith('_dynamic/')) {
                return { valid: false, error: `Invalid (Non-Allowlisted) Path in binding [${key}]: ${path}. Must start with 'assets/' or '_dynamic/'` };
            }
        }
        return { valid: true };
    }

    /**
     * Resolve a binding reference to a physical C1 path.
     * @param inputImage The input string from ControlNet settings (e.g. "binding:character_ref_primary")
     * @param bindings The map of available bindings
     * @returns The resolved relative path (e.g. "_dynamic/refs/char_001.png")
     * @throws Error if resolution fails or path is invalid
     */
    static resolveBinding(inputImage: string, bindings: AssetBindings): string {
        if (!inputImage.startsWith('binding:')) {
            // If it's not a binding reference, treat as direct path (must still be C1 compliant)
            // Reuse validate logic for single path check? simplified inline check:
            const singleBinding = { '_direct_check': inputImage };
            const validation = this.validateBindings(singleBinding);
            if (!validation.valid) {
                throw new Error(`Invalid direct input path: ${inputImage}. ${validation.error}`);
            }
            return inputImage;
        }

        const bindingKey = inputImage.replace('binding:', '');
        const resolvedPath = bindings[bindingKey];

        if (!resolvedPath) {
            throw new Error(`Binding key not found: ${bindingKey}`);
        }

        // Double check validity of the resolved path
        const validation = this.validateBindings({ [bindingKey]: resolvedPath });
        if (!validation.valid) {
            throw new Error(`Resolved path invalid: ${validation.error}`);
        }

        return resolvedPath;
    }
}
