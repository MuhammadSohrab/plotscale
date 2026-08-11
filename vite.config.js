import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@supabase")) return "cloud";
          if (id.includes("dexie")) return "local-database";
          if (id.includes("zustand")) return "state";
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            /node_modules[\\/]react[\\/]/.test(id)
          ) return "react-vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
