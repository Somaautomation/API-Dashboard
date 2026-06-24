import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useTheme = create()(persist((set, get) => ({
    theme: "light",
    toggle: () => {
        const next = get().theme === "light" ? "dark" : "light";
        document.documentElement.classList.toggle("dark", next === "dark");
        set({ theme: next });
    },
}), {
    name: "zpe-theme",
    onRehydrateStorage: () => (state) => {
        document.documentElement.classList.toggle("dark", state?.theme === "dark");
    },
}));
