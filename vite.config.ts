import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type PluginOption } from "vite";

// `tailwindcss()` returns a Plugin typed against `@tailwindcss/vite`'s
// vendored copy of `vite`, which doesn't structurally match the project's
// `vite` types. The runtime objects are interchangeable; cast the whole
// array to bypass the type-identity collision.
const plugins = [react(), tailwindcss()] as unknown as PluginOption[];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // Force a single React + react-dom + jsx-runtime instance across the bundle.
    // pnpm's symlinked node_modules + multiple transitive React-using packages
    // were producing two React Internals objects, which left the hooks
    // dispatcher (`Internals.H`) unset on the React instance that the user
    // code imported — every useState() call crashed with "null is not an
    // object (evaluating 'X.H.useState')". Deduping fixes it deterministically.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Inline sourcemaps so iOS/Android stack traces resolve to real file:line
    // instead of minified positions like "index-XYZ.js:443:5796". Adds a few
    // hundred KB to the bundle but only loaded when DevTools is attached.
    sourcemap: "inline",
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
