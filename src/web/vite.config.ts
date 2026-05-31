import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Single-port setup: in dev, Vite runs in middleware mode attached to the
// backend HTTP server (see scripts/dev.ts), so no proxy is needed here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
