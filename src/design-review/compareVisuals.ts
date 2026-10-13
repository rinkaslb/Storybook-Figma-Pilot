export const reviewViews = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'active', label: 'Active' },
  { id: 'focus', label: 'Focus visible' },
  { id: 'loading', label: 'Loading' },
  { id: 'success', label: 'Success' },
  { id: 'disabled', label: 'Disabled' },
] as const;

export type ReviewView = (typeof reviewViews)[number]['id'];

const visualProperties = [
  ['backgroundColor', 'background'],
  ['color', 'text color'],
  ['borderRadius', 'corner radius'],
  ['border', 'border'],
  ['fontFamily', 'font family'],
  ['fontSize', 'font size'],
  ['fontWeight', 'font weight'],
  ['lineHeight', 'line height'],
  ['letterSpacing', 'letter spacing'],
  ['opacity', 'opacity'],
  ['outlineColor', 'focus outline color'],
  ['outlineStyle', 'focus outline style'],
  ['outlineWidth', 'focus outline width'],
  ['padding', 'padding'],
  ['boxShadow', 'shadow'],
  ['cursor', 'cursor'],
] as const;

async function assetContent(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read ${url}`);
  return response.text();
}

export async function compareVisuals(actualRoot: HTMLElement, proposedRoot: HTMLElement) {
  const differences: string[] = [];

  for (const view of reviewViews) {
    const actual = actualRoot.querySelector<HTMLButtonElement>(`[data-review-view="${view.id}"] button`);
    const proposed = proposedRoot.querySelector<HTMLButtonElement>(`[data-review-view="${view.id}"] button`);
    if (!actual || !proposed) {
      differences.push(`${view.label}: one of the views is missing.`);
      continue;
    }

    const actualBox = actual.getBoundingClientRect();
    const proposedBox = proposed.getBoundingClientRect();
    if (actualBox.width !== proposedBox.width || actualBox.height !== proposedBox.height) {
      differences.push(`${view.label}: dimensions ${actualBox.width} × ${actualBox.height} px → ${proposedBox.width} × ${proposedBox.height} px.`);
    }

    const actualStyle = getComputedStyle(actual);
    const proposedStyle = getComputedStyle(proposed);
    for (const [property, label] of visualProperties) {
      if (actualStyle[property] !== proposedStyle[property]) {
        differences.push(`${view.label}: ${label} ${actualStyle[property]} → ${proposedStyle[property]}.`);
      }
    }

    if (actual.textContent !== proposed.textContent) {
      differences.push(`${view.label}: text “${actual.textContent}” → “${proposed.textContent}”.`);
    }

    const actualIcon = actual.querySelector('img');
    const proposedIcon = proposed.querySelector('img');
    if (Boolean(actualIcon) !== Boolean(proposedIcon)) {
      differences.push(`${view.label}: icon presence differs.`);
    } else if (actualIcon && proposedIcon) {
      const actualIconBox = actualIcon.getBoundingClientRect();
      const proposedIconBox = proposedIcon.getBoundingClientRect();
      if (actualIconBox.width !== proposedIconBox.width || actualIconBox.height !== proposedIconBox.height) {
        differences.push(`${view.label}: icon size differs.`);
      }
      const actualIconStyle = getComputedStyle(actualIcon);
      const proposedIconStyle = getComputedStyle(proposedIcon);
      for (const property of ['display', 'opacity', 'filter', 'transform', 'visibility'] as const) {
        if (actualIconStyle[property] !== proposedIconStyle[property]) {
          differences.push(`${view.label}: icon ${property} differs.`);
        }
      }
      const [actualSvg, proposedSvg] = await Promise.all([
        assetContent(actualIcon.currentSrc || actualIcon.src),
        assetContent(proposedIcon.currentSrc || proposedIcon.src),
      ]);
      if (actualSvg !== proposedSvg) {
        differences.push(`${view.label}: icon artwork differs.`);
      }
    }
  }

  return differences;
}
