import { h } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import ProductLogo from '../components/ProductLogo.vue';

const productLogoFigmaUrl = 'https://www.figma.com/design/WWq5FObYPf4mFjrsjBQ7X8/Logotype-system?node-id=112-6027';
const meta = {
  title: 'Brand/ProductLogo', component: ProductLogo, tags: ['autodocs'],
  parameters: { layout: 'centered', design: { type: 'figma', url: productLogoFigmaUrl }, docs: { description: { component: `Product Title from Figma. The Acronis wordmark is an official vector asset; the product name and edition are real text. Acronis Cyber is not installed in this project, so the temporary font fallback is not an exact reproduction.\n\n[Open in Figma](${productLogoFigmaUrl})` } } },
  args: { productName: 'Cyber Protect Cloud', size: 'S', layout: 'Stacked', theme: 'Light', edition: false, editionLabel: 'Advanced', showLogo: true },
  argTypes: {
    size: { control: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    layout: { control: 'select', options: ['Stacked', 'Inline'], description: 'XS is defined only as Stacked in Figma.' },
    theme: { control: 'select', options: ['Light', 'Dark'] },
    edition: { control: 'boolean', description: 'The edition label appears only in Stacked layouts.' },
    editionLabel: { control: 'text' }, productName: { control: 'text' }, showLogo: { control: 'boolean' },
  },
} satisfies Meta<typeof ProductLogo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const StackedLight: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole('img', { name: 'Acronis Cyber Protect Cloud' })).toBeVisible();
  await expect(canvas.getByText('Cyber Protect Cloud')).toBeVisible();
  await expect(canvasElement.querySelector('img.product-logo__mark')?.getAttribute('src')).toMatch(/\.svg|^data:image\/svg\+xml/);
} };
export const StackedDark: Story = { args: { theme: 'Dark' }, parameters: { backgrounds: { default: 'dark' } }, decorators: [(story) => h('div', { style: { background: '#00204d', padding: '32px' } }, [h(story())])] };
export const StackedWithEdition: Story = { args: { edition: true } };
export const InlineLight: Story = { args: { layout: 'Inline' } };
export const InlineDark: Story = { args: { layout: 'Inline', theme: 'Dark' }, decorators: [(story) => h('div', { style: { background: '#00204d', padding: '32px' } }, [h(story())])] };
export const AllSizes: Story = { render: (args) => ({ render: () => h('div', { style: { display: 'grid', gap: '32px' } }, (['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => h(ProductLogo, { ...args, size, key: size }))) }), parameters: { layout: 'padded' } };
