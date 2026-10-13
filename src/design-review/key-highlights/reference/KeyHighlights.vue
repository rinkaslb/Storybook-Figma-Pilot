<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import buildingIcon from './building.svg';
import clockIcon from './clock.svg';
import envelopeIcon from './envelope.svg';
import { defaultKeyHighlights } from './KeyHighlights.data';
import type { KeyHighlightItem } from './KeyHighlights.types';
import './KeyHighlights.css';

const props = withDefaults(defineProps<{
  items?: readonly KeyHighlightItem[];
  theme?: 'light' | 'dark';
  showDividers?: boolean;
  motion?: 'auto' | 'static';
  /** Re-entering the viewport never replays. This key is an explicit Storybook control. */
  replayKey?: number;
  className?: string;
}>(), { items: () => defaultKeyHighlights, theme: 'light', showDividers: true, motion: 'auto', replayKey: 0 });
const iconUrls = { building: buildingIcon, clock: clockIcon, envelope: envelopeIcon };
const rows = computed(() => props.items.slice(0, 4));
const rowElements = ref<HTMLLIElement[]>([]);
const visible = reactive<Record<string, boolean>>({});
const displayed = reactive<Record<string, number>>({});
const reduced = ref(false);
const mobile = ref(false);
let reduceQuery: MediaQueryList | undefined;
let mobileQuery: MediaQueryList | undefined;
const observers: IntersectionObserver[] = [];
const timeouts: number[] = [];
const frames: number[] = [];
let generation = 0;

function format(value: number, suffix = '') { return `${value.toLocaleString('en-US')}${suffix}`; }
function cleanup() {
  for (const observer of observers.splice(0)) observer.disconnect();
  for (const timer of timeouts.splice(0)) clearTimeout(timer);
  for (const frame of frames.splice(0)) cancelAnimationFrame(frame);
}
function startCount(item: KeyHighlightItem, index: number, current: number) {
  if (visible[item.id] || current !== generation) return;
  visible[item.id] = true;
  displayed[item.id] = 0;
  const delay = mobile.value ? 0 : index * 120;
  const timeout = window.setTimeout(() => {
    let started = 0;
    const tick = (time: number) => {
      if (current !== generation) return;
      if (!started) started = time;
      const progress = Math.min((time - started) / 900, 1);
      displayed[item.id] = Math.round(item.value * progress);
      if (progress < 1) frames.push(requestAnimationFrame(tick));
    };
    frames.push(requestAnimationFrame(tick));
  }, delay);
  timeouts.push(timeout);
}
async function setupMotion() {
  const current = ++generation;
  cleanup();
  for (const item of rows.value) { visible[item.id] = false; displayed[item.id] = item.value; }
  await nextTick();
  if (current !== generation || props.motion === 'static' || reduced.value || typeof IntersectionObserver === 'undefined') return;
  rows.value.forEach((item, index) => {
    const element = rowElements.value[index];
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { startCount(item, index, current); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(element);
    observers.push(observer);
  });
}
function updateReduced() { reduced.value = reduceQuery?.matches ?? false; void setupMotion(); }
function updateMobile() { mobile.value = mobileQuery?.matches ?? false; }
onMounted(() => {
  reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mobileQuery = window.matchMedia('(max-width: 767px)');
  reduced.value = reduceQuery.matches;
  mobile.value = mobileQuery.matches;
  reduceQuery.addEventListener('change', updateReduced);
  mobileQuery.addEventListener('change', updateMobile);
  void setupMotion();
});
onUnmounted(() => {
  ++generation; cleanup();
  reduceQuery?.removeEventListener('change', updateReduced);
  mobileQuery?.removeEventListener('change', updateMobile);
});
watch(() => [props.replayKey, props.motion, props.items], () => { void setupMotion(); });
</script>

<template>
  <section :class="['review-current-key-highlights', `review-current-key-highlights--${theme}`, props.className]" aria-label="Key highlights">
    <ol class="review-current-key-highlights__items">
      <li v-for="(item, index) in rows" :key="`${item.id}-${replayKey}`" :ref="el => { if (el) rowElements[index] = el as HTMLLIElement; }"
        :class="['review-current-key-highlights__row', `review-current-key-highlights__row--${item.badge?.type ?? 'none'}`, { 'review-current-key-highlights__row--divider': showDividers && index > 0 }]"
        :data-metric-id="item.id" :data-animated="motion === 'auto' && !reduced && !!visible[item.id]">
        <div class="review-current-key-highlights__composition">
          <div class="review-current-key-highlights__leading">
            <span v-if="item.badge && item.badge.type !== 'none'" class="review-current-key-highlights__marker" :aria-label="item.badge.type === 'number' ? `Item ${item.badge.label}` : undefined">
              <span class="review-current-key-highlights__badge">
                <img v-if="item.badge.type === 'icon'" :src="iconUrls[item.badge.icon]" alt="" width="24" height="24" />
                <span v-else>{{ item.badge.label }}</span>
              </span>
            </span>
            <span class="review-current-key-highlights__value">
              <span class="review-current-key-highlights__value-label">{{ format(item.value, item.suffix) }}</span>
              <span class="review-current-key-highlights__value-reserve" aria-hidden="true">{{ format(item.value, item.suffix) }}</span>
              <span class="review-current-key-highlights__value-live" aria-hidden="true">{{ format(displayed[item.id] ?? item.value, item.suffix) }}</span>
            </span>
          </div>
          <div class="review-current-key-highlights__details">
            <h3 class="review-current-key-highlights__heading">{{ item.heading }}</h3>
            <div v-if="item.supportingHeading || item.description" class="review-current-key-highlights__copy">
              <h4 v-if="item.supportingHeading" class="review-current-key-highlights__supporting-heading">{{ item.supportingHeading }}</h4>
              <p v-if="item.description" class="review-current-key-highlights__description">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
