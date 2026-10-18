import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:8888",
        changeOrigin: true
      }
    }
  }
});
