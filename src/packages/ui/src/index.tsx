import '@fontsource-variable/vazirmatn';
import type { ReactNode } from 'react';
import { isMessageKey, useI18n } from './i18n';

export type StatusTone = 'green' | 'amber' | 'red' | 'gray';

const STATUS_TONES: Record<string, StatusTone> = {
  ONLINE: 'green', ACTIVE: 'green', OPERATIONAL: 'green', SUCCESS: 'green', ACKNOWLEDGED: 'green',
  OFFLINE: 'amber', OPEN: 'amber', HIGH: 'amber', MEDIUM: 'amber', FAIR: 'amber', SUSPENDED: 'amber',
  QUARANTINED: 'red', DENIED: 'red', CRITICAL: 'red', FAILED: 'red',
  DISABLED: 'gray', UNKNOWN: 'gray', RESOLVED: 'gray', UNASSIGNED: 'gray'
};

export const statusTone = (value: string): StatusTone => STATUS_TONES[value] ?? 'gray';
export const humanizeStatus = (value: string): string => value.replaceAll('_', ' ');

export function LtrText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <bdi dir="ltr" className={`ltr-data ${className}`.trim()}>{children}</bdi>;
}

export function StatusPill({ value, tone }: { value: string; tone?: StatusTone }) {
  const { t } = useI18n();
  const key = `status.${value}`;
  const label = isMessageKey(key) ? t(key) : humanizeStatus(value);
  return <span className={`pill ${tone ?? statusTone(value)}`}><i aria-hidden="true" />{label}</span>;
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

export function Toast({ title, message, icon, actionLabel, onAction, onDismiss, tone = 'success', dismissLabel }: {
  title: string; message: string; icon?: ReactNode; actionLabel?: string; onAction?: () => void; onDismiss: () => void; tone?: 'success' | 'neutral'; dismissLabel?: string;
}) {
  const { t } = useI18n();
  return <aside className={`app-toast ${tone}`} role="status" aria-live="polite" aria-atomic="true">
    {icon && <span className="app-toast-icon" aria-hidden="true">{icon}</span>}
    <div className="app-toast-copy"><strong>{title}</strong><span>{message}</span></div>
    {actionLabel && onAction && <button className="app-toast-action" type="button" onClick={onAction}>{actionLabel}</button>}
    <button className="app-toast-dismiss" type="button" onClick={onDismiss} aria-label={dismissLabel ?? t('common.dismiss')}><span aria-hidden="true">×</span></button>
  </aside>;
}

export {
  ACTIVE_LOCALES,
  AppI18nProvider,
  assertCatalogCoverage,
  DEFAULT_LOCALE,
  I18nProvider,
  LOCALE_META,
  createI18n,
  en,
  fa,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  interpolate,
  isMessageKey,
  resolveLocale,
  translate,
  useI18n
} from './i18n';
export type { ActiveLocale, I18nApi, MessageKey, MessageParams, Messages, SupportedLocale } from './i18n';
export { DashboardSearch, DashboardSidebar, DashboardTopbar, WorkspaceRail } from './dashboard';
export type { WorkspaceRailMode } from './dashboard';
