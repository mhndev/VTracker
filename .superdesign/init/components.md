# Shared UI components

The project uses a small custom React component library rather than a third-party component system.

## `src/packages/ui/src/index.tsx`

Shared status, title, metric, empty-state, and surface primitives used by both applications.

```tsx
import type { ReactNode } from 'react';

export type StatusTone = 'green' | 'amber' | 'red' | 'gray';

const STATUS_TONES: Record<string, StatusTone> = {
  ONLINE: 'green', ACTIVE: 'green', OPERATIONAL: 'green', SUCCESS: 'green', ACKNOWLEDGED: 'green',
  OFFLINE: 'amber', OPEN: 'amber', HIGH: 'amber', MEDIUM: 'amber', FAIR: 'amber',
  QUARANTINED: 'red', DENIED: 'red', CRITICAL: 'red', FAILED: 'red',
  DISABLED: 'gray', UNKNOWN: 'gray', RESOLVED: 'gray', UNASSIGNED: 'gray'
};

export const statusTone = (value: string): StatusTone => STATUS_TONES[value] ?? 'gray';
export const humanizeStatus = (value: string): string => value.replaceAll('_', ' ');

export function StatusPill({ value, tone }: { value: string; tone?: StatusTone }) {
  return <span className={`pill ${tone ?? statusTone(value)}`}><i aria-hidden="true" />{humanizeStatus(value)}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

export function MetricCard({ icon, label, value, meta, color = 'violet' }: {
  icon: ReactNode; label: string; value: string | number; meta: string; color?: 'violet' | 'mint' | 'peach' | 'sky';
}) {
  return <article className="metric"><span className={`metric-icon ${color}`} aria-hidden="true">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{meta}</small></div></article>;
}

export function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="empty">{icon}<strong>{title}</strong><span>{copy}</span></div>;
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`.trim()}>{children}</section>;
}
```

Page-specific components are intentionally kept inside `PortalApp.tsx`, `LiveMap.tsx`, and `AdminApp.tsx`.
