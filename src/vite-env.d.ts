/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Initial choice of the transport switcher; unset keeps v1. */
  readonly VITE_DEFAULT_API_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
