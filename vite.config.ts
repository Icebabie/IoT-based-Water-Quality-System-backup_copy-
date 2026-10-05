import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When the FastAPI backend exists, add a dev proxy here, e.g.
// server: { proxy: { "/api": "http://localhost:8000" } }
export default defineConfig({
  plugins: [react()],
});
