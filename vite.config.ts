import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import { componentTagger } from "lovable-tagger";

const datasetCopyPlugin = {
  name: "copy-processed-datasets",
  apply: "build" as const,
  closeBundle() {
    const sourceDir = path.resolve(__dirname, "data/processed");
    const targetDir = path.resolve(__dirname, "dist/data/processed");

    if (!fs.existsSync(sourceDir)) return;

    fs.mkdirSync(targetDir, { recursive: true });
    const files = fs.readdirSync(sourceDir).filter(file => file.toLowerCase().endsWith(".json"));
    files.forEach(file => {
      fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), datasetCopyPlugin].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
