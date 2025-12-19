import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

// https://vite.dev/config/
// Use 'docs' for GitHub Pages, 'dist' for Electron
const outDir = process.env.BUILD_TARGET === "pages" ? "docs" : "dist";

export default defineConfig({
    base: "./",
    plugins: [react(), basicSsl()],
    build: {
        outDir,
    },
});
