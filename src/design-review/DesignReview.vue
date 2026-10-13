<script setup lang="ts">
import { computed, defineComponent, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { registeredReviews, type ReviewRegistration } from './registry';
import './DesignReview.css';

type ServiceStatus = {
  componentId: string; phase: string; mode: 'manual' | 'automatic'; canApply: boolean; manualReady: boolean;
  staleCode: boolean; staleFigma: boolean; figmaError: string | null;
  differences: { supported: string[]; pending: string[] } | null; error: string | null;
  backupId: string | null; checkedAt: string | null; figmaCheckedAt: string | null;
  supportedProperties: string[]; pendingProperties: string[];
};
type ReviewAction = 'status' | 'scan' | 'prepare' | 'apply';
const ReviewRenderer = defineComponent({
  props: { registration: { type: Object as () => ReviewRegistration, required: true }, viewId: { type: String, required: true }, kind: { type: String as () => 'current' | 'proposed', required: true }, probe: Boolean },
  setup(props) { return () => props.kind === 'current' ? props.registration.renderCurrent(props.viewId, props.probe) : props.registration.renderProposed(props.viewId, props.probe); },
});
async function reviewRequest(componentId: string, action: ReviewAction) {
  const response = await fetch(`/__pilot_review/${componentId}/${action}`, {
    method: action === 'status' ? 'GET' : 'POST',
    headers: action === 'status' ? undefined : { 'X-Pilot-Review': '1' }, cache: 'no-store',
  });
  const result = await response.json() as ServiceStatus & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Error ${response.status}`);
  if (result.componentId !== componentId) throw new Error('The review service returned a different component.');
  return result;
}
const selectedId = ref(registeredReviews[0]?.id ?? '');
const viewId = ref(registeredReviews[0]?.views[0]?.id ?? '');
const pendingOnly = ref(false);
const visualDifferences = reactive<Record<string, string[]>>({});
const services = reactive<Record<string, ServiceStatus>>({});
const serviceErrors = reactive<Record<string, string>>({});
const workingId = ref<string | null>(null);
const currentProbes = ref<HTMLDivElement | null>(null);
const proposedProbes = ref<HTMLDivElement | null>(null);
let cancelled = false;
let scheduled = 0;
let headObserver: MutationObserver | undefined;
function hasPendingChanges(id: string) {
  const differences = services[id]?.differences;
  return Boolean(visualDifferences[id]?.length || differences?.supported.length || differences?.pending.length);
}
function reviewStatus(id: string) {
  if (!visualDifferences[id] || (!services[id] && !serviceErrors[id])) return 'Checking';
  if (hasPendingChanges(id)) return 'Pending review';
  return services[id]?.phase === 'applied' ? 'Applied locally' : 'No changes';
}
const pendingCount = computed(() => registeredReviews.filter((review) => hasPendingChanges(review.id)).length);
const reviewsReady = computed(() => registeredReviews.every((review) => visualDifferences[review.id] && (services[review.id] || serviceErrors[review.id])));
const visibleReviews = computed(() => registeredReviews.filter((review) => !pendingOnly.value || hasPendingChanges(review.id)));
const selected = computed(() => visibleReviews.value.find((review) => review.id === selectedId.value) ?? visibleReviews.value[0]);
const selectedView = computed(() => selected.value?.views.find((view) => view.id === viewId.value)?.id ?? selected.value?.views[0]?.id);
const service = computed(() => selected.value ? services[selected.value.id] : undefined);
const differences = computed(() => selected.value ? visualDifferences[selected.value.id] ?? [] : []);
const hasChanges = computed(() => selected.value ? hasPendingChanges(selected.value.id) : false);
const manualMode = computed(() => service.value?.mode !== 'automatic');
function selectReview(registration: ReviewRegistration) { selectedId.value = registration.id; viewId.value = registration.views[0].id; }
async function compare() {
  if (!currentProbes.value || !proposedProbes.value) return;
  const entries = await Promise.all(registeredReviews.map(async (registration) => {
    const currentRoot = [...currentProbes.value!.children].find((element) => (element as HTMLElement).dataset.reviewComponent === registration.id) as HTMLElement | undefined;
    const proposedRoot = [...proposedProbes.value!.children].find((element) => (element as HTMLElement).dataset.reviewComponent === registration.id) as HTMLElement | undefined;
    if (!currentRoot || !proposedRoot) return [registration.id, ['A review preview is missing.']] as const;
    try { return [registration.id, await registration.compare(currentRoot, proposedRoot)] as const; }
    catch { return [registration.id, ['The visual comparison could not be completed.']] as const; }
  }));
  if (!cancelled) for (const [id, items] of entries) visualDifferences[id] = [...items];
}
function scheduleCompare() { cancelAnimationFrame(scheduled); scheduled = requestAnimationFrame(() => { void compare(); }); }
async function runAction(componentId: string, action: Exclude<ReviewAction, 'status'>) {
  workingId.value = componentId; serviceErrors[componentId] = '';
  try { await reviewRequest(componentId, action); }
  catch (error) { serviceErrors[componentId] = error instanceof Error ? error.message : 'The local review failed.'; }
  finally {
    try { services[componentId] = await reviewRequest(componentId, 'status'); } catch { /* Preserve action error. */ }
    workingId.value = null;
  }
}
onMounted(async () => {
  await nextTick();
  for (const registration of registeredReviews) {
    void reviewRequest(registration.id, 'status').then((result) => { if (!cancelled) services[registration.id] = result; })
      .catch(() => { if (!cancelled) serviceErrors[registration.id] = 'The local review service is available only in Storybook development mode.'; });
  }
  void compare();
  headObserver = new MutationObserver(scheduleCompare);
  headObserver.observe(document.head, { attributes: true, childList: true, characterData: true, subtree: true });
});
onUnmounted(() => { cancelled = true; cancelAnimationFrame(scheduled); headObserver?.disconnect(); });
</script>

<template>
  <main class="design-review">
    <div class="design-review__content">
      <header class="design-review__header">
        <div>
          <p class="design-review__eyebrow">Design Review / Overview</p>
          <h1>Component design review</h1>
          <p>Review current references and isolated proposals in one place.</p>
          <p>Only registered components are reviewed.</p>
        </div>
        <a class="design-review__demo-link" href="http://localhost:5174/" target="_blank" rel="noopener noreferrer">Local demo — not production.</a>
      </header>
      <section class="design-review__registry" aria-labelledby="design-review-registry-title">
        <div class="design-review__registry-heading">
          <h2 id="design-review-registry-title">Registered components</h2>
          <span aria-live="polite" data-pending-count>{{ reviewsReady ? `${pendingCount} pending ${pendingCount === 1 ? 'change' : 'changes'}` : 'Checking registered components…' }}</span>
        </div>
        <label class="design-review__filter"><input v-model="pendingOnly" type="checkbox" /> Show pending only</label>
        <ul v-if="visibleReviews.length" class="design-review__registry-list">
          <li v-for="registration in visibleReviews" :key="registration.id" :data-review-component="registration.id">
            <button type="button" :aria-pressed="selected?.id === registration.id" @click="selectReview(registration)">
              <span>{{ registration.name }}</span>
              <span class="design-review__status" :data-review-status="reviewStatus(registration.id) === 'Pending review' ? 'pending' : reviewStatus(registration.id) === 'Applied locally' ? 'applied' : reviewStatus(registration.id) === 'Checking' ? 'checking' : 'same'">{{ reviewStatus(registration.id) }}</span>
            </button>
          </li>
        </ul>
        <p v-else>{{ reviewsReady ? 'No registered components have pending changes.' : 'Checking registered components…' }}</p>
      </section>
      <div v-if="selected && selectedView" class="design-review__detail" :data-selected-component="selected.id">
        <header class="design-review__detail-header"><h2>{{ selected.name }}</h2><a :href="selected.figmaUrl" target="_blank" rel="noopener noreferrer">View design in Figma</a></header>
        <div class="design-review__toolbar"><label for="design-review-view">View</label><select id="design-review-view" v-model="viewId"><option v-for="view in selected.views" :key="view.id" :value="view.id">{{ view.label }}</option></select></div>
        <div class="design-review__columns">
          <section class="design-review__card" aria-labelledby="design-review-current-title"><h2 id="design-review-current-title">Current</h2><p>{{ selected.referenceLabel ?? 'Approved reference' }}</p><div class="design-review__sample" data-review-visible="current"><div class="design-review__sample-content"><ReviewRenderer :registration="selected" :view-id="selectedView" kind="current" /></div></div></section>
          <section class="design-review__card" aria-labelledby="design-review-proposed-title"><h2 id="design-review-proposed-title">Proposed</h2><p>Candidate version</p><div class="design-review__sample" data-review-visible="proposed"><div class="design-review__sample-content"><ReviewRenderer :registration="selected" :view-id="selectedView" kind="proposed" /></div></div></section>
        </div>
        <section class="design-review__differences" aria-labelledby="design-review-differences-title"><h2 id="design-review-differences-title">Detected visual differences</h2><ul><li v-for="difference in differences" :key="difference">{{ difference }}</li><li v-if="!differences.length">No visual differences detected.</li></ul></section>
        <section class="design-review__approval" aria-labelledby="design-review-approval-title">
          <h2 id="design-review-approval-title">Local approval</h2>
          <template v-if="manualMode">
            <p class="design-review__manual-notice">Manual sync pilot — automatic Figma detection is not connected.</p>
            <p>Codex checks this registered component in Figma through MCP and updates only its Proposed version.</p>
            <p v-if="selected.id === 'cta-button'">After Codex prepares and checks the CTA proposal, you can approve and apply it here. The local service makes a backup, runs checks again, and restores the previous version if they fail.</p>
            <p v-else>This component requires separate implementation and approval before it can be applied.</p>
            <div class="design-review__actions"><button type="button" :disabled="workingId === selected.id || selected.id !== 'cta-button' || !service?.canApply || !hasChanges" @click="runAction(selected.id, 'apply')">Approve and apply</button></div>
            <p v-if="service?.manualReady">Proposal checked and ready for your approval in Storybook.</p>
            <p v-if="!hasChanges">No proposal changes to approve.</p>
          </template>
          <template v-else>
            <p>Check Figma, prepare this component’s proposal, and run checks before applying it.</p>
            <div class="design-review__actions">
              <button type="button" :disabled="workingId === selected.id || !service" @click="runAction(selected.id, 'scan')">Check Figma</button>
              <button type="button" :disabled="workingId === selected.id || !service || !service.differences?.supported.length || !!service.differences?.pending.length" @click="runAction(selected.id, 'prepare')">Prepare and check</button>
              <button type="button" :disabled="workingId === selected.id || !service?.canApply || !hasChanges" @click="runAction(selected.id, 'apply')">Approve and apply</button>
            </div>
          </template>
          <p v-if="workingId === selected.id" role="status">Running checks; this may take a few minutes…</p>
          <p v-if="service?.figmaError" class="design-review__error" role="alert">{{ service.figmaError }}</p>
          <p v-if="serviceErrors[selected.id] || service?.error" class="design-review__error" role="alert">{{ serviceErrors[selected.id] || service?.error }}</p>
          <p v-if="service?.staleCode || service?.staleFigma" class="design-review__error" role="alert">Figma or the code changed after preparation. Refresh the review.</p>
          <p v-if="service?.checkedAt && ['prepared', 'manual-prepared'].includes(service.phase)">Last checked: {{ new Date(service.checkedAt).toLocaleString('en-US') }}.</p>
          <p v-if="manualMode && service?.figmaCheckedAt">Figma checked by Codex: {{ new Date(service.figmaCheckedAt).toLocaleString('en-US') }}.</p>
          <p v-if="service?.backupId">Recoverable backup: <code>src/design-review/.local/backups/{{ service.backupId }}</code></p>
          <h3>{{ manualMode ? 'Codex review of Figma' : 'Changes detected in Figma' }}</h3>
          <ul>
            <li v-for="item in service?.differences?.supported ?? []" :key="item">{{ item }}</li>
            <li v-for="item in service?.differences?.pending ?? []" :key="item">Pending implementation: {{ item }}</li>
            <li v-if="!service?.differences?.supported.length && !service?.differences?.pending.length">{{ manualMode && service?.figmaCheckedAt ? 'No differences from the current Figma reference.' : manualMode ? 'No MCP review recorded yet. Ask Codex to review Figma.' : 'No verified differences.' }}</li>
          </ul>
          <p>{{ manualMode ? 'Supported for checked application by Codex: ' : 'Supported for automatic preparation: ' }}{{ service?.supportedProperties.join(', ') ?? 'outer CTA corner radius' }}.</p>
          <p>Requires manual implementation: {{ service?.pendingProperties.join(', ') ?? 'colors, dimensions, text, typography, icons, focus outline, and animation' }}.</p>
        </section>
      </div>
      <p class="design-review__notice">Local test approval. Does not publish to production.</p>
    </div>
    <div ref="currentProbes" class="design-review__probes" aria-hidden="true"><div v-for="registration in registeredReviews" :key="registration.id" :data-review-component="registration.id"><div v-for="view in registration.views" :key="view.id" :data-review-view="view.id"><ReviewRenderer :registration="registration" :view-id="view.id" kind="current" probe /></div></div></div>
    <div ref="proposedProbes" class="design-review__probes" aria-hidden="true"><div v-for="registration in registeredReviews" :key="registration.id" :data-review-component="registration.id"><div v-for="view in registration.views" :key="view.id" :data-review-view="view.id"><ReviewRenderer :registration="registration" :view-id="view.id" kind="proposed" probe /></div></div></div>
  </main>
</template>
