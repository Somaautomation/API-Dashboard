import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { host: "0.0.0.0", port: 5173 },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "axios", "zustand"],
          charts: ["recharts"],
          ui: ["lucide-react", "clsx", "tailwind-merge", "class-variance-authority"],
        },
      },
    },
  },
});
