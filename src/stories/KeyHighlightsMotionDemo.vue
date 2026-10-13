<script setup lang="ts">
import { ref } from 'vue';
import KeyHighlights from '../components/KeyHighlights.vue';
import { defaultKeyHighlights } from '../components/KeyHighlights.data';
const replayKey = ref(0);
</script>
<template>
  <div>
    <div style="padding: 16px"><button type="button" @click="replayKey++">Replay animation</button></div>
    <KeyHighlights :items="defaultKeyHighlights" motion="auto" :replay-key="replayKey" />
  </div>
</template>
