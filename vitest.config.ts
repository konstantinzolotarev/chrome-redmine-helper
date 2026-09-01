import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest supplies the fake browser API, the `@/` alias and WXT's defines —
  // but not the Svelte plugin, so components need it added here explicitly.
  plugins: [WxtVitest(), svelte()],
  resolve: {
    // Resolve Svelte's client-side build rather than its SSR entry.
    conditions: ['browser'],
  },
  test: {
    globals: true,
    // happy-dom runs inside Node and only adds DOM globals, so file-system and
    // fetch-based tests are unaffected while components can actually mount.
    environment: 'happy-dom',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts', 'entrypoints/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
  },
});
