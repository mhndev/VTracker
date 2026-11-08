import type { ChangeEvent, ReactNode } from 'react';
import { useI18n } from './i18n';

export function DashboardSidebar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <aside className={`portal-nav ${className}`.trim()}>{children}</aside>;
}

export function DashboardTopbar({ children }: { children: ReactNode }) {
  return <header>{children}</header>;
}

export function DashboardSearch({ icon, value, placeholder, onChange, className = '' }: {
  icon: ReactNode;
  value?: string;
  placeholder: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const input = <input type="search" value={value} onChange={onChange ? (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value) : undefined} placeholder={placeholder} aria-label={placeholder} />;
  return onChange
    ? <label className={`search ${className}`.trim()}>{icon}{input}</label>
    : <div className={`search ${className}`.trim()}>{icon}{input}</div>;
}

export type WorkspaceRailMode = { id: string; label: string };

export function WorkspaceRail({ label, modes, activeModeId, completedModeIds = [] }: {
  label: string;
  modes: WorkspaceRailMode[];
  activeModeId: string;
  completedModeIds?: string[];
}) {
  const { formatDate } = useI18n();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset - 3);
    return { day: formatDate(date, { weekday: 'short' }), date: formatDate(date, { day: '2-digit' }), key: date.toISOString(), active: offset === 3 };
  });
  return <div className="workspace-rail" aria-label={label}>
    <span className="rail-back" aria-hidden="true">←</span>
    <div className="rail-days">
      {days.map(day => <span className={day.active ? 'rail-day active' : 'rail-day'} key={day.key}><small>{day.day}</small><b>{day.date}</b></span>)}
    </div>
    <div className="rail-modes">
      {modes.map(mode => <span className={mode.id === activeModeId ? 'active' : ''} key={mode.id}>{mode.label}{completedModeIds.includes(mode.id) ? ' ✓' : ''}</span>)}
    </div>
  </div>;
}
