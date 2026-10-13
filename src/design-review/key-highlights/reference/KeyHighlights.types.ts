export type KeyHighlightBadge =
  | { type: 'none' }
  | { type: 'number'; label: string }
  | { type: 'icon'; icon: 'building' | 'clock' | 'envelope' };
export type KeyHighlightItem = {
  id: string;
  value: number;
  suffix?: string;
  heading: string;
  supportingHeading?: string;
  description?: string;
  badge?: KeyHighlightBadge;
};
