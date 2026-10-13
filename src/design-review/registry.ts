import { h, type VNode } from 'vue';
import { compareVisuals, reviewViews, type ReviewView } from './compareVisuals';
import ReferenceCTAButton from './reference/CTAButton.vue';
import ProposedCTAButton from './proposal/CTAButton.vue';
import CurrentProductLogo from './product-logo/reference/ProductLogo.vue';
import ProposedProductLogo from './product-logo/proposal/ProductLogo.vue';
import CurrentKeyHighlights from './key-highlights/reference/KeyHighlights.vue';
import ProposedKeyHighlights from './key-highlights/proposal/KeyHighlights.vue';
import { defaultKeyHighlights as currentHighlights } from './key-highlights/reference/KeyHighlights.data';
import { defaultKeyHighlights as proposedHighlights } from './key-highlights/proposal/KeyHighlights.data';

export type ReviewRegistration = {
  id: string;
  name: string;
  figmaUrl: string;
  referenceDirectory: string;
  proposalDirectory: string;
  referenceLabel?: string;
  views: readonly { id: string; label: string }[];
  renderCurrent: (viewId: string, probe?: boolean) => VNode;
  renderProposed: (viewId: string, probe?: boolean) => VNode;
  compare: (currentRoot: HTMLElement, proposedRoot: HTMLElement) => Promise<string[]>;
};

const logoViews = [
  ...(['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => ({ id: `stacked-${size.toLowerCase()}`, label: `${size} · Stacked · Light`, size, layout: 'Stacked' as const, theme: 'Light' as const, edition: false })),
  { id: 'stacked-dark', label: 'S · Stacked · Dark', size: 'S' as const, layout: 'Stacked' as const, theme: 'Dark' as const, edition: false },
  { id: 'stacked-edition', label: 'S · Stacked · Edition', size: 'S' as const, layout: 'Stacked' as const, theme: 'Light' as const, edition: true },
  { id: 'inline-light', label: 'S · Inline · Light', size: 'S' as const, layout: 'Inline' as const, theme: 'Light' as const, edition: false },
  { id: 'inline-dark', label: 'S · Inline · Dark', size: 'S' as const, layout: 'Inline' as const, theme: 'Dark' as const, edition: false },
];
function logoView(viewId: string) {
  const view = logoViews.find((item) => item.id === viewId) ?? logoViews[0];
  return { view, style: { background: view.theme === 'Dark' ? '#00204d' : '#fff', padding: '16px' } };
}
async function compareLogos(currentRoot: HTMLElement, proposedRoot: HTMLElement) {
  const differences: string[] = [];
  for (const [index, currentView] of [...currentRoot.children].entries()) {
    const proposedView = proposedRoot.children[index];
    const current = currentView.querySelector('[role="img"]');
    const proposed = proposedView?.querySelector('[role="img"]');
    if (!current || !proposed) { differences.push('A ProductLogo preview is missing.'); continue; }
    if (current.textContent !== proposed.textContent) differences.push(`${currentView.getAttribute('data-review-view')}: text differs.`);
    for (const selector of ['[role="img"]', 'img', 'span']) {
      const a = current.matches(selector) ? current : current.querySelector(selector);
      const b = proposed.matches(selector) ? proposed : proposed.querySelector(selector);
      if (!a || !b) continue;
      const aStyle = getComputedStyle(a);
      const bStyle = getComputedStyle(b);
      for (const property of ['width', 'height', 'gap', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing']) {
        if (aStyle.getPropertyValue(property) !== bStyle.getPropertyValue(property)) differences.push(`${currentView.getAttribute('data-review-view')}: ${property} differs.`);
      }
    }
  }
  return [...new Set(differences)];
}


const logoReview: ReviewRegistration = {
  id: 'product-logo', name: 'ProductLogo',
  figmaUrl: 'https://www.figma.com/design/WWq5FObYPf4mFjrsjBQ7X8/Logotype-system?node-id=112-6027',
  referenceDirectory: 'src/design-review/product-logo/reference',
  proposalDirectory: 'src/design-review/product-logo/proposal',
  referenceLabel: 'Pilot baseline — not a corporate approval.', views: logoViews,
  renderCurrent: (id) => { const { view, style } = logoView(id); return h('div', { style }, [h(CurrentProductLogo, { size: view.size, layout: view.layout, theme: view.theme, edition: view.edition })]); },
  renderProposed: (id) => { const { view, style } = logoView(id); return h('div', { style }, [h(ProposedProductLogo, { size: view.size, layout: view.layout, theme: view.theme, edition: view.edition })]); },
  compare: compareLogos,
};

const ctaViewProps = {
  default: {}, hover: { class: 'review-preview-hover' }, active: { class: 'review-preview-active' },
  focus: { class: 'review-preview-focus' }, loading: { status: 'loading' as const },
  success: { status: 'success' as const }, disabled: { disabled: true },
};
const ctaReview: ReviewRegistration = {
  id: 'cta-button', name: 'CTAButton',
  figmaUrl: 'https://www.figma.com/design/NjTVThQ8addqzP29G9sRpO/Untitled?node-id=1-4584',
  referenceDirectory: 'src/design-review/reference', proposalDirectory: 'src/design-review/proposal', views: reviewViews,
  renderCurrent: (id, probe) => h(ReferenceCTAButton, { ...ctaViewProps[id as ReviewView], tabindex: probe ? -1 : undefined }),
  renderProposed: (id, probe) => h(ProposedCTAButton, { ...ctaViewProps[id as ReviewView], tabindex: probe ? -1 : undefined }),
  compare: compareVisuals,
};

const highlightViews = [
  { id: 'desktop', label: 'Metrics · 1440 · Light', width: 1440, theme: 'light' as const },
  { id: 'desktop-1280', label: 'Metrics · 1280 · Light', width: 1280, theme: 'light' as const },
  { id: 'desktop-1024', label: 'Metrics · 1024 · Light', width: 1024, theme: 'light' as const },
  { id: 'tablet', label: 'Metrics · 768 · Light', width: 768, theme: 'light' as const },
  { id: 'mobile', label: 'Metrics · 360 · Light', width: 360, theme: 'light' as const },
  { id: 'dark', label: 'Metrics · 1440 · Dark', width: 1440, theme: 'dark' as const },
  { id: 'badges', label: 'Metrics · badge options', width: 1440, theme: 'light' as const },
];
function highlightView(id: string) { return highlightViews.find((view) => view.id === id) ?? highlightViews[0]; }
async function compareHighlights(currentRoot: HTMLElement, proposedRoot: HTMLElement) {
  const differences: string[] = [];
  for (const [index, currentView] of [...currentRoot.children].entries()) {
    const proposedView = proposedRoot.children[index];
    const view = highlightViews[index];
    const currentNodes = currentView.querySelectorAll('section, ol, li, div, span, h3, h4, p, img');
    const proposedNodes = proposedView?.querySelectorAll('section, ol, li, div, span, h3, h4, p, img');
    if (!proposedNodes || currentNodes.length !== proposedNodes.length) {
      differences.push(`${view.label}: structure differs.`);
      continue;
    }
    for (const [nodeIndex, current] of [...currentNodes].entries()) {
      const proposed = proposedNodes[nodeIndex];
      if (current.tagName !== proposed.tagName) { differences.push(`${view.label}: structure differs.`); break; }
      if (current.children.length === 0 && current.textContent !== proposed.textContent) differences.push(`${view.label}: text differs.`);
      const a = getComputedStyle(current);
      const b = getComputedStyle(proposed);
      for (const property of ['display', 'grid-template-columns', 'gap', 'width', 'min-height', 'padding', 'border-top', 'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height']) {
        if (a.getPropertyValue(property) !== b.getPropertyValue(property)) differences.push(`${view.label}: ${property} differs.`);
      }
    }
  }
  return [...new Set(differences)];
}


function highlightItems(id: string, items: typeof currentHighlights) {
  return id === 'badges' ? items.map((item, index) => ({ ...item, badge: index === 0 ? { type: 'icon' as const, icon: 'building' as const } : index === 1 ? { type: 'number' as const, label: '02' } : { type: 'none' as const } })) : items;
}
const highlightsReview: ReviewRegistration = {
  id: 'key-highlights', name: 'KeyHighlights',
  figmaUrl: 'https://www.figma.com/design/IYSxfcgqwTKKNzohmB69uT/PD11368---Services-pages-design?node-id=313-34148',
  referenceDirectory: 'src/design-review/key-highlights/reference',
  proposalDirectory: 'src/design-review/key-highlights/proposal',
  referenceLabel: 'Initial pilot baseline — not a corporate approval.', views: highlightViews,
  renderCurrent: (id) => { const view = highlightView(id); return h('div', { style: { width: `${view.width}px`, maxWidth: 'none' } }, [h(CurrentKeyHighlights, { items: highlightItems(id, currentHighlights), theme: view.theme, motion: 'static' })]); },
  renderProposed: (id) => { const view = highlightView(id); return h('div', { style: { width: `${view.width}px`, maxWidth: 'none' } }, [h(ProposedKeyHighlights, { items: highlightItems(id, proposedHighlights), theme: view.theme, motion: 'static' })]); },
  compare: compareHighlights,
};
function defineReviewRegistry(reviews: readonly ReviewRegistration[]) {
  const ids = new Set<string>();
  const directories = new Set<string>();
  for (const review of reviews) {
    if (ids.has(review.id) || directories.has(review.referenceDirectory) || directories.has(review.proposalDirectory)
      || review.referenceDirectory === review.proposalDirectory) throw new Error(`Review registration for ${review.id} is not isolated.`);
    ids.add(review.id); directories.add(review.referenceDirectory); directories.add(review.proposalDirectory);
  }
  return reviews;
}
export const registeredReviews = defineReviewRegistry([ctaReview, logoReview, highlightsReview]);
