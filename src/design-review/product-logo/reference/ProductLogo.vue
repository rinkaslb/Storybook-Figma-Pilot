<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import navyLogo from './acronis-light.svg';
import whiteLogo from './acronis-dark.svg';
import './ProductLogo.css';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  productName?: string;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  layout?: 'Stacked' | 'Inline';
  theme?: 'Light' | 'Dark';
  edition?: boolean;
  editionLabel?: string;
  showLogo?: boolean;
  className?: string;
}>(), { productName: 'Cyber Protect Cloud', size: 'S', layout: 'Stacked', theme: 'Light', edition: false, editionLabel: 'Advanced', showLogo: true });
const attrs = useAttrs();
const resolvedLayout = computed(() => props.size === 'XS' ? 'Stacked' : props.layout);
const accessibleName = computed(() => `Acronis ${props.productName}${props.edition && resolvedLayout.value === 'Stacked' ? ` ${props.editionLabel}` : ''}`);
</script>

<template>
  <div v-bind="attrs" :class="['review-current-logo', `review-current-logo--${size.toLowerCase()}`, `review-current-logo--${resolvedLayout.toLowerCase()}`, `review-current-logo--${theme.toLowerCase()}`, props.className, attrs.class]" role="img" :aria-label="accessibleName">
    <img v-if="showLogo" class="review-current-logo__mark" :src="theme === 'Dark' ? whiteLogo : navyLogo" alt="" />
    <span class="review-current-logo__content">
      <span class="review-current-logo__name">{{ productName }}</span>
      <span v-if="edition && resolvedLayout === 'Stacked'" class="review-current-logo__edition">{{ editionLabel }}</span>
    </span>
  </div>
</template>
