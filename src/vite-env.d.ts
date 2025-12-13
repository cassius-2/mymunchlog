/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_PLACES_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace google {
  namespace maps {
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, options?: any);
        addListener(eventName: string, handler: () => void): void;
        getPlace(): any;
      }
    }
  }
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export {};