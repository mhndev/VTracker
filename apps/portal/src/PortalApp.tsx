import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Bell, CarFront, ChevronDown, CircleHelp, Eye, Gauge, KeyRound,
  LayoutDashboard, LockKeyhole, Map, Menu, Radio, RefreshCw, Route, Search, ShieldCheck,
  Signal, UserRound, UsersRound, X
} from 'lucide-react';
import LiveMap from './LiveMap';
import type { AlertItem, Dashboard, Grant, PortalView, Session, Vehicle } from './types';

const CUSTOMER = 'user-customer-admin';
const RESELLER = 'user-reseller-support';
const CUSTOMER_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Live map', icon: Map },
  { id: 'vehicles', label: 'Vehicles', icon: CarFront },
  { id: 'devices', label: 'Devices', icon: Radio },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'privacy', label: 'Privacy & access', icon: KeyRound }
] as const;
const RESELLER_NAV = [
  { id: 'overview', label: 'Service desk', icon: LayoutDashboard },
  { id: 'map', label: 'Granted map', icon: Map },
  { id: 'vehicles', label: 'Customer fleet', icon: CarFront },
  { id: 'devices', label: 'Device health', icon: Radio },
  { id: 'alerts', label: 'Support alerts', icon: Bell }
] as const;

async function request<T>(path: string, actorId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', 'x-demo-actor': actorId, ...(init?.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'Request failed.');
  return payload as T;
}
const ago = (value?: string) => {
  if (!value) return 'Never';
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return 'Just now';
  if (Math.abs(minutes) < 60) return `${Math.abs(minutes)}m ago`;
  return `${Math.round(Math.abs(minutes) / 60)}h ago`;
};
const tone = (value?: string) => value === 'ONLINE' || value === 'ACKNOWLEDGED' ? 'green' : value === 'CRITICAL' || value === 'QUARANTINED' ? 'red' : value === 'OFFLINE' || value === 'HIGH' || value === 'OPEN' ? 'amber' : 'gray';

function Pill({ value }: { value: string }) { return <span className={`pill ${tone(value)}`}><i />{value.replaceAll('_', ' ')}</span>; }
function Metric({ icon: Icon, label, value, meta, color }: { icon: typeof Activity; label: string; value: string | number; meta: string; color: string }) {
  return <article className="metric"><span className={`metric-icon ${color}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{meta}</small></div></article>;
}
function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function Empty({ icon: Icon, title, copy }: { icon: typeof Activity; title: string; copy: string }) { return <div className="empty"><Icon /><strong>{title}</strong><span>{copy}</span></div>; }

function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  return <div className="vehicle-list">{vehicles.map(vehicle => <article className="vehicle-line" key={vehicle.id}>
    <div className="vehicle-photo"><CarFront /></div>
    <div className="vehicle-name"><strong>{vehicle.name}</strong><span>{vehicle.plate} · {vehicle.kind.toLowerCase()}</span></div>
    <Pill value={vehicle.device?.status || 'UNASSIGNED'} />
    <div className="vehicle-reading"><span>Speed</span><strong>{vehicle.location ? `${vehicle.location.speedKph} km/h` : 'Private'}</strong></div>
    <div className="vehicle-reading"><span>Battery</span><strong>{vehicle.device ? `${vehicle.device.batteryPercent}%` : '—'}</strong></div>
    <div className="vehicle-reading"><span>Last report</span><strong>{ago(vehicle.device?.lastCommunicationAt)}</strong></div>
  </article>)}</div>;
}

function AlertList({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts.length) return <Empty icon={ShieldCheck} title="All clear" copy="No alerts in this organization." />;
  return <div className="alert-stack">{alerts.map(alert => <article className="alert-line" key={alert.id}>
    <span className={`alert-symbol ${tone(alert.severity)}`}><AlertCircle /></span>
    <div><strong>{alert.summary}</strong><p>{alert.vehicleName} · {ago(alert.occurredAt)}</p></div>
    <Pill value={alert.severity} />
  </article>)}</div>;
}

function Overview({ data, isCustomer }: { data: Dashboard; isCustomer: boolean }) {
  const featured = data.vehicles.find(vehicle => vehicle.location) || data.vehicles[0];
  return <>
    <div className="welcome"><div><span>{isCustomer ? 'YOUR FLEET AT A GLANCE' : 'CUSTOMER SUPPORT WORKSPACE'}</span><h1>{isCustomer ? 'Good morning, Maya.' : 'Good morning, Noah.'}</h1><p>{isCustomer ? 'Your vehicles are monitored and your data stays under your control.' : 'Operational health is available. Locations remain customer-controlled.'}</p></div><div className="live-chip"><i />Live updates</div></div>
    <section className="metrics">
      <Metric icon={CarFront} label="Total vehicles" value={data.stats.vehicles} meta="in active scope" color="violet" />
      <Metric icon={Signal} label="Online now" value={data.stats.online} meta={`${data.stats.vehicles - data.stats.online} need attention`} color="mint" />
      <Metric icon={Bell} label="Open alerts" value={data.stats.activeAlerts} meta="requires review" color="peach" />
      <Metric icon={Eye} label="Visible locations" value={data.stats.locationVisible} meta={`of ${data.stats.vehicles} vehicles`} color="sky" />
    </section>
    <section className="overview-grid">
      <article className="surface map-surface"><SectionTitle eyebrow="LIVE POSITION" title="Where your fleet is now" action={<span className="soft-label"><i />Updated now</span>} /><LiveMap vehicles={data.vehicles} /></article>
      <article className="surface focus-card"><SectionTitle eyebrow="QUICK LOOK" title={featured?.name || 'Fleet status'} action={featured?.device && <Pill value={featured.device.status} />} />
        {featured && <div className="focus-body"><div className="speed-orb"><Gauge /><strong>{featured.location?.speedKph ?? '—'}</strong><span>km/h</span></div><div className="focus-details"><div><span>Registration</span><strong>{featured.plate}</strong></div><div><span>Last update</span><strong>{ago(featured.device?.lastCommunicationAt)}</strong></div><div><span>Location</span><strong>{featured.location ? `${featured.location.latitude.toFixed(4)}, ${featured.location.longitude.toFixed(4)}` : 'Protected'}</strong></div></div></div>}
        <div className="safety-note"><LockKeyhole /><div><strong>Vehicle control is unavailable</strong><p>High-risk remote commands are intentionally excluded from this MVP.</p></div></div>
      </article>
    </section>
    <section className="surface"><SectionTitle eyebrow="FLEET STATUS" title="Vehicles" /><VehicleList vehicles={data.vehicles} /></section>
    <section className="surface"><SectionTitle eyebrow="RECENT ACTIVITY" title="Alerts that need attention" action={<span className="count-badge">{data.stats.activeAlerts} open</span>} /><AlertList alerts={data.alerts.slice(0, 3)} /></section>
  </>;
}

function Privacy({ data, grants, busy, createGrant, revoke }: { data: Dashboard; grants: Grant[]; busy: boolean; createGrant: (vehicle: string, purpose: string, hours: number) => Promise<void>; revoke: (id: string) => Promise<void> }) {
  const [vehicle, setVehicle] = useState(data.vehicles[0]?.id || '');
  const [purpose, setPurpose] = useState('Investigate a customer-reported device issue');
  const [hours, setHours] = useState(2);
  return <div className="privacy-grid"><section className="surface"><SectionTitle eyebrow="ACTIVE & PAST GRANTS" title="Who can see location" />
    <div className="grant-list">{grants.map(grant => <article className={grant.revokedAt ? 'grant muted-grant' : 'grant'} key={grant.id}><span className="grant-icon"><Eye /></span><div><strong>{grant.vehicleName}</strong><p>{grant.granteeOrganizationName}</p><small>{grant.purpose}</small></div><div className="grant-expiry"><span>{grant.revokedAt ? 'Revoked' : 'Expires'}</span><strong>{grant.revokedAt ? ago(grant.revokedAt) : new Date(grant.expiresAt).toLocaleString()}</strong></div>{!grant.revokedAt && <button className="text-danger" onClick={() => revoke(grant.id)}>Revoke</button>}</article>)}</div>
  </section><aside className="surface grant-builder"><span className="round-icon"><KeyRound /></span><h2>Grant temporary access</h2><p>Share one vehicle’s current location with your service partner. The grant expires automatically.</p><label>Vehicle<select value={vehicle} onChange={e => setVehicle(e.target.value)}>{data.vehicles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Duration<select value={hours} onChange={e => setHours(Number(e.target.value))}><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24">24 hours</option></select></label><label>Support purpose<textarea value={purpose} onChange={e => setPurpose(e.target.value)} /></label><button className="primary" disabled={busy} onClick={() => createGrant(vehicle, purpose, hours)}>Create secure grant</button></aside></div>;
}

export default function PortalApp() {
  const [actorId, setActorId] = useState(CUSTOMER);
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [view, setView] = useState<PortalView>('overview');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [menu, setMenu] = useState(false);
  const isCustomer = actorId === CUSTOMER;
  const nav = isCustomer ? CUSTOMER_NAV : RESELLER_NAV;

  const loadData = async (actor = actorId, org = organizationId) => {
    if (!org) return;
    const next = await request<Dashboard>(`/api/dashboard?organizationId=${org}`, actor);
    setData(next);
  };
  useEffect(() => { request<Session>('/api/session', actorId).then(next => { setSession(next); setOrganizationId(next.scopes[0]?.id || ''); }).catch(error => setMessage(error.message)); }, [actorId]);
  useEffect(() => { if (organizationId) loadData().catch(error => setMessage(error.message)); }, [organizationId, actorId]);
  useEffect(() => { if (isCustomer && organizationId) request<Grant[]>(`/api/grants?organizationId=${organizationId}`, actorId).then(setGrants).catch(() => setGrants([])); else setGrants([]); }, [isCustomer, organizationId, actorId]);
  useEffect(() => { if (!nav.some(item => item.id === view)) setView('overview'); }, [actorId]);

  const simulate = async () => { setBusy(true); try { const result = await request<{ accepted: number }>('/api/telemetry/simulate', actorId, { method: 'POST', body: JSON.stringify({ organizationId }) }); await loadData(); setMessage(`${result.accepted} live positions updated.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Update failed.'); } finally { setBusy(false); } };
  const createGrant = async (vehicleId: string, purpose: string, durationHours: number) => { setBusy(true); try { await request('/api/grants', actorId, { method: 'POST', body: JSON.stringify({ organizationId, vehicleId, purpose, durationHours }) }); setGrants(await request(`/api/grants?organizationId=${organizationId}`, actorId)); setMessage('Temporary location access granted.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Grant failed.'); } finally { setBusy(false); } };
  const revoke = async (id: string) => { await request(`/api/grants/${id}`, actorId, { method: 'DELETE' }); setGrants(await request(`/api/grants?organizationId=${organizationId}`, actorId)); setMessage('Access revoked.'); };

  const title = nav.find(item => item.id === view)?.label || 'Overview';
  return <div className="portal-shell">
    <aside className={menu ? 'portal-nav open' : 'portal-nav'}>
      <div className="logo"><span><Route /></span><div><strong>Sentinel</strong><small>{isCustomer ? 'Fleet portal' : 'Partner portal'}</small></div><button className="nav-close" onClick={() => setMenu(false)}><X /></button></div>
      <div className="org-select"><small>{isCustomer ? 'MY ORGANIZATION' : 'CUSTOMER ACCOUNT'}</small><select value={organizationId} onChange={e => setOrganizationId(e.target.value)}>{session?.scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select></div>
      <nav>{nav.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setMenu(false); }}><item.icon />{item.label}{item.id === 'alerts' && data?.stats.activeAlerts ? <b>{data.stats.activeAlerts}</b> : null}</button>)}</nav>
      <div className="nav-bottom"><div className="privacy-status"><ShieldCheck /><div><strong>{isCustomer ? 'Privacy controls active' : 'Scoped support access'}</strong><small>{isCustomer ? 'You control location sharing' : 'Customer grants are enforced'}</small></div></div><button><CircleHelp />Help & support</button></div>
    </aside>
    <main className="portal-main">
      <header><button className="menu-trigger" onClick={() => setMenu(true)}><Menu /></button><div><span>{data?.organization.name || 'Fleet portal'}</span><h2>{title}</h2></div><div className="header-tools"><div className="search"><Search /><input placeholder="Search vehicles" /></div>{isCustomer && <button className="outline" onClick={simulate} disabled={busy}><RefreshCw className={busy ? 'spin' : ''} />Refresh positions</button>}<div className="role-switch"><span className={isCustomer ? 'avatar customer' : 'avatar reseller'}>{isCustomer ? 'MC' : 'NF'}</span><div><strong>{isCustomer ? 'Maya Chen' : 'Noah Fischer'}</strong><small>{isCustomer ? 'Customer admin' : 'Reseller support'}</small></div><select value={actorId} onChange={e => setActorId(e.target.value)} aria-label="Switch portal role"><option value={CUSTOMER}>Customer</option><option value={RESELLER}>Reseller</option></select><ChevronDown /></div></div></header>
      <div className="portal-content">{message && <div className="notice"><ShieldCheck />{message}<button onClick={() => setMessage('')}><X /></button></div>}{!data ? <div className="loading"><Activity className="spin" />Loading secure workspace…</div> : <>
        {view === 'overview' && <Overview data={data} isCustomer={isCustomer} />}
        {view === 'map' && <section className="surface map-page"><SectionTitle eyebrow={isCustomer ? 'REAL-TIME TRACKING' : 'CUSTOMER-GRANTED LOCATIONS'} title={isCustomer ? 'Live fleet map' : 'Granted location map'} action={<span className="map-note">Map data © OpenStreetMap contributors</span>} /><LiveMap vehicles={data.vehicles} tall /><VehicleList vehicles={data.vehicles} /></section>}
        {view === 'vehicles' && <section className="surface"><SectionTitle eyebrow="FLEET DIRECTORY" title={isCustomer ? 'Your vehicles' : 'Customer vehicles'} /><VehicleList vehicles={data.vehicles} /></section>}
        {view === 'devices' && <section className="cards-grid">{data.vehicles.map(vehicle => <article className="device-tile" key={vehicle.id}><div><span className="round-icon"><Radio /></span><Pill value={vehicle.device?.status || 'UNASSIGNED'} /></div><h3>{vehicle.device?.serial || 'No tracker'}</h3><p>{vehicle.device?.model || 'No device assigned'}</p><dl><div><dt>Vehicle</dt><dd>{vehicle.name}</dd></div><div><dt>Network</dt><dd>{vehicle.device?.radio || '—'}</dd></div><div><dt>Signal</dt><dd>{vehicle.device?.signalQuality || '—'}</dd></div><div><dt>Last seen</dt><dd>{ago(vehicle.device?.lastCommunicationAt)}</dd></div></dl></article>)}</section>}
        {view === 'alerts' && <section className="surface"><SectionTitle eyebrow="EVENT INBOX" title="Alerts and security events" /><AlertList alerts={data.alerts} /></section>}
        {view === 'privacy' && isCustomer && <Privacy data={data} grants={grants} busy={busy} createGrant={createGrant} revoke={revoke} />}
      </>}</div>
    </main>
  </div>;
}
