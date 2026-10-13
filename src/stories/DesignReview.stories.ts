import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import DesignReview from '../design-review/DesignReview.vue';

const meta = {
  title: 'Design Review',
  component: DesignReview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DesignReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Registered components' })).toBeInTheDocument();
    await expect(canvas.getByText('Only registered components are reviewed.')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Local demo — not production.' })).toHaveAttribute('href', 'http://localhost:5174/');
    await waitFor(() => expect(canvas.getByRole('button', { name: /CTAButton (No changes|Pending review|Applied locally)/ })).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole('button', { name: /ProductLogo No changes/ })).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole('button', { name: /KeyHighlights No changes/ })).toBeInTheDocument());
    await waitFor(() => expect(canvasElement.querySelector('[data-pending-count]')?.textContent).toMatch(/^[01] pending changes?$/));
    const ctaPending = canvasElement.querySelector('[data-review-component="cta-button"] [data-review-status]')?.textContent === 'Pending review';
    await expect(canvasElement.querySelector('[data-pending-count]')?.textContent).toBe(`${Number(ctaPending)} pending ${ctaPending ? 'change' : 'changes'}`);
    await expect(canvas.getByRole('heading', { name: 'Current' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /ProductLogo No changes/ }));
    await expect(canvas.getByText('Pilot baseline — not a corporate approval.')).toBeInTheDocument();
    await expect(canvas.getAllByText('Cyber Protect Cloud').length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('button', { name: /KeyHighlights No changes/ }));
    await expect(canvas.getByText('Initial pilot baseline — not a corporate approval.')).toBeInTheDocument();
    await expect(canvas.getAllByText('Workloads supported').length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('button', { name: /CTAButton (No changes|Pending review|Applied locally)/ }));
    await expect(canvas.getByRole('heading', { name: 'Proposed' })).toBeInTheDocument();
    const actual = canvasElement.querySelector<HTMLButtonElement>('[data-review-visible="current"] button');
    const proposed = canvasElement.querySelector<HTMLButtonElement>('[data-review-visible="proposed"] button');
    await expect(actual).toBeVisible();
    await expect(proposed).toBeVisible();
    await expect(actual?.textContent).toBe('Submit');
    await expect(proposed?.textContent).toBe('Submit');
    await expect(canvas.getByText('Local test approval. Does not publish to production.')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Approve and apply' })).toBeInTheDocument();
    await expect(canvas.getByText('Manual sync pilot — automatic Figma detection is not connected.')).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText(/Figma checked by Codex:/)).toBeInTheDocument());
    const approvalButton = canvas.getByRole('button', { name: 'Approve and apply' });
    if (canvas.queryByText('Proposal checked and ready for your approval in Storybook.')) {
      await expect(approvalButton).toBeEnabled();
    } else {
      await expect(approvalButton).toBeDisabled();
    }
    await waitFor(() => {
      const state = canvasElement.querySelector('[data-review-status]');
      expect(state?.textContent).toMatch(/No changes|Pending review|Applied locally/);
    });
    const pendingFilter = canvas.getByRole('checkbox', { name: 'Show pending only' });
    await userEvent.click(pendingFilter);
    if (ctaPending) {
      await expect(canvas.getByRole('button', { name: /CTAButton Pending review/ })).toBeInTheDocument();
      await expect(canvas.getByRole('heading', { name: 'Current' })).toBeInTheDocument();
    } else {
      await expect(canvas.getByText('No registered components have pending changes.')).toBeInTheDocument();
      await expect(canvas.queryByRole('heading', { name: 'Current' })).not.toBeInTheDocument();
    }
    await userEvent.click(pendingFilter);
    await expect(canvas.getByRole('heading', { name: 'Current' })).toBeInTheDocument();
  },
};
