import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// fake-browser leaves runtime.getManifest() unimplemented and throws when it is
// called. Components read the version from there, so give it the one field they
// use — `restoreMocks` would undo a per-test spy, hence the plain assignment.
fakeBrowser.runtime.getManifest = vi.fn(() => ({
  version: '0.0.0-test',
})) as unknown as typeof fakeBrowser.runtime.getManifest;

afterEach(() => {
  cleanup();
});
