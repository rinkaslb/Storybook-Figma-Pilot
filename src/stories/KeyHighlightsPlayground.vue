<script setup lang="ts">
import { computed } from 'vue';
import KeyHighlights from '../components/KeyHighlights.vue';
import { defaultKeyHighlights } from '../components/KeyHighlights.data';
import type { KeyHighlightBadge, KeyHighlightItem } from '../components/KeyHighlights.types';

type BadgeChoice = 'none' | 'number' | 'icon';
const props = withDefaults(defineProps<{
  items?: readonly KeyHighlightItem[]; theme?: 'light' | 'dark'; showDividers?: boolean; motion?: 'auto' | 'static'; replayKey?: number;
  badge1?: BadgeChoice; badge2?: BadgeChoice; badge3?: BadgeChoice; badge4?: BadgeChoice;
  showItem2?: boolean; showItem3?: boolean; showItem4?: boolean; showSupportingHeadings?: boolean; showDescriptions?: boolean;
}>(), { items: () => defaultKeyHighlights, theme: 'light', showDividers: true, motion: 'static', replayKey: 0, badge1: 'none', badge2: 'none', badge3: 'none', badge4: 'none', showItem2: true, showItem3: true, showItem4: false, showSupportingHeadings: true, showDescriptions: true });
function badgeFor(choice: BadgeChoice, item: KeyHighlightItem, index: number): KeyHighlightBadge {
  if (choice === 'icon') return item.badge?.type === 'icon' ? item.badge : { type: 'icon', icon: 'building' };
  if (choice === 'number') return item.badge?.type === 'number' ? item.badge : { type: 'number', label: String(index + 1).padStart(2, '0') };
  return { type: 'none' };
}
const prepared = computed(() => {
  const choices = [props.badge1, props.badge2, props.badge3, props.badge4];
  const shown = [true, props.showItem2, props.showItem3, props.showItem4];
  return props.items.slice(0, 4).flatMap((item, index) => shown[index] ? [{ ...item, badge: badgeFor(choices[index], item, index), supportingHeading: props.showSupportingHeadings ? item.supportingHeading : undefined, description: props.showDescriptions ? item.description : undefined }] : []);
});
</script>
<template><KeyHighlights :items="prepared" :theme="theme" :show-dividers="showDividers" :motion="motion" :replay-key="replayKey" /></template>
