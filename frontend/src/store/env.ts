import { create } from "zustand";
import { persist } from "zustand/middleware";

interface EnvState {
  selectedId: string | null;
  set: (id: string | null) => void;
}

export const useActiveEnv = create<EnvState>()(
  persist(
    (set) => ({
      selectedId: null,
      set: (id) => set({ selectedId: id }),
    }),
    { name: "zpe-active-env" }
  )
);
