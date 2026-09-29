import { create } from "zustand";

export type ListFilter = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

type FilterStore = {
  /** Selected owner scope; persisted to cookie and sent as `x-owner-id` on owner-path calls. */
  ownerId: string | null;
  setOwnerId: (id: string | null) => void;
  /** Per-module list UI state (applied over loaded cursor pages, research R4). */
  listFilters: Record<string, ListFilter>;
  setListFilter: (module: string, patch: Partial<ListFilter>) => void;
  resetListFilter: (module: string) => void;
};

export const useFilterStore = create<FilterStore>()((set) => ({
  ownerId: null,
  setOwnerId: (ownerId) => set({ ownerId }),
  listFilters: {},
  setListFilter: (module, patch) =>
    set((s) => ({ listFilters: { ...s.listFilters, [module]: { ...s.listFilters[module], ...patch } } })),
  resetListFilter: (module) =>
    set((s) => {
      const next = { ...s.listFilters };
      delete next[module];
      return { listFilters: next };
    }),
}));
