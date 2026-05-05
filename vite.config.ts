import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const llmBase = (env.VITE_LLM_BASE_URL || "").replace(/\/$/, "");

  console.log("[vite config] VITE_LLM_BASE_URL =", llmBase || "(not set)");

  return {
    root: ".",
    build: { outDir: "dist" },
    server: llmBase
      ? {
          proxy: {
            "/api/llm": {
              target: llmBase,
              changeOrigin: true,
              rewrite: (path) => path.slice("/api/llm".length),
            },
          },
        }
      : {},
  };
});
