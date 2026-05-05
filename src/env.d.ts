/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBMAP_ID: string;
  readonly VITE_OAUTH_APP_ID: string;
  readonly VITE_PORTAL_URL: string;
  readonly VITE_LANG_DETECT_PROVIDER?: "heuristic" | "llm" | "hybrid";
  readonly VITE_LLM_BASE_URL?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_MODEL?: string;
  readonly VITE_LLM_API_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
