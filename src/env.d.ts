// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

interface Window {
  gtag?: (...args: unknown[]) => void;
}

// Fontsource variable packages are imported for their side effects (CSS) and
// ship no type declarations; declare them so `astro check` (TS 6) resolves them.
declare module '@fontsource-variable/*';
