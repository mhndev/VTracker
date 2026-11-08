import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, AlertTriangle, Antenna, BatteryLow, Car, ChevronRight, CirclePower, DoorOpen,
  Fuel, Gauge, HeartPulse, History, KeyRound, LocateFixed, LockKeyhole, MapPin, MessageSquare,
  Moon, Navigation, Pause, Play, Power, Radio, RotateCcw, Route, Satellite, Send, Settings,
  ShieldAlert, Smartphone, Square, Sun, Unplug, Vibrate, Wifi, WifiOff, Zap
} from 'lucide-react';

type RouteState = {
  status: string; start: { label: string; latitude: number; longitude: number } | null;
  end: { label: string; latitude: number; longitude: number } | null; geometry: number[][];
  distanceMeters: number; durationSeconds: number; progress: number; playbackRate: number; elapsedSeconds: number;
};
type DeviceState = {
  connected: boolean; imei: string; sessionId: string; vehicleKey: string; vehicleLabel: string;
  serverHost: string; serverPort: number; latitude: number; longitude: number; speedKph: number; heading: number;
  fuelPercent: number; batteryVolts: number; validFix: boolean; ignitionOn: boolean; doorOpen: boolean;
  externalPower: boolean; armed: boolean; silentArmed: boolean; immobilized: boolean; workingMode: string;
  callMode: string; transport: string; apn: string; route: RouteState;
};
type TrafficEvent = { id: number; at: string; direction: string; kind: string; raw: string };
type Tab = 'device' | 'route' | 'commands' | 'traffic' | 'setup';

const emptyRoute: RouteState = { status: 'idle', start: null, end: null, geometry: [], distanceMeters: 0, durationSeconds: 0, progress: 0, playbackRate: 1, elapsedSeconds: 0 };
const initial: DeviceState = {
  connected: false, imei: '358123049582103', sessionId: '', vehicleKey: 'vehicle-1', vehicleLabel: 'Delivery Van 12',
  serverHost: '127.0.0.1', serverPort: 8090, latitude: 52.52, longitude: 13.405, speedKph: 0, heading: 90,
  fuelPercent: 85, batteryVolts: 3.95, validFix: true, ignitionOn: true, doorOpen: false, externalPower: true,
  armed: false, silentArmed: false, immobilized: false, workingMode: 'online', callMode: 'tracker', transport: 'tcp', apn: 'internet', route: emptyRoute
};

const groups = [
  { title: 'Connection & reports', items: [['Login', 'login', Antenna], ['Heartbeat', 'heartbeat', HeartPulse], ['Position', 'position', MapPin], ['Lose GPS fix', 'gpsLost', Satellite], ['Restore GPS', 'gpsFix', LocateFixed]] },
  { title: 'Security alarms', items: [['SOS panic', 'sos', ShieldAlert], ['Door alarm', 'door', DoorOpen], ['ACC alarm', 'acc', KeyRound], ['Shock alarm', 'shock', Vibrate], ['Movement', 'movement', Navigation], ['Geo-fence', 'geofence', MapPin], ['Overspeed', 'overspeed', Gauge], ['Fuel theft', 'fuel', Fuel]] },
  { title: 'Power alarms', items: [['Low battery', 'lowBattery', BatteryLow], ['Power cut', 'powerCut', Unplug], ['Restore power', 'powerRestore', Zap]] },
  { title: 'Vehicle inputs', items: [['ACC on', 'accOn', CirclePower], ['ACC off', 'accOff', Power], ['Close door', 'doorClose', DoorOpen], ['Fuel empty', 'fuelEmpty', Fuel], ['Fuel full', 'fuelFull', Fuel]] },
  { title: 'Simulated relay & arming', warning: 'Simulator state only — no real vehicle control.', items: [['Arm', 'arm', LockKeyhole], ['Silent arm', 'silent', Radio], ['Disarm', 'disarm', RotateCcw], ['Delayed stop', 'stop', Power], ['Immediate stop', 'quickstop', AlertTriangle], ['Resume', 'resume', Car]] }
] as const;

const commandGroups = [
  { title: 'Tracking', commands: [['Position', 'position123456'], ['Always online', 'online123456'], ['Smart sleep', 'sleep123456'], ['20s / 2h interval', 'fix020s002h***n123456'], ['Cancel interval', 'nofix123456'], ['Status', 'check123456'], ['IMEI', 'imei123456']] },
  { title: 'Arm & relay', commands: [['Arm', 'arm123456'], ['Silent arm', 'silent123456'], ['Disarm', 'disarm123456'], ['Delayed stop', 'stop123456'], ['Immediate stop', 'quickstop123456'], ['Resume', 'resume123456']] },
  { title: 'Alarm settings', commands: [['Sensitivity 1', 'sensitivity123456 1'], ['Sensitivity 2', 'sensitivity123456 2'], ['Sensitivity 3', 'sensitivity123456 3'], ['Low battery on', 'lowbattery123456 on'], ['Low battery off', 'lowbattery123456 off'], ['Power alarm on', 'extpower123456 on'], ['Power alarm off', 'extpower123456 off'], ['Movement 200m', 'move123456 200'], ['Cancel movement', 'nomove123456'], ['Speed 80km/h', 'speed123456 80'], ['Cancel speed', 'nospeed123456'], ['Alarm x3', 'xtime1234563'], ['ACC alerts on', 'ACC123456'], ['ACC alerts off', 'noACC123456']] },
  { title: 'Audio, fuel & SIM', commands: [['Listen mode', 'listen123456'], ['Tracker mode', 'tracker123456'], ['Fuel zero', 'oilzero123456'], ['Fuel full', 'oilfull123456'], ['Balance', 'balance123456 100 *100#'], ['Forward operator SMS', 'forward123456 100']] },
  { title: 'Network', commands: [['Set APN', 'apn123456 internet'], ['APN user/pass', 'up123456 user pass'], ['Set local server', 'adminip123456 127.0.0.1 8090'], ['TCP mode', 'tcp123456'], ['UDP mode', 'udp123456'], ['SMS mode', 'SMS123456'], ['GPRS mode', 'gprs123456'], ['Time zone', 'time zone123456 +1']] },
  { title: 'Administration', commands: [['Authorize number', 'admin123456 +491701234567'], ['Remove number', 'noadmin123456 +491701234567'], ['Change password', 'password123456 654321'], ['Hardware reset', 'reset123456'], ['Factory initialize', 'begin123456']] }
] as const;

const sessionId = (() => {
  const existing = sessionStorage.getItem('sentinel-simulator-session');
  if (existing) return existing;
  const created = `sim-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  sessionStorage.setItem('sentinel-simulator-session', created);
  return created;
})();

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`/simulator-api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-simulator-session': sessionId }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

function RoutePreview({ route, progress }: { route: RouteState; progress: number }) {
  const projection = useMemo(() => {
    if (route.geometry.length < 2) return null;
    const xs = route.geometry.map(point => point[0]);
    const ys = route.geometry.map(point => point[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const width = Math.max(.0001, maxX - minX); const height = Math.max(.0001, maxY - minY);
    const points = route.geometry.map(([x, y]) => [8 + (x - minX) / width * 84, 92 - (y - minY) / height * 84]);
    const index = Math.min(points.length - 1, Math.round(progress * (points.length - 1)));
    return { path: points.map(point => point.join(',')).join(' '), current: points[index], start: points[0], end: points.at(-1)! };
  }, [route.geometry, progress]);
  return <div className="route-preview">
    {projection ? <svg viewBox="0 0 100 100" role="img" aria-label="Route preview"><polyline className="route-shadow" points={projection.path} /><polyline className="route-line" points={projection.path} /><circle className="route-start" cx={projection.start[0]} cy={projection.start[1]} r="2.5" /><circle className="route-end" cx={projection.end[0]} cy={projection.end[1]} r="3" /><g transform={`translate(${projection.current[0]} ${projection.current[1]}) rotate(${deviceHeading(route, progress)})`}><path className="route-car" d="M0-4 3 4 0 2-3 4Z" /></g></svg> : <div className="route-empty"><Route /><strong>Plan a route to preview it</strong><span>Addresses and latitude, longitude pairs are supported.</span></div>}
    <span className="map-credit">Route © OSRM · Data © OpenStreetMap contributors</span>
  </div>;
}

function deviceHeading(route: RouteState, progress: number) {
  if (!route.geometry.length) return 0;
  const index = Math.min(route.geometry.length - 1, Math.round(progress * (route.geometry.length - 1)));
  return index * 17;
}

export function App() {
  const [device, setDevice] = useState(initial);
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [tab, setTab] = useState<Tab>('device');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('8090');
  const [imei, setImei] = useState(initial.imei);
  const [transport, setTransport] = useState<'tcp' | 'udp'>('tcp');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('Ready to connect');
  const [sms, setSms] = useState('check123456');
  const [smsReply, setSmsReply] = useState('');
  const [rawPacket, setRawPacket] = useState('');
  const [start, setStart] = useState('Alexanderplatz, Berlin');
  const [end, setEnd] = useState('Potsdamer Platz, Berlin');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('simulator-theme') as 'light' | 'dark') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('simulator-theme', theme);
  }, [theme]);

  useEffect(() => {
    const load = () => fetch(`/simulator-api/status?session=${encodeURIComponent(sessionId)}`).then(response => response.json()).then(data => {
      setDevice(data.state); setEvents(data.events); setHost(data.state.serverHost); setPort(String(data.state.serverPort)); setImei(data.state.imei); setTransport(data.state.transport === 'udp' ? 'udp' : 'tcp');
    });
    load();
    const stream = new EventSource(`/simulator-api/events?session=${encodeURIComponent(sessionId)}`);
    stream.onopen = load;
    stream.onmessage = message => {
      const update = JSON.parse(message.data);
      setDevice(update.state);
      setEvents(current => [update.event, ...current.filter(event => event.id !== update.event.id)].slice(0, 200));
    };
    return () => stream.close();
  }, []);

  const run = async (name: string, task: () => Promise<{ state?: DeviceState }>) => {
    setBusy(name);
    try {
      const result = await task();
      if (result.state) setDevice(result.state);
      setNotice(`${name} completed`);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  const sendAction = (label: string, action: string) => run(label, () => post('/action', { action }));
  const sendSms = (command = sms) => run('SMS command', async () => {
    setSms(command);
    const result = await post<{ response: string; state: DeviceState }>('/sms', { command });
    setSmsReply(result.response);
    return result;
  });
  const routeOperation = (operation: string) => run(`Route ${operation}`, () => post(`/route/${operation}`, { playbackRate }));
  const routeStatus = device.route.status === 'idle' ? 'No route planned' : device.route.status;

  return <div className="console-shell">
    <aside className="nav-rail">
      <div className="nav-brand"><Navigation /></div>
      <nav aria-label="Simulator sections">
        {([['device', Smartphone, 'Device'], ['route', Route, 'Route'], ['commands', MessageSquare, 'Commands'], ['traffic', Activity, 'Traffic'], ['setup', Settings, 'Setup']] as const).map(([value, Icon, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}><Icon /><span>{label}</span></button>)}
      </nav>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div><span className={`status-line ${device.connected ? 'online' : ''}`}><i />{device.connected ? 'Device online' : 'Device offline'}</span><h1>303FG Operations Console</h1></div>
        <div className="top-actions"><span className="protocol-pill">{device.transport.toUpperCase()} · GPS103</span><button className="theme-toggle" aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon /> : <Sun />}<span>{theme === 'light' ? 'Dark' : 'Light'}</span></button></div>
      </header>

      <main className="content">
        <section className="identity-card surface"><span className="identity-icon"><Car /></span><div><small>Vehicle / session identity</small><h2>{device.vehicleLabel}</h2></div><dl><div><dt>Generated IMEI</dt><dd>{device.imei}</dd></div><div><dt>Session ID</dt><dd>{device.sessionId || sessionId}</dd></div><div><dt>Assigned fleet vehicle</dt><dd>{device.vehicleKey}</dd></div></dl></section>

        {tab === 'device' && <div className="page-grid">
          <section className="surface panel connection-panel"><PanelTitle eyebrow="Gateway destination" title={device.connected ? `${device.serverHost}:${device.serverPort}` : 'Connection controls'} icon={<Wifi />} />
            {!device.connected ? <><div className="form-grid connection-fields"><Field label="Protocol"><select value={transport} onChange={event => setTransport(event.target.value as 'tcp' | 'udp')}><option value="tcp">TCP / GPRS</option><option value="udp">UDP / GPRS</option></select></Field><Field label="Host"><input value={host} onChange={event => setHost(event.target.value)} /></Field><Field label="Port"><input inputMode="numeric" value={port} onChange={event => setPort(event.target.value)} /></Field></div><Field label="Device IMEI"><input value={imei} onChange={event => setImei(event.target.value)} /></Field><button className="button primary" disabled={!!busy} onClick={() => run('Connect', () => post('/connect', { host, port: Number(port), imei, transport }))}><Wifi />Connect & send login</button></> : <button className="button danger" onClick={() => run('Disconnect', () => post('/disconnect'))}><WifiOff />Disconnect</button>}
          </section>
          <section className="surface panel sensor-panel"><PanelTitle eyebrow="Reported location" title="Sensor values" icon={<MapPin />} /><div className="form-grid two"><Field label="Latitude"><input type="number" step="0.000001" value={device.latitude} onChange={event => setDevice({ ...device, latitude: Number(event.target.value) })} /></Field><Field label="Longitude"><input type="number" step="0.000001" value={device.longitude} onChange={event => setDevice({ ...device, longitude: Number(event.target.value) })} /></Field></div><div className="form-grid three"><Field label="Speed"><input type="number" value={device.speedKph} onChange={event => setDevice({ ...device, speedKph: Number(event.target.value) })} /></Field><Field label="Heading"><input type="number" value={device.heading} onChange={event => setDevice({ ...device, heading: Number(event.target.value) })} /></Field><Field label="Fuel"><input type="number" value={device.fuelPercent} onChange={event => setDevice({ ...device, fuelPercent: Number(event.target.value) })} /></Field></div><button className="button secondary" onClick={() => run('Update sensors', () => post('/settings', device))}><Settings />Apply sensor values</button></section>
          <section className="surface actions-panel"><div className="panel-heading"><div><small>Device controls</small><h2>Actions, alarms and reports</h2></div></div><div className="action-groups">{groups.map(group => <div className="action-group" key={group.title}><div><h3>{group.title}</h3>{'warning' in group && <small className="warning">{group.warning}</small>}</div><div className="action-grid">{group.items.map(([label, action, Icon]) => <button key={action} className={action === 'sos' || action === 'quickstop' ? 'critical' : ''} disabled={!!busy || (!device.connected && !['arm', 'silent', 'disarm', 'stop', 'quickstop', 'resume'].includes(action))} onClick={() => sendAction(label, action)}><Icon /><span>{label}</span><ChevronRight /></button>)}</div></div>)}</div></section>
        </div>}

        {tab === 'route' && <section className="surface route-panel"><div className="route-header"><div><small>Route simulator</small><h2>Move {device.vehicleLabel}</h2></div><span className={`route-status status-${device.route.status}`}>{routeStatus}</span></div><div className="route-layout"><div className="route-controls"><Field label="Start address or coordinates"><input value={start} onChange={event => setStart(event.target.value)} placeholder="52.5219, 13.4132" /></Field><Field label="Destination address or coordinates"><input value={end} onChange={event => setEnd(event.target.value)} placeholder="52.5096, 13.3760" /></Field><button className="button secondary" disabled={!!busy} onClick={() => run('Plan route', () => post('/route/plan', { start, end }))}><Route />Plan fastest driving route</button><div className="route-metrics"><Metric label="Distance" value={device.route.distanceMeters ? `${(device.route.distanceMeters / 1000).toFixed(1)} km` : '—'} /><Metric label="Real ETA" value={device.route.durationSeconds ? formatDuration(device.route.durationSeconds) : '—'} /><Metric label="Progress" value={`${Math.round(device.route.progress * 100)}%`} /><Metric label="Current speed" value={`${device.speedKph.toFixed(0)} km/h`} /></div><Field label="Playback speed"><select value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))}><option value={1}>1× real time</option><option value={10}>10× test speed</option><option value={60}>60× fast test</option></select></Field><div className="route-buttons"><button className="button primary" disabled={!device.connected || !['planned', 'completed', 'stopped'].includes(device.route.status)} onClick={() => routeOperation('start')}><Play />Start</button><button className="button secondary" disabled={device.route.status !== 'running'} onClick={() => routeOperation('pause')}><Pause />Pause</button><button className="button secondary" disabled={device.route.status !== 'paused'} onClick={() => routeOperation('resume')}><Play />Resume</button><button className="button danger" disabled={!['running', 'paused'].includes(device.route.status)} onClick={() => routeOperation('stop')}><Square />Stop</button></div><p className="route-note">At 1×, the movement duration matches the route service ETA. Each GPS report is sent through the selected TCP or UDP connection and appears live on the customer dashboard.</p></div><RoutePreview route={device.route} progress={device.route.progress} /></div></section>}

        {tab === 'commands' && <div className="commands-page"><section className="surface sms-console"><PanelTitle eyebrow="Simulated SMS channel" title="Command terminal" icon={<MessageSquare />} /><div className="command-row"><input value={sms} onChange={event => setSms(event.target.value)} /><button onClick={() => sendSms()}><Send /></button></div><output>{smsReply || 'Replies from the virtual tracker appear here.'}</output></section><div className="command-groups">{commandGroups.map(group => <section className="surface command-group" key={group.title}><h2>{group.title}</h2><div>{group.commands.map(([label, command]) => <button key={command} onClick={() => sendSms(command)}><span>{label}</span><code>{command}</code></button>)}</div></section>)}<section className="surface command-group"><h2>Phone calls</h2><div><button onClick={() => sendAction('Position call', 'callPosition')}><span>Call for position</span><code>hang up + location reply</code></button><button onClick={() => sendAction('Listen call', 'callListen')}><span>Listen call</span><code>15 second session</code></button></div></section></div></div>}

        {tab === 'traffic' && <section className="traffic-page"><div className="traffic-head"><div><small>Raw protocol</small><h2>{events.length} recent events for this session</h2></div><button onClick={() => setEvents([])}>Clear view</button></div><div className="traffic-list">{events.length === 0 ? <div className="empty"><History /><p>No traffic yet</p></div> : events.map(event => <article key={event.id}><div><span className={`direction ${event.direction}`}>{event.direction}</span><strong>{event.kind}</strong><time>{new Date(event.at).toLocaleTimeString()}</time></div><code>{event.raw}</code></article>)}</div></section>}

        {tab === 'setup' && <div className="setup-grid"><section className="surface setup-card"><Smartphone /><small>Multiple vehicles</small><h2>One vehicle per browser session</h2><p>Each new tab or browser session receives an isolated device state, IMEI, protocol connection, traffic history and route. The first four sessions map to the four seeded customer vehicles.</p><ol><li>Start the Sentinel API and simulator.</li><li>Run <code>npm run tunnel:tcp</code> for a public TCP endpoint.</li><li>Open this app in multiple sessions and connect each one.</li><li>Plan and start independent routes; watch all markers in the portal.</li></ol></section><section className="surface custom-card"><h2>Send exact raw packet</h2><textarea value={rawPacket} onChange={event => setRawPacket(event.target.value)} placeholder="imei:358123049582103,tracker,...;" /><button className="button secondary" disabled={!device.connected || !rawPacket} onClick={() => run('Custom packet', () => post('/action', { action: 'custom', raw: rawPacket }))}><Send />Send raw packet</button></section></div>}
      </main>
    </div>

    <aside className="inspector"><div><small>Live inspector</small><h2>Telemetry & status</h2></div><div className="telemetry-cards"><Telemetry icon={<LocateFixed />} value={device.validFix ? 'GPS fixed' : 'No fix'} label="Position quality" /><Telemetry icon={<Gauge />} value={`${device.speedKph.toFixed(0)} km/h`} label="Current speed" /><Telemetry icon={<Fuel />} value={`${device.fuelPercent.toFixed(0)}%`} label="Fuel level" /><Telemetry icon={<Zap />} value={`${device.batteryVolts.toFixed(2)}V`} label="Battery" /></div><section className="surface state-card"><h3>Device state</h3><StatusRow label="Ignition" value={`ACC ${device.ignitionOn ? 'ON' : 'OFF'}`} /><StatusRow label="Arming" value={device.silentArmed ? 'SILENT' : device.armed ? 'ARMED' : 'DISARMED'} /><StatusRow label="External power" value={device.externalPower ? '12V POWER' : 'BACKUP BATTERY'} /><StatusRow label="Relay" value={device.immobilized ? 'RELAY STOPPED' : 'RELAY NORMAL'} /></section><section className="surface state-card protocol-card"><h3>Protocol session</h3><StatusRow label="Destination" value={`${device.serverHost}:${device.serverPort}`} /><StatusRow label="Transport" value={device.transport.toUpperCase()} /><StatusRow label="Route" value={routeStatus} /></section><div className={`notice ${notice.toLowerCase().includes('failed') || notice.toLowerCase().includes('error') || notice.toLowerCase().includes('not ') ? 'error' : ''}`}><Activity />{busy ? `${busy}…` : notice}</div></aside>
  </div>;
}

function PanelTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) { return <div className="panel-heading"><div><small>{eyebrow}</small><h2>{title}</h2></div>{icon}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function Telemetry({ icon, value, label }: { icon: ReactNode; value: string; label: string }) { return <div className="telemetry-card">{icon}<strong>{value}</strong><span>{label}</span></div>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="status-row"><span>{label}</span><strong>{value}</strong></div>; }
