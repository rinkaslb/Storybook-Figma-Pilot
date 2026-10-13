<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import loadingIcon from './cta-loading.svg';
import successIcon from './cta-success.svg';
import './CTAButton.css';

defineOptions({ inheritAttrs: false });
export type CTAStatus = 'idle' | 'loading' | 'success';
const props = withDefaults(defineProps<{ label?: string; status?: CTAStatus; type?: 'button' | 'submit' | 'reset'; className?: string }>(), { label: 'Submit', status: 'idle', type: 'button' });
const attrs = useAttrs();
const statusLabel = computed(() => props.status === 'loading' ? 'In progress...' : props.status === 'success' ? 'Done' : undefined);
const accessibleName = computed(() => statusLabel.value ?? (typeof attrs['aria-label'] === 'string' ? attrs['aria-label'] : undefined));
</script>

<template>
  <button v-bind="attrs" :type="type" :class="['review-proposal-cta', props.className, attrs.class]" :data-status="status"
    :aria-label="accessibleName" :aria-busy="status === 'loading' || undefined">
    <template v-if="status === 'idle'">{{ label }}</template>
    <img v-else class="review-proposal-cta__icon" :src="status === 'loading' ? loadingIcon : successIcon" alt="" aria-hidden="true" />
  </button>
</template>
