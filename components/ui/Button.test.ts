import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button.svelte';
import ButtonHarness from './__fixtures__/ButtonHarness.svelte';

describe('Button', () => {
  it('renders its label', () => {
    render(ButtonHarness, { label: 'Save' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onclick', async () => {
    const onclick = vi.fn();
    render(ButtonHarness, { label: 'Save', onclick });

    await userEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('is disabled while loading and does not fire', async () => {
    const onclick = vi.fn();
    render(ButtonHarness, { label: 'Save', onclick, loading: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onclick).not.toHaveBeenCalled();
  });

  it('exposes the component itself for direct use', () => {
    expect(Button).toBeTruthy();
  });
});
