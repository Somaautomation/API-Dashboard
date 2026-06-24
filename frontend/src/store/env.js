import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useActiveEnv = create()(persist((set) => ({
    selectedId: null,
    set: (id) => set({ selectedId: id }),
}), { name: "zpe-active-env" }));
