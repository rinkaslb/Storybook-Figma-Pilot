import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createReviewService, reviewMiddleware } from '../scripts/design-review-service.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFiles = [
  'src/components/CTAButton.css', 'src/components/CTAButton.vue',
  'src/assets/cta-loading.svg', 'src/assets/cta-success.svg',
  'src/design-review/reference/CTAButton.css', 'src/design-review/reference/CTAButton.vue',
  'src/design-review/reference/cta-loading.svg', 'src/design-review/reference/cta-success.svg',
  'src/design-review/proposal/CTAButton.css', 'src/design-review/proposal/CTAButton.vue',
  'src/design-review/proposal/cta-loading.svg', 'src/design-review/proposal/cta-success.svg',
  'src/design-review/proposal/review.json',
  'src/design-review/approved-figma.json', 'package.json', 'package-lock.json', 'vite.config.ts',
];
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cta-review-'));
  temporaryRoots.push(root);
  for (const relative of fixtureFiles) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(sourceRoot, relative), target);
  }
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'src/design-review/approved-figma.json'), 'utf8'));
  const spec = structuredClone(baseline);
  delete spec.version;
  for (const state of Object.values(spec.states)) state.radius = 16;
  let version = 'figma-v1';
  const fetchSnapshot = async () => ({
    version,
    spec,
    fingerprint: createHash('sha256').update(JSON.stringify({ version, spec })).digest('hex'),
  });
  const file = (relative) => fs.readFile(path.join(root, relative), 'utf8');
  return { root, spec, file, fetchSnapshot, changeVersion: () => { version = 'figma-v2'; } };
}

async function setManualRadius(root, file, radius) {
  const proposalPath = path.join(root, 'src/design-review/proposal/CTAButton.css');
  await fs.writeFile(proposalPath, (await file('src/design-review/proposal/CTAButton.css')).replace(/border-radius: \d+px;/, `border-radius: ${radius}px;`));
  const reviewPath = path.join(root, 'src/design-review/proposal/review.json');
  const review = JSON.parse(await file('src/design-review/proposal/review.json'));
  review.figmaRadius = radius;
  review.differences.supported = [`default: radius 4 → ${radius}`];
  await fs.writeFile(reviewPath, JSON.stringify(review));
}

test('prepares only the proposal, then applies it and saves a recoverable copy', async () => {
  const { root, file, fetchSnapshot } = await fixture();
  let checks = 0;
  const service = createReviewService({ projectRoot: root, fetchSnapshot, runChecks: async () => { checks += 1; } });
  const appBefore = await file('src/components/CTAButton.css');
  const referenceBefore = await file('src/design-review/reference/CTAButton.css');
  await service.prepare();
  assert.equal(await file('src/components/CTAButton.css'), appBefore);
  assert.equal(await file('src/design-review/reference/CTAButton.css'), referenceBefore);
  assert.equal((await service.status()).canApply, true);
  const result = await service.apply();
  assert.equal(result.phase, 'applied');
  assert.equal(checks, 2);
  assert.match(await file('src/components/CTAButton.css'), /border-radius: 16px;/);
  assert.match(await file('src/design-review/reference/CTAButton.css'), /border-radius: 16px;/);
  assert.equal((await service.status()).phase, 'applied');
  const backup = await file(`src/design-review/.local/backups/${result.backupId}/src__components__CTAButton.css`);
  assert.equal(backup, appBefore);
});

test('restores app and reference when post-apply checks fail', async () => {
  const { root, file, fetchSnapshot } = await fixture();
  let checks = 0;
  const service = createReviewService({ projectRoot: root, fetchSnapshot, runChecks: async () => {
    checks += 1;
    if (checks === 2) throw new Error('fallo de prueba');
  } });
  const appBefore = await file('src/components/CTAButton.css');
  const referenceBefore = await file('src/design-review/reference/CTAButton.css');
  await service.prepare();
  await assert.rejects(service.apply(), /fallo de prueba/);
  assert.equal(await file('src/components/CTAButton.css'), appBefore);
  assert.equal(await file('src/design-review/reference/CTAButton.css'), referenceBefore);
  assert.match((await service.status()).error, /The previous version was restored/);
});

test('rejects a prepared review when Figma or source code changes', async () => {
  const figma = await fixture();
  const first = createReviewService({ projectRoot: figma.root, fetchSnapshot: figma.fetchSnapshot, runChecks: async () => {} });
  await first.prepare();
  figma.changeVersion();
  assert.equal((await first.status()).canApply, false);
  await assert.rejects(first.apply(), /Figma changed/);

  const code = await fixture();
  const second = createReviewService({ projectRoot: code.root, fetchSnapshot: code.fetchSnapshot, runChecks: async () => {} });
  await second.prepare();
  await fs.appendFile(path.join(code.root, 'src/components/CTAButton.vue'), '\n// source changed\n');
  assert.equal((await second.status()).canApply, false);
  await assert.rejects(second.apply(), /The code changed/);
});

test('requires manual implementation for unsupported Figma properties', async () => {
  const { root, spec, fetchSnapshot, file } = await fixture();
  spec.states.default.fill = '#ffffff';
  const service = createReviewService({ projectRoot: root, fetchSnapshot, runChecks: async () => { throw new Error('checks should not run'); } });
  const proposalBefore = await file('src/design-review/proposal/CTAButton.css');
  await assert.rejects(service.prepare(), /pending implementation/);
  assert.equal(await file('src/design-review/proposal/CTAButton.css'), proposalBefore);
  assert.equal((await service.status()).phase, 'needs-implementation');
});

test('manual preparation enables approval while leaving Current untouched', async () => {
  const { root, file } = await fixture();
  await setManualRadius(root, file, 16);
  const appBefore = await file('src/components/CTAButton.css');
  const referenceBefore = await file('src/design-review/reference/CTAButton.css');
  let checks = 0;
  const service = createReviewService({ projectRoot: root, automaticFigmaAvailable: false, runChecks: async () => { checks += 1; } });
  await service.prepareManual(16);
  const status = await service.status();
  assert.equal(status.mode, 'manual');
  assert.equal(status.manualReady, true);
  assert.equal(status.canApply, true);
  assert.equal(checks, 1);
  assert.equal(await file('src/components/CTAButton.css'), appBefore);
  assert.equal(await file('src/design-review/reference/CTAButton.css'), referenceBefore);
  await assert.rejects(service.apply(), /Prepare and check/);
});

test('manual browser approval becomes unavailable when reviewed code changes', async () => {
  const { root, file } = await fixture();
  await setManualRadius(root, file, 16);
  const service = createReviewService({ projectRoot: root, automaticFigmaAvailable: false, runChecks: async () => {} });
  await service.prepareManual(16);
  await fs.appendFile(path.join(root, 'src/design-review/proposal/CTAButton.css'), '\n/* changed after preparation */\n');
  assert.equal((await service.status()).canApply, false);
  await assert.rejects(service.applyPreparedManual(), /code changed after preparation/);
});

test('manual application writes the reviewed radius only after preparation and keeps a backup', async () => {
  const { root, file } = await fixture();
  await setManualRadius(root, file, 16);
  const appBefore = await file('src/components/CTAButton.css');
  let checks = 0;
  const service = createReviewService({ projectRoot: root, automaticFigmaAvailable: false, runChecks: async () => { checks += 1; } });
  await service.prepareManual(16);
  await assert.rejects(service.applyManual(4), /Figma radius changed/);
  const result = await service.applyManual(16);
  assert.equal(result.phase, 'applied');
  assert.equal(checks, 2);
  assert.match(await file('src/components/CTAButton.css'), /border-radius: 16px;/);
  assert.match(await file('src/design-review/reference/CTAButton.css'), /border-radius: 16px;/);
  assert.equal(JSON.parse(await file('src/design-review/approved-figma.json')).states.default.radius, 16);
  assert.equal(await file(`src/design-review/.local/backups/${result.backupId}/src__components__CTAButton.css`), appBefore);
});

test('manual application restores Current and its reference when checks fail', async () => {
  const { root, file } = await fixture();
  await setManualRadius(root, file, 16);
  const appBefore = await file('src/components/CTAButton.css');
  const referenceBefore = await file('src/design-review/reference/CTAButton.css');
  let checks = 0;
  const service = createReviewService({ projectRoot: root, automaticFigmaAvailable: false, runChecks: async () => {
    checks += 1;
    if (checks === 2) throw new Error('check failed');
  } });
  await service.prepareManual(16);
  await assert.rejects(service.applyManual(16), /check failed/);
  assert.equal(await file('src/components/CTAButton.css'), appBefore);
  assert.equal(await file('src/design-review/reference/CTAButton.css'), referenceBefore);
  assert.match((await service.status()).error, /previous version was restored/);
});

test('browser routes dispatch only to the registered component service', async () => {
  let ctaStatusCalls = 0;
  const middleware = reviewMiddleware({
    'cta-button': { status: async () => { ctaStatusCalls += 1; return { phase: 'unprepared' }; } },
  });
  async function request(url) {
    const response = {
      status: null,
      body: '',
      setHeader() { return this; },
      writeHead(status) { this.status = status; return this; },
      end(body = '') { this.body = body; return this; },
    };
    await middleware({ url, method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:6006' } }, response, () => {});
    return response;
  }
  const unknown = await request('/__pilot_review/logo/status');
  assert.equal(unknown.status, 404);
  assert.equal(ctaStatusCalls, 0);
  const cta = await request('/__pilot_review/cta-button/status');
  assert.equal(cta.status, 200);
  assert.equal(JSON.parse(cta.body).componentId, 'cta-button');
  assert.equal(ctaStatusCalls, 1);
});

test('browser apply dispatches a prepared manual CTA review', async () => {
  let applications = 0;
  const middleware = reviewMiddleware({
    'cta-button': {
      status: async () => ({ mode: 'manual' }),
      applyPreparedManual: async () => { applications += 1; return { phase: 'applied' }; },
    },
  });
  const response = {
    status: null, body: '',
    setHeader() { return this; },
    writeHead(status) { this.status = status; return this; },
    end(body = '') { this.body = body; return this; },
  };
  await middleware({
    url: '/__pilot_review/cta-button/apply', method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: 'localhost:6007', 'x-pilot-review': '1' },
  }, response, () => {});
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).phase, 'applied');
  assert.equal(applications, 1);
});
