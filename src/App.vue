<script setup lang="ts">
import CTAButton from './components/CTAButton.vue';
import ProductLogo from './components/ProductLogo.vue';
import './App.css';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="demo-page" id="top">
    <header class="demo-header">
      <div class="demo-shell demo-header__inner">
        <ProductLogo size="XS" product-name="Cyber Protect Cloud" />
        <span class="demo-header__label">Component pilot</span>
      </div>
    </header>

    <main>
      <section class="demo-hero demo-shell" aria-labelledby="demo-title">
        <div class="demo-hero__copy">
          <p class="demo-eyebrow">Figma → Design Review → application</p>
          <h1 id="demo-title">See applied components in context.</h1>
          <p class="demo-lead">This local page uses the currently applied ProductLogo and CTAButton. Proposals stay in Design Review until they are approved and applied.</p>
          <CTAButton label="View components" @click="scrollTo('components')" />
        </div>
        <div class="demo-hero__aside" aria-label="Workflow summary">
          <span class="demo-hero__step">01 <strong>Inspect in Figma</strong></span>
          <span class="demo-hero__step">02 <strong>Compare in Design Review</strong></span>
          <span class="demo-hero__step">03 <strong>View the applied result</strong></span>
        </div>
      </section>

      <section class="demo-showcase" id="components" aria-labelledby="components-title">
        <div class="demo-shell demo-showcase__inner">
          <div>
            <p class="demo-eyebrow">Applied components</p>
            <h2 id="components-title">A small, live preview.</h2>
            <p>The logo above and both buttons on this page come from the same shared Vue components used by Storybook.</p>
          </div>
          <div class="demo-showcase__action">
            <CTAButton label="Back to top" @click="scrollTo('top')" />
          </div>
        </div>
      </section>
    </main>

    <footer class="demo-footer demo-shell">Local demo — not production.</footer>
  </div>
</template>
