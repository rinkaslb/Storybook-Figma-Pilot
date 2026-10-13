# CTA pilot · Vue 3

Local Vue 3 + TypeScript + Vite migration of the component pilot. The React project in `../cta-pilot` is independent and unchanged.

## Run locally

Use Node 24 or another version supported by the installed Vite and Storybook versions.

```sh
npm ci
npm run dev
```

Open `http://localhost:5174/` for the demo. In another terminal:

```sh
npm run storybook
```

Open `http://localhost:6007/?path=/story/design-review--overview`. These ports are separate from the React pilot's 5173 and 6006. Storybook's dashboard links to the Vue demo as “Local demo — not production.” The demo imports only applied components from `src/components`; review proposals stay isolated until explicitly approved and applied.

## Components and design review

- `Components / CTAButton` contains default, hover, active, keyboard focus, loading, success and provisional disabled stories. Loading has a static SVG because Figma does not define animation timing or keyframes. The caller controls the optional 500 ms success display.
- `Brand / ProductLogo` contains XS–XXL, Stacked/Inline, Light/Dark and edition options. XS is Stacked only, and the edition label appears in Stacked. The SVG wordmark is local; product and edition names are text.
- `Slices / KeyHighlights` contains a playground with Controls, final static view, motion demo and responsive checks at 1440, 1280, 1024, 768 and 360 px. Its count starts when rows enter the viewport, re-entry does not replay, and reduced motion shows final values. The replay button exists for Storybook inspection. Example metrics require verified sources before publication.
- `Design Review / Overview` lists only the three registered components. It compares independent Current and Proposed copies and displays the pending count, differences and Figma links. ProductLogo and KeyHighlights Current copies are pilot baselines, not corporate approvals. The CTA Current radius is 4 px; the isolated Proposed radius is 16 px after the latest Figma review.

Acronis Cyber font files are not supplied. The CSS retains the existing fallback fonts, so typography can differ from Figma. The design tab embeds Figma links but does not change Figma.

The local service runs only with Storybook development mode. ProductLogo and KeyHighlights services report status and differences and cannot prepare or apply changes. In manual mode, Codex checks the CTA through Figma MCP, updates its review record, and prepares the isolated proposal with build and story checks. “Approve and apply” becomes available in Storybook only while that checked proposal and source code remain unchanged; clicking it makes a backup, reruns checks, and rolls back on failure. The automatic Figma REST path is available only if `FIGMA_TOKEN` is configured. It also supports only the CTA radius and rejects unsupported changes. No path publishes to production.

Migration preserved the pending CTA proposal and its review record. The old React preparation state is archived in `migration-data/react-review-state.json`; it is deliberately not an active Vue preparation because the source hash changed. To retain browser-owned data when switching ports, see `migration-data/browser-storage.md`.

## Verify

```sh
npm run lint
npm run build
npm run build-storybook
npm test
```

`npm test` runs the isolated Node service tests and Storybook's Chromium story tests. The CTA service's `prepare` and `apply` commands run these build and story checks too. Do not treat a successful build as approval of a proposal.
