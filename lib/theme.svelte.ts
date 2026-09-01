import { prefs } from './store/app.svelte';

/**
 * Apply the theme preference to the document.
 *
 * `system` removes the attribute entirely so the CSS falls back to
 * `prefers-color-scheme`; an explicit choice stamps `data-theme`, which the
 * stylesheet overrides on.
 *
 * Call from a component's script — it registers an effect.
 */
export function useTheme(): void {
  $effect(() => {
    const { theme } = prefs.current;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  });
}
