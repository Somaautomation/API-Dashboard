import axios from "axios";
import { useAuthStore } from "@/store/auth";
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? "https://api.qa-zpecloud.com/api/v1",
    timeout: 300_000, // 5 min — long-running calls like k6 runs need extra headroom
});
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
api.interceptors.response.use((r) => r, (error) => {
    if (error.response?.status === 401) {
        useAuthStore.getState().logout();
    }
    return Promise.reject(error);
});
