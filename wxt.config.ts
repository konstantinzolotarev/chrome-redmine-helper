import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  // Explicit imports only — auto-imports make the data flow harder to follow.
  imports: false,
  manifest: ({ browser }) => ({
    name: 'Redmine Helper',
    description:
      'Track, update and log time on your Redmine issues without leaving the browser.',
    // Host access is requested at runtime for the single Redmine origin the user
    // configures in Options. Redmine sends no CORS headers, so without the granted
    // origin every request fails — see lib/redmine/client.ts.
    optional_host_permissions: ['*://*/*'],
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'contextMenus',
      'sidePanel',
      'tabs',
    ],
    action: {
      default_title: 'Redmine Helper',
    },
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    // Firefox needs an explicit id for MV3, and since 3 November 2025 requires
    // new extensions to declare what they collect. This one collects nothing:
    // the API key and cached issues stay in the browser, and the only host
    // contacted is the user's own Redmine.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: '{6f3c1b64-2f4a-4d5e-9a3b-8c7d2e1f0a9b}',
              strict_min_version: '115.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
