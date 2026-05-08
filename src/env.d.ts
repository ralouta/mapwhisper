/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_WEBMAP_ID: string;
  readonly VITE_OAUTH_APP_ID: string;
  readonly VITE_PORTAL_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
