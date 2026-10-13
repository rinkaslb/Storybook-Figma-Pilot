import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileKey = 'NjTVThQ8addqzP29G9sRpO';
const stateIds = {
  default: ['1:4584', '1:4505'],
  hover: ['1:4599', '1:4506'],
  active: ['1:4614', '1:4507'],
  loading: ['1:4629', '1:4508'],
  success: ['1:4644', '1:4509'],
};
const files = {
  appCss: 'src/components/CTAButton.css',
  appTs: 'src/components/CTAButton.vue',
  appLoading: 'src/assets/cta-loading.svg',
  appSuccess: 'src/assets/cta-success.svg',
  refCss: 'src/design-review/reference/CTAButton.css',
  refTs: 'src/design-review/reference/CTAButton.vue',
  refLoading: 'src/design-review/reference/cta-loading.svg',
  refSuccess: 'src/design-review/reference/cta-success.svg',
  proposalCss: 'src/design-review/proposal/CTAButton.css',
  proposalTs: 'src/design-review/proposal/CTAButton.vue',
  proposalLoading: 'src/design-review/proposal/cta-loading.svg',
  proposalSuccess: 'src/design-review/proposal/cta-success.svg',
  manualReview: 'src/design-review/proposal/review.json',
  approved: 'src/design-review/approved-figma.json',
  state: 'src/design-review/.local/state.json',
};
const backupFiles = [files.appCss, files.refCss, files.approved];

class ReviewError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

const hash = (value) => createHash('sha256').update(value).digest('hex');

function colorToHex(paint) {
  if (!paint || paint.type !== 'SOLID' || !paint.color) return null;
  return `#${['r', 'g', 'b'].map((part) => Math.round(paint.color[part] * 255).toString(16).padStart(2, '0')).join('')}`;
}

function firstSolid(paints) {
  return colorToHex(paints?.find((paint) => paint.type === 'SOLID' && paint.visible !== false));
}

function findNode(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function frameSpec(frame) {
  if (!frame || frame.type !== 'FRAME') throw new ReviewError('A CTA example is missing in Figma.');
  const base = frame.children?.find((child) => child.type === 'INSTANCE');
  const text = findNode(base, (node) => node.type === 'TEXT' && node.name === 'Text');
  const focus = frame.children?.find((child) => child.name === 'In focus');
  const iconProperty = Object.entries(base?.componentProperties ?? {}).find(([key]) => key.startsWith('Icon#'))?.[1];
  const layout = base?.componentProperties?.Layout?.value ?? null;
  const style = text?.style ?? {};
  const radii = frame.rectangleCornerRadii;
  const radius = typeof frame.cornerRadius === 'number'
    ? frame.cornerRadius
    : Array.isArray(radii) && radii.every((value) => value === radii[0]) ? radii[0] : null;
  return {
    radius,
    width: frame.absoluteBoundingBox?.width ?? frame.size?.x ?? null,
    height: frame.absoluteBoundingBox?.height ?? frame.size?.y ?? null,
    fill: firstSolid(frame.fills),
    label: text?.characters ?? null,
    textColor: firstSolid(text?.fills),
    fontFamily: style.fontFamily ?? null,
    fontSize: style.fontSize ?? null,
    fontWeight: style.fontWeight ?? null,
    lineHeight: style.lineHeightPx ?? null,
    layout,
    icon: iconProperty?.value ?? null,
    focusRadius: focus?.cornerRadius ?? null,
    focusWidth: focus?.strokeWeight ?? null,
    focusColor: firstSolid(focus?.strokes),
  };
}

export function normalizeFigmaResponse(payload) {
  if (!payload || typeof payload.version !== 'string' || !payload.nodes) {
    throw new ReviewError('Incomplete response from Figma.', 502);
  }
  const spec = { states: {}, comments: {} };
  for (const [name, [frameId, commentId]] of Object.entries(stateIds)) {
    spec.states[name] = frameSpec(payload.nodes[frameId]?.document);
    const comment = payload.nodes[commentId]?.document;
    spec.comments[name] = comment?.type === 'TEXT' ? comment.characters : null;
  }
  return { version: payload.version, spec, fingerprint: hash(JSON.stringify({ version: payload.version, spec })) };
}

export async function fetchFigmaSnapshot() {
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new ReviewError('Set FIGMA_TOKEN with file_content:read permission to check Figma.', 503);
  const ids = Object.values(stateIds).flat().join(',');
  const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
  url.searchParams.set('ids', ids);
  const response = await fetch(url, {
    headers: { 'X-Figma-Token': token },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!response.ok) throw new ReviewError(`Figma returned ${response.status}; the current version could not be verified.`, 503);
  return normalizeFigmaResponse(await response.json());
}

function compareSpecs(approved, current) {
  const supported = [];
  const pending = [];
  for (const state of Object.keys(stateIds)) {
    const before = approved.states?.[state] ?? {};
    const after = current.states?.[state] ?? {};
    for (const property of Object.keys(before)) {
      if (before[property] === after[property]) continue;
      const change = `${state}: ${property} ${String(before[property])} → ${String(after[property])}`;
      (property === 'radius' ? supported : pending).push(change);
    }
    if (approved.comments?.[state] !== current.comments?.[state]) {
      pending.push(`${state}: Comment annotation changed.`);
    }
  }
  return { supported, pending };
}

function rootRadius(css, className) {
  const start = css.indexOf(`.${className} {`);
  if (start < 0) throw new ReviewError(`CSS rule ${className} was not found.`);
  const end = css.indexOf('}', start);
  const match = css.slice(start, end).match(/border-radius:\s*(\d+(?:\.\d+)?)px;/);
  if (!match) throw new ReviewError(`Corner radius for ${className} was not found.`);
  return Number(match[1]);
}

function withRootRadius(css, className, radius) {
  if (!Number.isFinite(radius) || radius < 0 || radius > 100) throw new ReviewError('Invalid Figma corner radius.');
  const start = css.indexOf(`.${className} {`);
  const end = css.indexOf('}', start);
  if (start < 0 || end < 0) throw new ReviewError(`CSS rule ${className} was not found.`);
  const block = css.slice(start, end);
  if (!/border-radius:\s*\d+(?:\.\d+)?px;/.test(block)) throw new ReviewError(`Corner radius for ${className} was not found.`);
  return css.slice(0, start) + block.replace(/border-radius:\s*\d+(?:\.\d+)?px;/, `border-radius: ${radius}px;`) + css.slice(end);
}

function proposalToApp(css) {
  return css.replaceAll('review-proposal-cta', 'cta-button')
    .replaceAll('review-preview-hover', 'cta-button--preview-hover')
    .replaceAll('review-preview-active', 'cta-button--preview-active')
    .replace('.cta-button:focus-visible,\n.cta-button.review-preview-focus {', '.cta-button:focus-visible {');
}

function proposalToReference(css) {
  return css.replaceAll('review-proposal-cta', 'review-reference-cta');
}

async function assertSafePath(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new ReviewError('Path is outside the project.');
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    current = path.join(current, segment);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new ReviewError('Symbolic links are not allowed in review files.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

async function atomicWrite(root, relative, content) {
  const target = await assertSafePath(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, content, { mode: 0o600 });
  await fs.rename(temporary, target);
}

async function readFile(root, relative) {
  return fs.readFile(await assertSafePath(root, relative));
}

async function readJson(root, relative, fallback) {
  try {
    return JSON.parse((await readFile(root, relative)).toString());
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function sourceHash(root) {
  const entries = [];
  async function walk(relative) {
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.name === '.local') continue;
      const next = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new ReviewError('Symbolic links are not allowed in reviewed code.');
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) entries.push(next);
    }
  }
  for (const directory of ['src', '.storybook', 'scripts', 'tests']) {
    try { await walk(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const relative of ['package.json', 'package-lock.json', 'vite.config.ts']) entries.push(relative);
  entries.sort();
  const digest = createHash('sha256');
  for (const relative of entries) {
    digest.update(relative).update('\0').update(await readFile(root, relative));
  }
  return digest.digest('hex');
}

async function runCommand(root, executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: root,
      shell: false,
      env: { ...process.env, CI: '1', PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk) => { output = (output + chunk.toString()).slice(-5000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill('SIGTERM'), 120000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new ReviewError(`Failed: ${executable} ${args.join(' ')} (exit code ${code}).\n${output}`));
    });
  });
}

export async function runFixedChecks(root) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await runCommand(root, npm, ['run', 'build']);
  await runCommand(root, npm, ['run', 'build-storybook']);
  await runCommand(root, process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'storybook']);
}

export function createReviewService({ projectRoot = defaultRoot, fetchSnapshot = fetchFigmaSnapshot, runChecks = runFixedChecks, automaticFigmaAvailable = fetchSnapshot !== fetchFigmaSnapshot || Boolean(process.env.FIGMA_TOKEN) } = {}) {
  const root = path.resolve(projectRoot);
  let busy = false;

  async function withLock(operation) {
    if (busy) throw new ReviewError('Another check is already running.');
    busy = true;
    try { return await operation(); } finally { busy = false; }
  }

  async function approved() {
    return readJson(root, files.approved, null);
  }

  async function manualReview() {
    const review = await readJson(root, files.manualReview, null);
    if (!review) return null;
    if (review.source !== 'Figma MCP' || !Number.isFinite(review.figmaRadius)
      || !Array.isArray(review.differences?.supported) || !Array.isArray(review.differences?.pending)
      || Number.isNaN(Date.parse(review.checkedAt))) {
      throw new ReviewError('The manual Figma review record is invalid.');
    }
    return review;
  }

  async function saveState(value) {
    await atomicWrite(root, files.state, JSON.stringify(value, null, 2));
  }

  async function backup() {
    const id = randomUUID();
    const directory = `src/design-review/.local/backups/${id}`;
    for (const relative of backupFiles) {
      await atomicWrite(root, `${directory}/${relative.replaceAll('/', '__')}`, await readFile(root, relative));
    }
    return id;
  }

  async function restore(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ReviewError('Invalid recovery backup.');
    const directory = `src/design-review/.local/backups/${id}`;
    for (const relative of backupFiles) {
      await atomicWrite(root, relative, await readFile(root, `${directory}/${relative.replaceAll('/', '__')}`));
    }
  }

  async function validateProposal(approvedSpec) {
    const proposalCss = (await readFile(root, files.proposalCss)).toString();
    const referenceCss = (await readFile(root, files.refCss)).toString();
    const appCss = (await readFile(root, files.appCss)).toString();
    const approvedRadius = approvedSpec.states.default.radius;
    const candidateRadius = rootRadius(proposalCss, 'review-proposal-cta');
    if (proposalToReference(withRootRadius(proposalCss, 'review-proposal-cta', approvedRadius)) !== referenceCss) {
      throw new ReviewError('The proposal changes properties beyond the supported corner radius; manual implementation is required.');
    }
    if (withRootRadius(proposalToApp(proposalCss), 'cta-button', rootRadius(appCss, 'cta-button')) !== appCss) {
      throw new ReviewError('The proposed transformation does not match the application CTA.');
    }
    const proposalTs = (await readFile(root, files.proposalTs)).toString();
    const referenceTs = (await readFile(root, files.refTs)).toString();
    if (proposalTs.replaceAll('review-proposal-cta', 'review-reference-cta') !== referenceTs) {
      throw new ReviewError('The proposed component contains changes that cannot be applied automatically.');
    }
    for (const [proposal, reference, app] of [
      [files.proposalLoading, files.refLoading, files.appLoading],
      [files.proposalSuccess, files.refSuccess, files.appSuccess],
    ]) {
      const [a, b, c] = await Promise.all([readFile(root, proposal), readFile(root, reference), readFile(root, app)]);
      if (!a.equals(b) || !b.equals(c)) throw new ReviewError('Icon changes require manual implementation.');
    }
    return { candidateRadius, proposalCss, appCss: proposalToApp(proposalCss), referenceCss: proposalToReference(proposalCss) };
  }

  async function scan() {
    return withLock(async () => {
      const snapshot = await fetchSnapshot();
      const currentApproved = await approved();
      if (!currentApproved) throw new ReviewError('The approved reference is missing.');
      const differences = compareSpecs(currentApproved, snapshot.spec);
      const previous = await readJson(root, files.state, { phase: 'unprepared' });
      await saveState({ ...previous, lastScan: { version: snapshot.version, differences } });
      return { version: snapshot.version, differences };
    });
  }

  async function prepare() {
    return withLock(async () => {
      const snapshot = await fetchSnapshot();
      const currentApproved = await approved();
      if (!currentApproved) throw new ReviewError('The approved reference is missing.');
      const differences = compareSpecs(currentApproved, snapshot.spec);
      if (differences.pending.length) {
        await saveState({ phase: 'needs-implementation', differences, error: 'Figma contains properties pending implementation.' });
        throw new ReviewError('Figma contains properties pending implementation.');
      }
      if (!differences.supported.length) throw new ReviewError('There are no supported changes to prepare.');
      const radii = Object.values(snapshot.spec.states).map((state) => state.radius);
      if (radii.some((radius) => radius !== radii[0])) throw new ReviewError('Figma examples use different corner radii; manual implementation is required.');
      const proposalCss = (await readFile(root, files.proposalCss)).toString();
      await atomicWrite(root, files.proposalCss, withRootRadius(proposalCss, 'review-proposal-cta', radii[0]));
      const candidate = await validateProposal(currentApproved);
      if (candidate.candidateRadius !== radii[0]) throw new ReviewError('The proposal does not match Figma.');
      try {
        const beforeChecks = await sourceHash(root);
        await runChecks(root);
        if (await sourceHash(root) !== beforeChecks) throw new ReviewError('The code changed during checks. Refresh the review.');
        const latest = await fetchSnapshot();
        if (latest.fingerprint !== snapshot.fingerprint) throw new ReviewError('Figma changed during preparation. Refresh the review.');
        const prepared = {
          phase: 'prepared',
          figmaVersion: snapshot.version,
          figmaFingerprint: snapshot.fingerprint,
          sourceHash: await sourceHash(root),
          proposalHash: hash(candidate.proposalCss),
          radius: candidate.candidateRadius,
          differences,
          checkedAt: new Date().toISOString(),
        };
        await saveState(prepared);
        return prepared;
      } catch (error) {
        await saveState({ phase: 'error', error: error.message, differences });
        throw error;
      }
    });
  }

  async function apply() {
    return withLock(async () => {
      const prepared = await readJson(root, files.state, null);
      if (prepared?.phase !== 'prepared') throw new ReviewError('Prepare and check the proposal before applying it.');
      const currentApproved = await approved();
      if (await sourceHash(root) !== prepared.sourceHash) throw new ReviewError('The code changed after preparation. Refresh the review.');
      const snapshot = await fetchSnapshot();
      if (snapshot.fingerprint !== prepared.figmaFingerprint || snapshot.version !== prepared.figmaVersion) {
        throw new ReviewError('Figma changed after preparation. Refresh the review.');
      }
      const candidate = await validateProposal(currentApproved);
      if (hash(candidate.proposalCss) !== prepared.proposalHash || candidate.candidateRadius !== prepared.radius) {
        throw new ReviewError('The proposal changed after preparation. Refresh the review.');
      }
      const backupId = await backup();
      await saveState({ ...prepared, phase: 'applying', backupId });
      try {
        await atomicWrite(root, files.appCss, candidate.appCss);
        const beforeChecks = await sourceHash(root);
        await runChecks(root);
        if (await sourceHash(root) !== beforeChecks) throw new ReviewError('The code changed during checks.');
        const latest = await fetchSnapshot();
        if (latest.fingerprint !== prepared.figmaFingerprint) throw new ReviewError('Figma changed during application.');
        await atomicWrite(root, files.refCss, candidate.referenceCss);
        await atomicWrite(root, files.approved, JSON.stringify({ version: snapshot.version, ...snapshot.spec }, null, 2));
        const applied = { phase: 'applied', appliedAt: new Date().toISOString(), backupId, figmaVersion: snapshot.version };
        await saveState(applied);
        return applied;
      } catch (error) {
        await restore(backupId);
        await saveState({ phase: 'error', error: `The previous version was restored. ${error.message}`, backupId });
        throw error;
      }
    });
  }

  async function prepareManual(verifiedRadius) {
    return withLock(async () => {
      const currentApproved = await approved();
      if (!currentApproved) throw new ReviewError('The approved reference is missing.');
      const review = await manualReview();
      if (!review || review.figmaRadius !== verifiedRadius) throw new ReviewError('Codex must record the verified Figma radius in proposal/review.json.');
      if (review.differences.pending.length) throw new ReviewError('The manual review has changes pending implementation.');
      const candidate = await validateProposal(currentApproved);
      if (!Number.isFinite(verifiedRadius) || candidate.candidateRadius !== verifiedRadius) {
        throw new ReviewError('The proposed radius does not match the value Codex verified in Figma.');
      }
      const previousRadius = currentApproved.states.default.radius;
      if (candidate.candidateRadius === previousRadius) throw new ReviewError('There are no changes to prepare.');
      const differences = {
        supported: Object.keys(stateIds).map((state) => `${state}: radius ${previousRadius} → ${verifiedRadius}`),
        pending: [],
      };
      try {
        const beforeChecks = await sourceHash(root);
        await runChecks(root);
        if (await sourceHash(root) !== beforeChecks) throw new ReviewError('The code changed during checks. Refresh the review.');
        const prepared = {
          phase: 'manual-prepared',
          sourceHash: beforeChecks,
          proposalHash: hash(candidate.proposalCss),
          radius: candidate.candidateRadius,
          differences,
          checkedAt: new Date().toISOString(),
        };
        await saveState(prepared);
        return prepared;
      } catch (error) {
        await saveState({ phase: 'error', error: error.message, differences });
        throw error;
      }
    });
  }

  async function applyManual(verifiedRadius) {
    return withLock(async () => {
      const prepared = await readJson(root, files.state, null);
      if (prepared?.phase !== 'manual-prepared') throw new ReviewError('Codex must prepare and check the manual proposal before applying it.');
      if (await sourceHash(root) !== prepared.sourceHash) throw new ReviewError('The code changed after preparation. Refresh the review.');
      const review = await manualReview();
      if (!review || review.figmaRadius !== prepared.radius || review.differences.pending.length) {
        throw new ReviewError('The recorded Figma review changed after preparation. Refresh the review.');
      }
      if (verifiedRadius !== prepared.radius) throw new ReviewError('The Figma radius changed after preparation. Refresh the review.');
      const currentApproved = await approved();
      const candidate = await validateProposal(currentApproved);
      if (hash(candidate.proposalCss) !== prepared.proposalHash || candidate.candidateRadius !== prepared.radius) {
        throw new ReviewError('The proposal changed after preparation. Refresh the review.');
      }
      const backupId = await backup();
      await saveState({ ...prepared, phase: 'applying', backupId });
      try {
        await atomicWrite(root, files.appCss, candidate.appCss);
        const beforeChecks = await sourceHash(root);
        await runChecks(root);
        if (await sourceHash(root) !== beforeChecks) throw new ReviewError('The code changed during checks.');
        await atomicWrite(root, files.refCss, candidate.referenceCss);
        const nextApproved = structuredClone(currentApproved);
        nextApproved.version = null;
        for (const state of Object.keys(stateIds)) nextApproved.states[state].radius = candidate.candidateRadius;
        await atomicWrite(root, files.approved, JSON.stringify(nextApproved, null, 2));
        const applied = { phase: 'applied', appliedAt: new Date().toISOString(), backupId, mode: 'manual' };
        await saveState(applied);
        return applied;
      } catch (error) {
        await restore(backupId);
        await saveState({ phase: 'error', error: `The previous version was restored. ${error.message}`, backupId });
        throw error;
      }
    });
  }

  async function applyPreparedManual() {
    const prepared = await readJson(root, files.state, null);
    if (prepared?.phase !== 'manual-prepared') throw new ReviewError('Prepare and check the manual proposal before applying it.');
    return applyManual(prepared.radius);
  }

  async function status() {
    let state = await readJson(root, files.state, { phase: 'unprepared' });
    if (state.phase === 'applying' && state.backupId) {
      await restore(state.backupId);
      state = { phase: 'error', error: 'The previous version was restored after an interruption.', backupId: state.backupId };
      await saveState(state);
    }
    const currentApproved = await approved();
    const review = automaticFigmaAvailable ? null : await manualReview();
    let snapshot = null;
    let figmaError = null;
    if (automaticFigmaAvailable) {
      try { snapshot = await fetchSnapshot(); } catch (error) { figmaError = error.message; }
    }
    const differences = snapshot && currentApproved
      ? compareSpecs(currentApproved, snapshot.spec)
      : review && state.phase === 'applied' && currentApproved
        && review.figmaRadius === currentApproved.states.default.radius && !review.differences.pending.length
        ? { supported: [], pending: [] }
        : review?.differences ?? state.differences ?? null;
    const codeFresh = ['prepared', 'manual-prepared'].includes(state.phase) ? (await sourceHash(root)) === state.sourceHash : false;
    const figmaFresh = state.phase === 'prepared' && snapshot?.fingerprint === state.figmaFingerprint;
    const manualCanApply = state.phase === 'manual-prepared' && codeFresh
      && review?.figmaRadius === state.radius
      && Boolean(differences?.supported.length) && !differences?.pending.length;
    return {
      phase: state.phase,
      mode: automaticFigmaAvailable ? 'automatic' : 'manual',
      canApply: Boolean((state.phase === 'prepared' && codeFresh && figmaFresh && !differences?.pending?.length) || manualCanApply),
      manualReady: Boolean(manualCanApply),
      staleCode: ['prepared', 'manual-prepared'].includes(state.phase) && !codeFresh,
      staleFigma: state.phase === 'prepared' && !figmaFresh,
      figmaError,
      differences,
      error: state.error ?? null,
      backupId: state.backupId ?? null,
      checkedAt: state.checkedAt ?? null,
      figmaCheckedAt: review?.checkedAt ?? null,
      supportedProperties: ['Outer CTA corner radius (all five states)'],
      pendingProperties: ['Colors, dimensions, text, typography, icons, focus outline, and animation require manual implementation'],
    };
  }

  return { status, scan, prepare, apply, prepareManual, applyManual, applyPreparedManual };
}

export function createProductLogoReviewService({ projectRoot = defaultRoot } = {}) {
  const root = path.resolve(projectRoot);
  const directory = 'src/design-review/product-logo';
  return {
    async status() {
      const review = await readJson(root, `${directory}/proposal/review.json`, null);
      if (!review || review.source !== 'Figma MCP' || review.figmaNodeId !== '112:6027') {
        throw new ReviewError('The ProductLogo MCP review record is missing or invalid.');
      }
      const normalized = (value) => value.replaceAll('review-proposed-logo', 'review-current-logo')
        .replaceAll('ProposedProductLogo', 'CurrentProductLogo');
      const changed = [];
      for (const file of ['ProductLogo.vue', 'ProductLogo.css', 'acronis-light.svg', 'acronis-dark.svg']) {
        const [current, proposed] = await Promise.all([
          readFile(root, `${directory}/reference/${file}`),
          readFile(root, `${directory}/proposal/${file}`),
        ]);
        if (normalized(proposed.toString()) !== current.toString()) changed.push(`${file} differs from the pilot baseline.`);
      }
      const differences = {
        supported: [...new Set([...(review.differences?.supported ?? []), ...changed])],
        pending: review.differences?.pending ?? [],
      };
      return {
        phase: differences.supported.length || differences.pending.length ? 'unprepared' : 'baseline',
        mode: 'manual', canApply: false, manualReady: false, staleCode: false, staleFigma: false,
        figmaError: null, differences, error: null, backupId: null, checkedAt: null,
        figmaCheckedAt: review.checkedAt,
        supportedProperties: ['Product name, Figma sizes, stacked or inline layout, light or dark theme, and stacked edition label'],
        pendingProperties: ['Changes require Codex implementation, checks, and explicit approval before application'],
      };
    },
  };
}

export function createKeyHighlightsReviewService({ projectRoot = defaultRoot } = {}) {
  const root = path.resolve(projectRoot);
  const directory = 'src/design-review/key-highlights';
  return {
    async status() {
      const review = await readJson(root, `${directory}/proposal/review.json`, null);
      if (!review || review.source !== 'Figma MCP' || review.figmaFileKey !== 'IYSxfcgqwTKKNzohmB69uT' || review.figmaNodeId !== '313:34148') {
        throw new ReviewError('The KeyHighlights MCP review record is missing or invalid.');
      }
      const normalized = (value) => value.replaceAll('review-proposed-key-highlights', 'review-current-key-highlights')
        .replaceAll('ProposedKeyHighlights', 'CurrentKeyHighlights');
      const changed = [];
      for (const file of ['KeyHighlights.vue', 'KeyHighlights.types.ts', 'KeyHighlights.data.ts', 'KeyHighlights.css', 'building.svg', 'clock.svg', 'envelope.svg']) {
        const [current, proposed] = await Promise.all([
          readFile(root, `${directory}/reference/${file}`),
          readFile(root, `${directory}/proposal/${file}`),
        ]);
        if (normalized(proposed.toString()) !== current.toString()) changed.push(`${file} differs from the pilot baseline.`);
      }
      const differences = {
        supported: [...new Set([...(review.differences?.supported ?? []), ...changed])],
        pending: review.differences?.pending ?? [],
      };
      return {
        phase: differences.supported.length || differences.pending.length ? 'unprepared' : 'baseline',
        mode: 'manual', canApply: false, manualReady: false, staleCode: false, staleFigma: false,
        figmaError: null, differences, error: null, backupId: null, checkedAt: null,
        figmaCheckedAt: review.checkedAt ?? null,
        supportedProperties: ['Metrics layout, responsive breakpoints, light and dark themes, optional rows and copy, exclusive badges, count-up motion'],
        pendingProperties: ['Changes require Codex implementation, checks, and explicit approval before application'],
      };
    },
  };
}

export function reviewMiddleware(services = { 'cta-button': createReviewService(), 'product-logo': createProductLogoReviewService(), 'key-highlights': createKeyHighlightsReviewService() }) {
  return async (request, response, next) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/__pilot_review/')) return next();
    const route = pathname.match(/^\/__pilot_review\/([a-z0-9-]+)\/(status|scan|prepare|apply)$/);
    const address = request.socket.remoteAddress;
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) || (origin && origin !== `http://${host}`)) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      const service = route && Object.hasOwn(services, route[1]) ? services[route[1]] : null;
      if (!service) throw new ReviewError('Component is not registered for review.', 404);
      const action = route[2];
      let result;
      if (request.method === 'GET' && action === 'status') result = await service.status();
      else if (request.method === 'POST' && request.headers['x-pilot-review'] === '1' && (!request.headers['content-length'] || request.headers['content-length'] === '0') && !request.headers['transfer-encoding']) {
        if (action === 'scan' && service.scan) result = await service.scan();
        else if (action === 'prepare' && service.prepare) result = await service.prepare();
        else if (action === 'apply' && service.applyPreparedManual && (await service.status()).mode === 'manual') result = await service.applyPreparedManual();
        else if (action === 'apply' && service.apply) result = await service.apply();
      }
      if (!result) throw new ReviewError('Route or method not allowed.', 405);
      response.writeHead(200).end(JSON.stringify({ componentId: route[1], ...result }));
    } catch (error) {
      response.writeHead(error.status ?? 500).end(JSON.stringify({ error: error.message }));
    }
  };
}

export function reviewVitePlugin() {
  return {
    name: 'pilot-local-design-review',
    apply: 'serve',
    configureServer(server) { server.middlewares.use(reviewMiddleware()); },
  };
}
