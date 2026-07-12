/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the PulseBridge server to talk to. Unset in local dev. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
