import { create } from "zustand";

interface LayoutState {
  fullWidth: boolean;
  setFullWidth: (v: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  fullWidth: false,
  setFullWidth: (v) => set({ fullWidth: v }),
}));
