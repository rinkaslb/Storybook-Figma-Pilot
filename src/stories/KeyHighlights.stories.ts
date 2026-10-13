import { h } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import KeyHighlights from '../components/KeyHighlights.vue';
import { defaultKeyHighlights } from '../components/KeyHighlights.data';
import type { KeyHighlightItem } from '../components/KeyHighlights.types';
import KeyHighlightsPlayground from './KeyHighlightsPlayground.vue';
import KeyHighlightsMotionDemo from './KeyHighlightsMotionDemo.vue';

const figmaFile = 'https://www.figma.com/design/IYSxfcgqwTKKNzohmB69uT/PD11368---Services-pages-design';
const figmaUrl = (node: string) => `${figmaFile}?node-id=${node}`;
const startingUrl = figmaUrl('313-34148');
const documentationUrl = figmaUrl('313-33806');
const viewportOptions = {
  desktop1440: { name: '1440 px', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
  desktop1280: { name: '1280 px', styles: { width: '1280px', height: '900px' }, type: 'desktop' },
  desktop1024: { name: '1024 px', styles: { width: '1024px', height: '768px' }, type: 'desktop' },
  tablet768: { name: '768 px', styles: { width: '768px', height: '900px' }, type: 'tablet' },
  mobile360: { name: '360 px', styles: { width: '360px', height: '800px' }, type: 'mobile' },
} as const;
const optionalFourth: KeyHighlightItem = { id: 'fourth', value: 75, suffix: '%', heading: 'Verified metric', description: 'Add a sourced metric and a concise explanation.' };
const playgroundItems = [...defaultKeyHighlights, optionalFourth];
type PlaygroundArgs = InstanceType<typeof KeyHighlightsPlayground>['$props'];
const badgeChoices = ['none', 'number', 'icon'];
const meta = {
  title: 'Slices/KeyHighlights', component: KeyHighlights, tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen', viewport: { options: viewportOptions }, design: { type: 'figma', url: startingUrl },
    docs: { description: { component: `Metrics layout only. Choose 1440, 1280, 1024, 768 or 360 px from Storybook's viewport selector; the component responds to its available width. The example values in Figma are illustrative and need verified sources before publication. Acronis Cyber is unavailable in this project, so the browser fallback is not an exact typography match. Motion follows the [Key Highlights documentation](${documentationUrl}). [Open in Figma](${startingUrl})` } },
  },
  args: { items: playgroundItems, theme: 'light', showDividers: true, motion: 'static', badge1: 'none', badge2: 'none', badge3: 'none', badge4: 'none', showItem2: true, showItem3: true, showItem4: false, showSupportingHeadings: true, showDescriptions: true },
  argTypes: {
    theme: { control: 'select', options: ['light', 'dark'], table: { category: 'Appearance' } },
    badge1: { control: 'select', options: badgeChoices, name: 'Item 1 badge', table: { category: 'Badges' } },
    badge2: { control: 'select', options: badgeChoices, name: 'Item 2 badge', table: { category: 'Badges' } },
    badge3: { control: 'select', options: badgeChoices, name: 'Item 3 badge', table: { category: 'Badges' } },
    badge4: { control: 'select', options: badgeChoices, name: 'Item 4 badge', table: { category: 'Badges' } },
    items: { control: 'object', description: 'Edit metric values, suffixes, headings, descriptions, and badge icon or number labels per item.', table: { category: 'Content' } },
    showItem2: { control: 'boolean', name: 'Show item 2', table: { category: 'Visibility' } },
    showItem3: { control: 'boolean', name: 'Show item 3', table: { category: 'Visibility' } },
    showItem4: { control: 'boolean', name: 'Show item 4', table: { category: 'Visibility' } },
    showSupportingHeadings: { control: 'boolean', name: 'Show supporting headings', table: { category: 'Visibility' } },
    showDescriptions: { control: 'boolean', name: 'Show descriptions', table: { category: 'Visibility' } },
    showDividers: { control: 'boolean', name: 'Show dividers', table: { category: 'Visibility' } },
    motion: { table: { disable: true } }, replayKey: { table: { disable: true } },
  },
} satisfies Meta<PlaygroundArgs>;
export default meta;
type Story = StoryObj<PlaygroundArgs>;
const render = (node: ReturnType<typeof h>) => ({ render: () => node });
export const Playground: Story = {
  args: { theme: 'dark', badge1: 'icon', badge2: 'icon', badge3: 'icon' },
  render: (args) => ({ render: () => h(KeyHighlightsPlayground, args) }),
  parameters: { docs: { description: { story: `Use Controls to edit theme, badges, content and visibility. Edit each item's supporting heading and description independently in the Items control. [Open in Figma](${startingUrl})` } } },
};
export const FinalStatic: Story = { render: () => render(h(KeyHighlights, { items: defaultKeyHighlights, theme: 'light', motion: 'static' })), parameters: { controls: { disable: true }, docs: { description: { story: `Final values remain visible for stable visual comparison. [Open in Figma](${startingUrl})` } } } };
export const Motion: Story = {
  render: () => render(h(KeyHighlightsMotionDemo)),
  parameters: { controls: { disable: true }, docs: { description: { story: `Scroll rows into view for the one-time count-up. The replay button is a Storybook inspection control; viewport re-entry does not replay. [Open in Figma](${documentationUrl})` } } },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('button', { name: 'Replay animation' })).toBeInTheDocument(); await expect(canvasElement.querySelector('.key-highlights__value-label')?.textContent).toBe('30+'); },
};
function responsiveTest(width: number, height: number, contentWidth: number, headingSize: number, valueSize: number, node: string, viewport: keyof typeof viewportOptions, theme: 'light' | 'dark' = 'light'): Story {
  return {
    globals: { viewport: { value: viewport, isRotated: false } },
    render: () => render(h('div', { style: { width: `${width}px` } }, [h(KeyHighlights, { items: defaultKeyHighlights, theme, motion: 'static' })])),
    parameters: { design: { type: 'figma', url: figmaUrl(node) } },
    play: async ({ canvasElement }) => {
      const slice = canvasElement.querySelector<HTMLElement>('.key-highlights');
      if (!slice) throw new Error('KeyHighlights did not render.');
      await expect(Math.round(slice.getBoundingClientRect().width)).toBe(width);
      await expect(Math.round(slice.getBoundingClientRect().height)).toBe(height);
      await expect(Math.round(slice.querySelector('ol')!.getBoundingClientRect().width)).toBe(contentWidth);
      await expect(getComputedStyle(slice.querySelector('h3')!).fontSize).toBe(`${headingSize}px`);
      await expect(getComputedStyle(slice.querySelector('.key-highlights__value')!).fontSize).toBe(`${valueSize}px`);
      await expect(slice.querySelectorAll('.key-highlights__row')).toHaveLength(3);
    },
  };
}
export const Test1440: Story = { ...responsiveTest(1440, 602, 1090, 32, 90, '308-30586', 'desktop1440'), tags: ['!dev', '!autodocs', 'test'] };
export const Test1280: Story = { ...responsiveTest(1280, 602, 1090, 32, 90, '308-30599', 'desktop1280'), tags: ['!dev', '!autodocs', 'test'] };
export const Test1024: Story = { ...responsiveTest(1024, 602, 896, 28, 72, '308-30612', 'desktop1024'), tags: ['!dev', '!autodocs', 'test'] };
export const Test768: Story = { ...responsiveTest(768, 602, 704, 28, 72, '308-30625', 'tablet768'), tags: ['!dev', '!autodocs', 'test'] };
export const Test360: Story = { ...responsiveTest(360, 860, 328, 28, 64, '308-30638', 'mobile360'), tags: ['!dev', '!autodocs', 'test'] };
export const TestDark: Story = { ...responsiveTest(1440, 602, 1090, 32, 90, '308-30651', 'desktop1440', 'dark'), tags: ['!dev', '!autodocs', 'test'] };
export const TestDarkMobile: Story = { ...responsiveTest(360, 860, 328, 28, 64, '308-30703', 'mobile360', 'dark'), tags: ['!dev', '!autodocs', 'test'] };
const badgeItems: readonly KeyHighlightItem[] = defaultKeyHighlights.map((item, index) => ({ ...item, badge: index === 0 ? { type: 'icon', icon: 'building' } : index === 1 ? { type: 'number', label: '02' } : { type: 'none' } }));
export const TestBadges: Story = { tags: ['!dev', '!autodocs', 'test'], render: () => render(h(KeyHighlights, { items: badgeItems, motion: 'static' })), play: async ({ canvasElement }) => {
  const rows = canvasElement.querySelectorAll('.key-highlights__row');
  await expect(rows[0].querySelector('img')).toHaveAttribute('src', expect.stringMatching(/\.svg|^data:image\/svg\+xml/));
  await expect(rows[1].querySelector('.key-highlights__badge')?.textContent).toBe('02');
  await expect(rows[2].querySelector('.key-highlights__badge')).toBeNull();
} };
export const TestOptionalContent: Story = { tags: ['!dev', '!autodocs', 'test'], render: () => render(h(KeyHighlights, { items: [defaultKeyHighlights[0], { ...defaultKeyHighlights[1], supportingHeading: undefined }, { ...defaultKeyHighlights[2], description: undefined }, optionalFourth], motion: 'static' })), play: async ({ canvasElement }) => {
  const rows = canvasElement.querySelectorAll('.key-highlights__row');
  await expect(rows).toHaveLength(4);
  await expect(rows[1].querySelector('h4')).toBeNull();
  await expect(rows[2].querySelector('.key-highlights__description')).toBeNull();
} };
