import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Shared by the WXT build and the Vitest component tests, so `lang="ts"` in
 * components is preprocessed identically in both.
 *
 * @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig}
 */
export default {
  preprocess: vitePreprocess(),
};
