import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import CTAButton from '../components/CTAButton.vue';

const figmaUrl = (nodeId: string) => `https://www.figma.com/design/NjTVThQ8addqzP29G9sRpO/Untitled?node-id=${nodeId}`;
const figmaParameters = (nodeId: string, description?: string) => ({
  design: { type: 'figma' as const, url: figmaUrl(nodeId) },
  docs: { description: { story: [description, `[Open in Figma](${figmaUrl(nodeId)})`].filter(Boolean).join('\n\n') } },
});

type CTAStoryArgs = { label?: string; status?: 'idle' | 'loading' | 'success'; type?: 'button' | 'submit' | 'reset'; onClick?: ReturnType<typeof fn>; disabled?: boolean; class?: string };
const meta = {
  title: 'Components/CTAButton',
  component: CTAButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onClick: fn() },
} satisfies Meta<CTAStoryArgs>;

export default meta;
type Story = StoryObj<CTAStoryArgs>;

export const Default: Story = { parameters: figmaParameters('1-4584') };

export const Hover: Story = {
  args: { class: 'cta-button--preview-hover' },
  parameters: figmaParameters('1-4599'),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Submit' });
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(24, 205, 99)');
  },
};

export const Active: Story = {
  args: { class: 'cta-button--preview-active' },
  parameters: figmaParameters('1-4614'),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Submit' });
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(22, 163, 74)');
  },
};

export const FocusVisible: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Submit' });

    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    button.blur();
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).outlineWidth).toBe('3px');
    await expect(getComputedStyle(button).outlineColor).toBe('rgb(179, 209, 247)');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(args.onClick).toHaveBeenCalledTimes(3);
  },
};

export const Loading: Story = {
  args: { status: 'loading' },
  parameters: figmaParameters('1-4629', 'The icon and color come from Figma. Its annotation requests animation, but no motion timing or keyframes are defined, so the icon remains static.'),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'In progress...' });
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.querySelector('img')).toBeInTheDocument();
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(22, 163, 74)');
  },
};

export const Success: Story = {
  args: { status: 'success' },
  parameters: figmaParameters('1-4644', 'Figma annotates this state as optional and lasting 500 ms. The caller controls when to show and clear it.'),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Done' });
    await expect(button.querySelector('img')).toBeInTheDocument();
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(22, 163, 74)');
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: { description: { story: 'Disabled appearance is provisional; the Figma page has no disabled example.' } },
  },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Submit' });

    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
