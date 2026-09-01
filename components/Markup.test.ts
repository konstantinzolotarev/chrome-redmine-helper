import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Markup from './Markup.svelte';

describe('Markup', () => {
  it('renders plain text', () => {
    render(Markup, { text: 'hello world' });
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('escapes HTML instead of executing it', () => {
    // The D1 regression. v1 built HTML strings from API values and injected them
    // with element.html(), so this executed inside the extension's own context.
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(Markup, { text: hostile });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(hostile);
  });

  it('does not execute script tags', () => {
    const { container } = render(Markup, { text: '<script>window.pwned = true</script>' });

    expect(container.querySelector('script')).toBeNull();
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it('links bare URLs, opening them safely', () => {
    const { container } = render(Markup, { text: 'see https://example.com/x' });
    const link = container.querySelector('a')!;

    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links issue references when a host is known', () => {
    const { container } = render(Markup, { text: 'see #42', host: 'https://redmine.test' });
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://redmine.test/issues/42');
  });

  it('leaves issue references as text without a host', () => {
    const { container } = render(Markup, { text: 'see #42' });
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('#42');
  });

  it('renders a javascript: URL as text, never as a link', () => {
    const { container } = render(Markup, { text: 'javascript:alert(1)' });
    expect(container.querySelector('a')).toBeNull();
  });
});
