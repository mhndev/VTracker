import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, AlertTriangle, Building2, ChevronRight, Clock, FileClock, LayoutDashboard,
  LockKeyhole, Radio, RefreshCw, Search, Server, ShieldCheck, Signal, Store, UsersRound
} from 'lucide-react';

type AdminView = 'overview' | 'organizations' | 'devices' | 'incidents' | 'audit';

type AdminData = {
  actor: { name: string; email: string };
  generatedAt: string;
  privacyBoundary: string;
  stats: {
    customers: number; resellers: number; devices: number;
    onlineDevices: number; openAlerts: number; quarantinedDevices: number;
  };
  organizations: Array<{
    id: string; name: string; resellerName: string; vehicles: number;
    devices: number; onlineDevices: number; openAlerts: number; serviceStatus: string;
  }>;
  devices: Array<{
    id: string; serial: string; model: string; radio: string; status: string;
    signalQuality: string; lastCommunicationAt: string; custodyOrganizationName: string;
  }>;
  systemChecks: Array<{ id: string; name: string; status: string; detail: string }>;
  recentAudit: Array<{
    id: string; action: string; outcome: string; occurredAt: string;
    actorName: string; resourceType: string;
  }>;
};

type View = {
  id: AdminView; label: string; icon: LucideIcon;
  overline: string; title: string; description: string; placeholder: string;
};

const VIEWS: readonly View[] = [
  { id: 'overview', label: 'Control center', icon: LayoutDashboard, overline: 'Platform operations', title: 'Control center', description: 'Organization health, device connectivity and security posture across every tenant.', placeholder: 'Filter organizations…' },
  { id: 'organizations', label: 'Organizations', icon: Building2, overline: 'Tenant directory', title: 'Organizations', description: 'Customer accounts served directly or through a reseller partner.', placeholder: 'Search organization or partner…' },
  { id: 'devices', label: 'Device network', icon: Radio, overline: 'Network inventory', title: 'Device network', description: 'Every tracker in custody, with communication and quarantine status.', placeholder: 'Search serial, model or custody…' },
  { id: 'incidents', label: 'Risk & incidents', icon: AlertTriangle, overline: 'Requires attention', title: 'Risk & incidents', description: 'Devices offline, quarantined or beyond their reporting window.', placeholder: 'Search incidents…' },
  { id: 'audit', label: 'Global audit', icon: FileClock, overline: 'Security evidence', title: 'Global audit', description: 'Recent platform audit events with actor, resource and outcome.', placeholder: 'Search action or actor…' }
];

const countFormat = new Intl.NumberFormat('en-US');
const formatCount = (value: number): string => countFormat.format(value);

const relativeTime = (value: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const utcTimestamp = (value: string): string => `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const utcClock = (): string => `${new Date().toISOString().slice(11, 16)} UTC`;

type Tone = 'positive' | 'warning' | 'critical' | 'neutral';

const TONES: Record<string, Tone> = {
  ONLINE: 'positive', ACTIVE: 'positive', OPERATIONAL: 'positive', SUCCESS: 'positive', ACKNOWLEDGED: 'positive',
  OFFLINE: 'warning', OPEN: 'warning', HIGH: 'warning', MEDIUM: 'warning', FAIR: 'warning',
  QUARANTINED: 'critical', DENIED: 'critical', CRITICAL: 'critical', FAILED: 'critical',
  DISABLED: 'neutral', UNKNOWN: 'neutral', RESOLVED: 'neutral'
};

const toneOf = (value: string): Tone => TONES[value] ?? 'neutral';
const humanize = (value: string): string =>
  value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, character => character.toUpperCase());

const matches = (query: string, ...values: Array<string | number>): boolean =>
  !query || values.some(value => String(value).toLowerCase().includes(query));

function StatusPill({ value, tone }: { value: string; tone?: Tone }) {
  return <span className={`pill ${tone ?? toneOf(value)}`}><i aria-hidden="true" />{humanize(value)}</span>;
}

function Metric({ icon: Icon, label, value, caption, tone }: {
  icon: LucideIcon; label: string; value: string; caption: string; tone: Tone;
}) {
  return (
    <article className="kpi">
      <span className={`kpi-icon ${tone}`} aria-hidden="true"><Icon /></span>
      <div className="kpi-body">
        <p className="kpi-label">{label}</p>
        <strong className="kpi-value">{value}</strong>
        <span className="kpi-caption">{caption}</span>
      </div>
    </article>
  );
}

function Panel({ overline, title, meta, children, flush }: {
  overline: string; title: string; meta?: ReactNode; children: ReactNode; flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <p className="overline">{overline}</p>
          <h2>{title}</h2>
        </div>
        {meta ? <div className="panel-actions">{meta}</div> : null}
      </header>
      <div className={flush ? 'panel-body is-flush' : 'panel-body'}>{children}</div>
    </section>
  );
}

function ResultCount({ shown, total }: { shown: number; total: number }) {
  return <span className="result-count">{shown === total ? `${formatCount(total)} records` : `${formatCount(shown)} of ${formatCount(total)}`}</span>;
}

function NoResults({ message }: { message: string }) {
  return (
    <div className="no-results">
      <Search aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
function OrganizationTable({ organizations }: { organizations: AdminData['organizations'] }) {
  if (!organizations.length) return <NoResults message="No organization matches the current filter." />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Organization</th>
            <th scope="col">Partner</th>
            <th scope="col" className="col-num">Fleet</th>
            <th scope="col" className="col-num">Devices online</th>
            <th scope="col" className="col-num">Open alerts</th>
            <th scope="col">Service</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map(organization => {
            const share = organization.devices ? Math.round((organization.onlineDevices / organization.devices) * 100) : 0;
            return (
              <tr key={organization.id}>
                <td>
                  <span className="entity">
                    <span className="entity-mark" aria-hidden="true">{organization.name.charAt(0)}</span>
                    <span className="entity-text">
                      <strong>{organization.name}</strong>
                      <small>{organization.id}</small>
                    </span>
                  </span>
                </td>
                <td className="cell-muted">{organization.resellerName}</td>
                <td className="col-num">{formatCount(organization.vehicles)}</td>
                <td className="col-num">
                  <span className="ratio">
                    <span className="ratio-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
                    <span className="ratio-text">{organization.onlineDevices}/{organization.devices}</span>
                  </span>
                </td>
                <td className="col-num">
                  {organization.openAlerts ? <span className="cell-strong">{organization.openAlerts}</span> : <span className="cell-muted">—</span>}
                </td>
                <td><StatusPill value={organization.serviceStatus} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function DeviceTable({ devices, emptyMessage = 'No device matches the current filter.' }: {
  devices: AdminData['devices']; emptyMessage?: string;
}) {
  if (!devices.length) return <NoResults message={emptyMessage} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Device</th>
            <th scope="col">Custody</th>
            <th scope="col">Model</th>
            <th scope="col">Radio</th>
            <th scope="col">Signal</th>
            <th scope="col">Last communication</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.id}>
              <td>
                <span className="entity">
                  <span className="entity-mark square" aria-hidden="true"><Radio /></span>
                  <span className="entity-text">
                    <strong>{device.serial}</strong>
                    <small>{device.id}</small>
                  </span>
                </span>
              </td>
              <td className="cell-muted">{device.custodyOrganizationName}</td>
              <td className="cell-muted">{device.model}</td>
              <td className="cell-muted">{device.radio}</td>
              <td><StatusPill value={device.signalQuality} /></td>
              <td className="cell-muted" title={utcTimestamp(device.lastCommunicationAt)}>{relativeTime(device.lastCommunicationAt)}</td>
              <td><StatusPill value={device.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AuditTable({ events, emptyMessage }: { events: AdminData['recentAudit']; emptyMessage: string }) {
  if (!events.length) return <NoResults message={emptyMessage} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Actor</th>
            <th scope="col">Resource</th>
            <th scope="col">Outcome</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event.id}>
              <td>
                <span className="entity">
                  <span className={`entity-mark square${event.outcome === 'DENIED' ? ' is-critical' : ''}`} aria-hidden="true"><ShieldCheck /></span>
                  <span className="entity-text">
                    <strong>{humanize(event.action)}</strong>
                    <small>{event.id}</small>
                  </span>
                </span>
              </td>
              <td className="cell-muted">{event.actorName}</td>
              <td className="cell-muted">{humanize(event.resourceType)}</td>
              <td><StatusPill value={event.outcome} /></td>
              <td className="cell-muted" title={utcTimestamp(event.occurredAt)}>{relativeTime(event.occurredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SystemStatus({ checks }: { checks: AdminData['systemChecks'] }) {
  return (
    <ul className="status-list">
      {checks.map(check => (
        <li key={check.id}>
          <span className="status-icon" aria-hidden="true"><Server /></span>
          <span className="status-text">
            <strong>{check.name}</strong>
            <small>{check.detail}</small>
          </span>
          <StatusPill value={check.status} />
        </li>
      ))}
    </ul>
  );
}
function Connectivity({ data }: { data: AdminData }) {
  const { devices, onlineDevices, quarantinedDevices } = data.stats;
  const offlineDevices = Math.max(0, devices - onlineDevices - quarantinedDevices);
  const percent = (value: number) => (devices ? `${(value / devices) * 100}%` : '0%');
  const onlineRate = devices ? Math.round((onlineDevices / devices) * 100) : 0;
  return (
    <div className="connectivity">
      <p className="connectivity-summary">
        <strong>{onlineRate}%</strong>
        <span>of {formatCount(devices)} devices reported within the last 10 minutes</span>
      </p>
      <div className="dist-bar" role="img" aria-label={`${onlineDevices} online, ${offlineDevices} offline, ${quarantinedDevices} quarantined`}>
        <span className="dist-segment is-online" style={{ width: percent(onlineDevices) }} />
        <span className="dist-segment is-offline" style={{ width: percent(offlineDevices) }} />
        <span className="dist-segment is-quarantine" style={{ width: percent(quarantinedDevices) }} />
      </div>
      <ul className="legend">
        <li><span className="dot is-online" aria-hidden="true" />Online<strong>{formatCount(onlineDevices)}</strong></li>
        <li><span className="dot is-offline" aria-hidden="true" />Offline<strong>{formatCount(offlineDevices)}</strong></li>
        <li><span className="dot is-quarantine" aria-hidden="true" />Quarantined<strong>{formatCount(quarantinedDevices)}</strong></li>
      </ul>
    </div>
  );
}

function Overview({ data, organizations, audit, query }: {
  data: AdminData; organizations: AdminData['organizations']; audit: AdminData['recentAudit']; query: string;
}) {
  const onlineRate = data.stats.devices ? Math.round((data.stats.onlineDevices / data.stats.devices) * 100) : 0;
  const availabilityTone: Tone = onlineRate >= 80 ? 'positive' : onlineRate >= 50 ? 'warning' : 'critical';
  return (
    <>
      <section className="kpi-grid">
        <Metric icon={Building2} tone="neutral" label="Customer organizations" value={formatCount(data.stats.customers)} caption={`${formatCount(data.stats.resellers)} reseller partners`} />
        <Metric icon={Radio} tone="neutral" label="Managed devices" value={formatCount(data.stats.devices)} caption={`${formatCount(data.stats.onlineDevices)} reporting now`} />
        <Metric icon={Signal} tone={availabilityTone} label="Network availability" value={`${onlineRate}%`} caption="Devices seen within 10 minutes" />
        <Metric icon={AlertTriangle} tone={data.stats.openAlerts ? 'warning' : 'positive'} label="Open incidents" value={formatCount(data.stats.openAlerts)} caption={`${formatCount(data.stats.quarantinedDevices)} devices quarantined`} />
      </section>
      <section className="layout-2">
        <Panel overline="Tenant operations" title="Organization health" meta={<ResultCount shown={organizations.length} total={data.organizations.length} />} flush>
          <OrganizationTable organizations={organizations} />
        </Panel>
        <Panel overline="Infrastructure" title="System status">
          <SystemStatus checks={data.systemChecks} />
        </Panel>
      </section>
      <section className="layout-2">
        <Panel overline="Connectivity" title="Device network" meta={<span className="meta-note">Updated {relativeTime(data.generatedAt)}</span>}>
          <Connectivity data={data} />
        </Panel>
        <Panel overline="Security evidence" title="Audit pulse" meta={<ResultCount shown={audit.length} total={data.recentAudit.length} />} flush>
          <AuditTable events={audit.slice(0, 6)} emptyMessage="No audit event matches the current filter." />
        </Panel>
      </section>
      {query ? <p className="filter-note">Filtered by “{query}”.</p> : null}
    </>
  );
}
async function fetchAdmin(): Promise<AdminData> {
  const response = await fetch('/api/admin/overview', { headers: { 'x-demo-actor': 'user-platform-support' } });
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? 'The platform admin API is unavailable.');
  return payload as unknown as AdminData;
}

const initialsOf = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');

export default function AdminApp() {
  const [data, setData] = useState<AdminData | null>(null);
  const [view, setView] = useState<AdminView>('overview');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing' | 'error'>('loading');
  const [clock, setClock] = useState(utcClock);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    setStatus(mode === 'refresh' ? 'refreshing' : 'loading');
    try {
      const next = await fetchAdmin();
      setData(next);
      setError('');
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The platform admin API is unavailable.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load('initial'); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(utcClock()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = VIEWS.find(item => item.id === view) ?? VIEWS[0];
  const trimmed = query.trim().toLowerCase();

  const organizations = useMemo(
    () => (data?.organizations ?? []).filter(organization =>
      matches(trimmed, organization.name, organization.resellerName, organization.id, organization.serviceStatus)),
    [data, trimmed]
  );
  const devices = useMemo(
    () => (data?.devices ?? []).filter(device =>
      matches(trimmed, device.serial, device.model, device.radio, device.custodyOrganizationName, device.status, device.signalQuality)),
    [data, trimmed]
  );
  const incidents = useMemo(
    () => devices.filter(device => ['OFFLINE', 'QUARANTINED'].includes(device.status)),
    [devices]
  );
  const audit = useMemo(
    () => (data?.recentAudit ?? []).filter(event =>
      matches(trimmed, event.action, event.actorName, event.resourceType, event.outcome)),
    [data, trimmed]
  );

  const selectView = (next: AdminView) => { setView(next); setQuery(''); };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck /></span>
          <span className="brand-text">
            <strong>Sentinel</strong>
            <small>Platform administration</small>
          </span>
        </div>
        <p className="env-chip"><i aria-hidden="true" />Production simulation</p>
        <nav className="nav" aria-label="Admin console sections">
          {VIEWS.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === view ? 'nav-item is-active' : 'nav-item'}
              aria-current={item.id === view ? 'page' : undefined}
              onClick={() => selectView(item.id)}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
              {item.id === 'incidents' && data?.stats.openAlerts ? <b className="nav-count">{data.stats.openAlerts}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card">
            <span className="user-avatar" aria-hidden="true">{data?.actor?.name ? initialsOf(data.actor.name) : '—'}</span>
            <span className="user-text">
              <strong>{data?.actor?.name ?? 'Platform support'}</strong>
              <small>{data?.actor?.email ?? 'session pending'}</small>
            </span>
          </div>
          <p className="plane-note"><LockKeyhole aria-hidden="true" />Isolated admin plane</p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <span>Sentinel</span>
            <ChevronRight aria-hidden="true" />
            <span>Operations</span>
            <ChevronRight aria-hidden="true" />
            <strong>{active.label}</strong>
          </nav>
          <div className="toolbar">
            <label className="search-field">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={active.placeholder}
                aria-label={active.placeholder}
              />
            </label>
            <button
              type="button"
              className={status === 'refreshing' ? 'icon-button is-busy' : 'icon-button'}
              onClick={() => void load('refresh')}
              disabled={status === 'refreshing'}
              title="Refresh platform data"
              aria-label="Refresh platform data"
            >
              <RefreshCw aria-hidden="true" />
            </button>
            <span className="clock"><Clock aria-hidden="true" />{clock}</span>
          </div>
        </header>

        <main className="content">
          <section className="page-head">
            <div className="page-head-main">
              <p className="overline">{active.overline}</p>
              <h1>{active.title}</h1>
              <p className="page-copy">{active.description}</p>
            </div>
            <div className="page-head-side">
              {data ? <span className="boundary-chip"><LockKeyhole aria-hidden="true" />Coordinates excluded</span> : null}
              <span className="meta-note">Generated {data ? utcTimestamp(data.generatedAt) : '—'}</span>
            </div>
          </section>

          {error ? (
            <div className="banner" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => void load('refresh')}>Retry</button>
            </div>
          ) : null}

          {!data ? (
            <div className="state-block" aria-live="polite">
              {status === 'error' ? <AlertTriangle aria-hidden="true" /> : <Activity className="spin" aria-hidden="true" />}
              <span>{status === 'error' ? 'Platform data unavailable.' : 'Loading platform operations…'}</span>
            </div>
          ) : (
            <>
              {view === 'overview' && <Overview data={data} organizations={organizations} audit={audit} query={query.trim()} />}

              {view === 'organizations' && (
                <Panel overline="Tenant directory" title="Customer organizations" meta={<ResultCount shown={organizations.length} total={data.organizations.length} />} flush>
                  <OrganizationTable organizations={organizations} />
                </Panel>
              )}

              {view === 'devices' && (
                <Panel overline="Network inventory" title="All managed devices" meta={<ResultCount shown={devices.length} total={data.devices.length} />} flush>
                  <DeviceTable devices={devices} />
                </Panel>
              )}

              {view === 'incidents' && (
                <section className="layout-split">
                  <Panel overline="Requires attention" title="Device incidents" meta={<ResultCount shown={incidents.length} total={data.devices.length} />} flush>
                    <DeviceTable devices={incidents} emptyMessage="No incident matches the current filter." />
                  </Panel>
                  <aside className="panel guardrail">
                    <span className="guardrail-icon" aria-hidden="true"><LockKeyhole /></span>
                    <h2>Operational metadata only</h2>
                    <p>Platform support can inspect connectivity, inventory and quarantine state. Customer coordinates, trips and addresses never appear in this interface.</p>
                    <p className="guardrail-note"><ShieldCheck aria-hidden="true" />Break-glass location access is not implemented.</p>
                  </aside>
                </section>
              )}

              {view === 'audit' && (
                <Panel overline="Security evidence" title="Recent platform audit events" meta={<ResultCount shown={audit.length} total={data.recentAudit.length} />} flush>
                  <AuditTable events={audit} emptyMessage="No audit event matches the current filter." />
                </Panel>
              )}
            </>
          )}

          <footer className="footer">
            <span>Sentinel Fleet — platform administration</span>
            <span className="footer-boundary">{data?.privacyBoundary ?? 'Aggregate operational metadata only.'}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}






