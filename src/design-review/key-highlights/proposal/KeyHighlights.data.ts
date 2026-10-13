import type { KeyHighlightItem } from './KeyHighlights.types';

export const defaultKeyHighlights: readonly KeyHighlightItem[] = [
  { id: 'workloads', value: 30, suffix: '+', heading: 'Workloads supported', supportingHeading: 'Workload coverage', description: 'Protect physical, virtual, cloud and SaaS workloads.' },
  { id: 'storage', value: 50, suffix: '+', heading: 'Storage destinations', supportingHeading: 'Flexible storage', description: 'Store data across cloud, local and hybrid environments.' },
  { id: 'recovery', value: 99, suffix: '%', heading: 'Recovery confidence', supportingHeading: 'Validated recovery', description: 'Validate backup integrity before restoring workloads.' },
];
