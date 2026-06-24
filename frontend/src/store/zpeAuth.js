import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useZpeAuth = create()(persist((set, get) => ({
    token: "",
    email: "",
    cookies: {},
    setToken: (token) => set({ token }),
    setEmail: (email) => set({ email }),
    setCookies: (cookies) => set({ cookies }),
    mergeCookies: (cookies) => set({ cookies: { ...get().cookies, ...cookies } }),
    clearCookies: () => set({ cookies: {} }),
    cookieHeader: () => Object.entries(get().cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    clear: () => set({ token: "", cookies: {} }),
}), { name: "zpe-cloud-auth" }));
