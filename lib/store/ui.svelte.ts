/** Transient, non-persisted UI state shared within a single surface. */

let message = $state<{ tone: 'error' | 'success'; text: string } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export const toast = {
  get current() {
    return message;
  },
  show(tone: 'error' | 'success', text: string, ms = 5000) {
    clearTimeout(timer);
    message = { tone, text };
    timer = setTimeout(() => {
      message = null;
    }, ms);
  },
  clear() {
    clearTimeout(timer);
    message = null;
  },
};
