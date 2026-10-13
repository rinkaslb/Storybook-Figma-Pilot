import type { StorybookConfig } from '@storybook/vue3-vite';
import { reviewVitePlugin } from '../scripts/design-review-service.mjs';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
    "@storybook/addon-designs"
  ],
  "framework": "@storybook/vue3-vite",
  async viteFinal(viteConfig, { configType }) {
    if (configType !== 'DEVELOPMENT') return viteConfig;
    return { ...viteConfig, plugins: [...(viteConfig.plugins ?? []), reviewVitePlugin()] };
  }
};
export default config;
