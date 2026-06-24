import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ZpeAuthState {
  token: string;
  email: string;
  cookies: Record<string, string>;
  setToken: (token: string) => void;
  setEmail: (email: string) => void;
  setCookies: (cookies: Record<string, string>) => void;
  mergeCookies: (cookies: Record<string, string>) => void;
  clearCookies: () => void;
  cookieHeader: () => string;
  clear: () => void;
}

export const useZpeAuth = create<ZpeAuthState>()(
  persist(
    (set, get) => ({
      token: "",
      email: "",
      cookies: {},
      setToken: (token) => set({ token }),
      setEmail: (email) => set({ email }),
      setCookies: (cookies) => set({ cookies }),
      mergeCookies: (cookies) => set({ cookies: { ...get().cookies, ...cookies } }),
      clearCookies: () => set({ cookies: {} }),
      cookieHeader: () =>
        Object.entries(get().cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      clear: () => set({ token: "", cookies: {} }),
    }),
    { name: "zpe-cloud-auth" }
  )
);
