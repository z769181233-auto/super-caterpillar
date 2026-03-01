import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SyncSource = 'curve' | 'reader' | 'outline' | null;

type OutlineState = {
  // --- P6.1: Outline State ---
  selectedNodeId?: string;
  expandedNodeIds: Record<string, boolean>;
  userHasInteracted: boolean;
  autoFocusApplied: boolean;
  lastAutoFocusKey?: string;

  // --- P6.2: Bidirectional Sync ---
  activeShotId?: string; // unified active anchor for all three panels
  activeNodeId?: string; // P6.4: active node in tree (Episode/Scene/Shot)
  syncSource: SyncSource; // event source gate / lastActiveSource
  pendingShotId?: string;
  lastSyncAt: number;

  // P6.1 Actions
  markInteracted: () => void;
  setSelected: (nodeId?: string) => void;
  toggleExpanded: (nodeId: string, forceOpen?: boolean) => void;
  setExpanded: (nodeIds: string[]) => void;
  applyAutoFocusOnce: (key: string, _pathIds: string[], _selectNodeId?: string) => void;
  resetSession: () => void;

  // P6.2 Actions
  setActiveShot: (shotId: string, source: SyncSource) => void;
  setPendingShot: (shotId: string) => void;
  commitPendingShot: (source?: SyncSource) => void;
  clearSyncSource: () => void;

  // P6.4 Actions
  setActiveNode: (nodeId: string | null, source?: SyncSource) => void;

  // --- P6.3: Visual Denoise ---
  rolesCollapsed: boolean;
  rolesCollapseMode: 'auto' | 'manual';
  collapsedPanels: Record<string, boolean>;

  // P6.3 Actions
  setRolesCollapsed: (value: boolean, mode?: 'manual' | 'auto') => void;
  togglePanel: (panelKey: string) => void;
};

// 唯一判定“已通过拦截门限”
function checkGatePassed(state: OutlineState, targetKey: string) {
  if (state.userHasInteracted) return false;
  if (state.autoFocusApplied && state.lastAutoFocusKey === targetKey) return false;
  return true;
}

export const useStudioUiStore = create<OutlineState>()(
  persist(
    (set, get) => ({
      selectedNodeId: undefined,
      expandedNodeIds: {},
      userHasInteracted: false,
      autoFocusApplied: false,
      lastAutoFocusKey: undefined,
      activeShotId: undefined,
      activeNodeId: undefined, // P6.4: active node id
      syncSource: null,
      pendingShotId: undefined,
      lastSyncAt: 0,
      rolesCollapsed: false, // default: show (auto-collapsed only if count > 6)
      rolesCollapseMode: 'auto', // 'manual' once user toggles
      collapsedPanels: {},

      markInteracted: () => set({ userHasInteracted: true }),

      setSelected: (nodeId) => set({ selectedNodeId: nodeId }),

      toggleExpanded: (nodeId, forceOpen) =>
        set((state) => ({
          expandedNodeIds: {
            ...state.expandedNodeIds,
            [nodeId]: forceOpen !== undefined ? forceOpen : !state.expandedNodeIds[nodeId],
          },
        })),

      setExpanded: (nodeIds) =>
        set((state) => {
          const next = { ...state.expandedNodeIds };
          nodeIds.forEach((id) => (next[id] = true));
          return { expandedNodeIds: next };
        }),

      applyAutoFocusOnce: (key, pathIds, selectNodeId) => {
        const state = get();
        if (!checkGatePassed(state, key)) return;

        const nextMap = { ...state.expandedNodeIds };
        pathIds.forEach((id) => (nextMap[id] = true));

        set({
          autoFocusApplied: true,
          lastAutoFocusKey: key,
          expandedNodeIds: nextMap,
          ...(selectNodeId ? { selectedNodeId: selectNodeId } : {}),
        });
      },

      resetSession: () =>
        set({
          userHasInteracted: false,
          autoFocusApplied: false,
        }),

      // --- P6.2: Bidirectional Sync Actions ---

      setActiveShot: (shotId, source) =>
        set({
          activeShotId: shotId,
          activeNodeId: shotId, // P6.4: Shot 级别时 activeNodeId 与 activeShotId 同步
          syncSource: source,
        }),

      setPendingShot: (shotId) => set({ pendingShotId: shotId }),

      commitPendingShot: (source = 'reader') => {
        const state = get();
        // Gate check: if source is 'curve', reader must not override
        if (state.syncSource === 'curve') return;
        // Gate check: if source is 'outline', reader must not override
        if (state.syncSource === 'outline') return;
        if (!state.pendingShotId) return;
        set({
          activeShotId: state.pendingShotId,
          syncSource: source,
          pendingShotId: undefined,
          lastSyncAt: Date.now(),
        });
        // Auto-release gate so next interaction from any source is fresh
        queueMicrotask(() => set({ syncSource: null }));
      },

      clearSyncSource: () => set({ syncSource: null }),

      // --- P6.4: Active Node Actions ---
      setActiveNode: (nodeId, source) =>
        set({
          activeNodeId: nodeId ?? undefined,
          // Note: Do NOT touch activeShotId when setting Episode/Scene nodes
          // Only set syncSource if provided (optional for non-shot nodes)
          ...(source ? { syncSource: source } : {}),
        }),

      // --- P6.3: Visual Denoise Actions ---
      setRolesCollapsed: (value, mode = 'manual') =>
        set({
          rolesCollapsed: value,
          rolesCollapseMode: mode,
        }),
      togglePanel: (panelKey) =>
        set((state) => ({
          collapsedPanels: {
            ...state.collapsedPanels,
            [panelKey]: !state.collapsedPanels[panelKey],
          },
        })),
    }),
    {
      name: 'studio:outline:storage', // unique local storage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these keys securely
        selectedNodeId: state.selectedNodeId,
        expandedNodeIds: state.expandedNodeIds,
      }),
    }
  )
);
