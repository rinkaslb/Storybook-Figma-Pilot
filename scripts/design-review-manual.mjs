import { createReviewService } from './design-review-service.mjs';

const [action, componentOption, componentId, radiusOption, rawRadius, approval, extra] = process.argv.slice(2);
const radius = Number(rawRadius);
const valid = (action === 'prepare' || action === 'apply')
  && componentOption === '--component'
  && componentId === 'cta-button'
  && radiusOption === '--verified-radius'
  && rawRadius !== undefined
  && Number.isFinite(radius)
  && radius >= 0
  && radius <= 100
  && !extra
  && (action === 'prepare' ? approval === undefined : approval === '--approved');

if (!valid) {
  process.stderr.write('Usage: node scripts/design-review-manual.mjs prepare --component cta-button --verified-radius <px>\n');
  process.stderr.write('   or: node scripts/design-review-manual.mjs apply --component cta-button --verified-radius <px> --approved\n');
  process.exitCode = 2;
} else {
  try {
    const service = createReviewService();
    const result = action === 'prepare'
      ? await service.prepareManual(radius)
      : await service.applyManual(radius);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
