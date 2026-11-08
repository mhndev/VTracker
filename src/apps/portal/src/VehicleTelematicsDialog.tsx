import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { LtrText, useI18n } from '@sentinel/ui';
import {
  AlertTriangle,
  BatteryLow,
  BellRing,
  CheckCircle2,
  Clock3,
  Cpu,
  DoorOpen,
  Droplets,
  Fuel,
  Gauge,
  Globe2,
  HelpCircle,
  Info,
  KeyRound,
  LoaderCircle,
  Lock,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  PlugZap,
  Power,
  Radio,
  Route,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Unlock,
  Vibrate,
  VolumeX,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import type { Vehicle } from './types';

interface VehicleTelematicsDialogProps {
  vehicle: Vehicle;
  actorId: string;
  onClose: () => void;
}

interface DeviceMessage {
  id: string;
  imei: string;
  actorId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  kind: 'LOGIN' | 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'COMMAND_RESPONSE' | 'DEVICE_INFO' | 'UNKNOWN' | 'ACK' | 'COMMAND';
  recordedAt: string;
  raw: string;
}

interface VehicleTrip {
  id: string;
  startedAt: string;
  endedAt: string | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  distanceKm: number;
  durationSeconds: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  pathPoints: Array<{ latitude: number; longitude: number; occurredAt: string }>;
}

interface VehicleTelematicsDetails {
  connection: { online: boolean; lastCommunicationAt: string | null };
  motion: { moving: boolean; speedKph: number; updatedAt: string } | null;
  state: {
    ignitionOn: boolean;
    doorOpen: boolean;
    externalPower: boolean;
    armed: boolean;
    immobilized: boolean;
    fuelPercent: number | null;
    updatedAt: string;
  } | null;
  trips: VehicleTrip[];
}

interface MessagePresentation {
  title: string;
  summary: string;
  details?: StatusDetail[];
  sections?: Array<{ title: string; details: StatusDetail[] }>;
  variant?: 'status';
}

type StatusDetailIcon =
  | 'alarm' | 'angle' | 'battery' | 'clock' | 'door' | 'fuel' | 'key' | 'mode'
  | 'movement' | 'phone' | 'power' | 'relay' | 'security' | 'speed' | 'timer'
  | 'unknown' | 'vibration';

interface StatusDetail {
  label: string;
  value: string;
  rawValue?: string;
  icon?: StatusDetailIcon;
  tone?: 'good' | 'warning' | 'danger' | 'neutral';
}

function StatusDetailIconView({ icon }: { icon?: StatusDetailIcon }) {
  switch (icon) {
    case 'alarm': return <BellRing />;
    case 'angle': return <Navigation />;
    case 'battery': return <BatteryLow />;
    case 'clock': return <Clock3 />;
    case 'door': return <DoorOpen />;
    case 'fuel': return <Droplets />;
    case 'key': return <KeyRound />;
    case 'mode': return <Globe2 />;
    case 'movement': return <Route />;
    case 'phone': return <Phone />;
    case 'power': return <PlugZap />;
    case 'relay': return <Power />;
    case 'security': return <ShieldCheck />;
    case 'speed': return <Gauge />;
    case 'timer': return <Timer />;
    case 'vibration': return <Vibrate />;
    default: return <HelpCircle />;
  }
}

function rawLabel(value: string | undefined) {
  return value === undefined || value === '' ? 'empty' : value;
}

function switchValue(value: string | undefined, onLabel = 'Enabled', offLabel = 'Disabled') {
  if (value === '1') return onLabel;
  if (value === '0') return offLabel;
  return 'Unknown';
}

function switchTone(value: string | undefined, inverted = false): StatusDetail['tone'] {
  if (value !== '0' && value !== '1') return 'neutral';
  const active = value === '1';
  return active === inverted ? 'warning' : 'good';
}

function nmeaCoordinate(value: string | undefined, hemisphere: string | undefined, degreeDigits: number) {
  if (!value || !hemisphere || value.length <= degreeDigits) return null;
  const degrees = Number(value.slice(0, degreeDigits));
  const minutes = Number(value.slice(degreeDigits));
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes)) return null;
  const coordinate = degrees + minutes / 60;
  return hemisphere === 'S' || hemisphere === 'W' ? -coordinate : coordinate;
}

function presentDeviceMessage(message: DeviceMessage): MessagePresentation {
  const raw = message.raw.trim();
  const fields = raw.replace(/;$/, '').split(',').map(field => field.trim());

  if (message.kind === 'LOCATION') {
    const latitude = nmeaCoordinate(fields[7], fields[8], 2);
    const longitude = nmeaCoordinate(fields[9], fields[10], 3);
    const speedKnots = Number(fields[11]);
    const heading = Number(fields[12]);
    const fuelVoltage = Number(fields[13]);
    const statusMask = fields[14]?.padEnd(8, '0');
    const hasCoordinates = latitude !== null && longitude !== null;
    return {
      title: hasCoordinates ? 'Location received' : 'Location frame received',
      summary: hasCoordinates
        ? `The tracker reported ${latitude.toFixed(6)}, ${longitude.toFixed(6)}.`
        : 'The tracker sent a location frame, but it did not contain usable coordinates.',
      details: [
        ...(hasCoordinates ? [
          { label: 'Latitude', value: latitude.toFixed(6) },
          { label: 'Longitude', value: longitude.toFixed(6) }
        ] : []),
        ...(Number.isFinite(speedKnots) ? [{ label: 'Speed', value: `${(speedKnots * 1.852).toFixed(1)} km/h` }] : []),
        ...(Number.isFinite(heading) ? [{ label: 'Heading', value: `${heading.toFixed(0)}°` }] : []),
        { label: 'GPS fix', value: fields[6] === 'A' ? 'Valid' : 'Unavailable' },
        ...(Number.isFinite(fuelVoltage) ? [{ label: 'Fuel sensor', value: `${fuelVoltage.toFixed(2)} V (${Math.min(100, Math.max(0, fuelVoltage / 5 * 100)).toFixed(0)}%)` }] : []),
        ...(statusMask ? [
          { label: 'Ignition', value: statusMask[0] === '1' ? 'On' : 'Off' },
          { label: 'Security', value: statusMask[1] === '1' ? 'Armed' : 'Disarmed' },
          { label: 'Fuel relay', value: statusMask[2] === '1' ? 'Immobilized' : 'Normal supply' },
          { label: 'External power', value: statusMask[3] === '0' ? 'Disconnected' : 'Connected' },
          { label: 'Door', value: statusMask[4] === '1' ? 'Open' : 'Closed' },
          { label: 'Status mask', value: statusMask }
        ] : [])
      ]
    };
  }

  if (message.kind === 'COMMAND') {
    const command = raw.toLowerCase().replace(/[^a-z]/g, '');
    const commands: Record<string, MessagePresentation> = {
      check: { title: 'Device status requested', summary: 'Asked the tracker for power, battery, GPS, GSM and network status.' },
      position: { title: 'Current location requested', summary: 'Asked the tracker to acquire GPS and report its current position.' },
      stop: { title: 'Safe immobilization requested', summary: 'Asked the tracker to cut fuel only after the vehicle slows to a safe speed.' },
      quickstop: { title: 'Immediate immobilization requested', summary: 'Asked the tracker to cut the fuel relay immediately.' },
      resume: { title: 'Fuel supply restore requested', summary: 'Asked the tracker to restore the fuel relay and allow the engine to run.' },
      arm: { title: 'Security armed', summary: 'Asked the tracker to enable its vehicle alarm monitoring.' },
      silent: { title: 'Silent security armed', summary: 'Asked the tracker to arm without audible alerts.' },
      disarm: { title: 'Security disarmed', summary: 'Asked the tracker to disable vehicle alarm monitoring.' },
      oilzero: { title: 'Fuel calibration started', summary: 'Recorded the current sensor level as the empty reference.' },
      oilfull: { title: 'Fuel calibration completed', summary: 'Recorded the current sensor level as the full reference.' }
    };
    const match = Object.entries(commands).find(([name]) => command.startsWith(name));
    return match?.[1] ?? { title: 'Command sent to tracker', summary: 'The server sent a custom instruction to the device.' };
  }

  if (message.kind === 'LOGIN') {
    return { title: 'Tracker connected', summary: `Device ${message.imei} identified itself and opened a server session.` };
  }
  if (message.kind === 'HEARTBEAT') {
    return { title: 'Tracker is online', summary: 'The device checked in to keep its mobile-data connection alive.' };
  }
  if (message.kind === 'ACK') {
    return message.direction === 'OUTBOUND'
      ? { title: 'Server acknowledged the tracker', summary: raw === 'LOAD' ? 'The server accepted the new device connection.' : 'The server confirmed receipt of the device message.' }
      : { title: 'Acknowledgement received', summary: 'The tracker confirmed that it received the server transaction.' };
  }
  if (message.kind === 'ALARM') {
    return { title: 'Vehicle alarm received', summary: 'The tracker reported a security or vehicle-state alert that needs attention.' };
  }
  if (message.kind === 'COMMAND_RESPONSE') {
    const compact = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 4).join(' · ');
    return { title: 'Tracker replied to a command', summary: compact || 'The device returned a command response.' };
  }
  if (message.kind === 'DEVICE_INFO') {
    const infoFields = fields.slice(2).filter(Boolean);
    return {
      title: 'Device identity details received',
      summary: infoFields.length > 0 ? `The tracker identified itself as ${infoFields.slice(0, 2).join(' · ')}.` : 'The tracker returned its model and firmware information.',
      details: infoFields.map((value, index) => ({ label: ['Firmware', 'Product', 'Version code', 'Variant'][index] ?? `Field ${index + 1}`, value }))
    };
  }
  if (raw.toLowerCase().includes(',status,')) {
    const statusIndex = fields.findIndex(field => field.toLowerCase() === 'status');
    const values = fields.slice(statusIndex + 1);
    const movingSeconds = Number(values[1]);
    const stoppedSeconds = Number(values[2]);
    const sleepModes: Record<string, string> = {
      '0': 'Real-time online',
      '1': 'Smart sleep',
      '2': 'Power-saving mode'
    };
    const sensitivity: Record<string, string> = { '1': 'Low', '2': 'Medium', '3': 'High' };
    const movementAlarm = values[17]
      ? values[17].includes('_')
        ? `Geofence ${values[17].split('_').at(-1)} m`
        : values[17] === '0' ? 'Disabled' : `${values[17]} m radius`
      : 'Not configured';
    return {
      title: 'Device configuration synchronized',
      summary: 'The tracker sent its complete reporting, security, alarm and vehicle-control configuration.',
      variant: 'status',
      sections: [
        {
          title: 'Reporting & connectivity',
          details: [
            { label: 'Working mode', value: sleepModes[values[0]] ?? 'Unknown mode', rawValue: rawLabel(values[0]), icon: 'mode', tone: values[0] === '0' ? 'good' : 'neutral' },
            { label: 'Moving updates', value: movingSeconds === 0 ? 'Disabled' : Number.isFinite(movingSeconds) ? `Every ${movingSeconds} seconds` : 'Unknown', rawValue: rawLabel(values[1]), icon: 'timer', tone: movingSeconds > 0 ? 'good' : 'warning' },
            { label: 'Stationary updates', value: stoppedSeconds === 0 ? 'Disabled' : Number.isFinite(stoppedSeconds) ? `Every ${stoppedSeconds >= 3600 && stoppedSeconds % 3600 === 0 ? `${stoppedSeconds / 3600} hour${stoppedSeconds === 3600 ? '' : 's'}` : `${Math.round(stoppedSeconds / 60)} minutes`}` : 'Unknown', rawValue: rawLabel(values[2]), icon: 'clock', tone: stoppedSeconds > 0 ? 'good' : 'warning' },
            { label: 'Device time zone', value: values[5] === '0.00' || values[5] === '0' ? 'UTC ±0' : `UTC ${Number(values[5]) >= 0 ? '+' : ''}${values[5]}`, rawValue: rawLabel(values[5]), icon: 'clock', tone: 'neutral' }
          ]
        },
        {
          title: 'Security & alarms',
          details: [
            { label: 'Security state', value: switchValue(values[3], 'Armed', 'Disarmed'), rawValue: rawLabel(values[3]), icon: 'security', tone: values[3] === '1' ? 'good' : 'neutral' },
            { label: 'Shock alarm', value: switchValue(values[6]), rawValue: rawLabel(values[6]), icon: 'vibration', tone: switchTone(values[6]) },
            { label: 'Shock sensitivity', value: sensitivity[values[18]] ?? 'Unknown level', rawValue: rawLabel(values[18]), icon: 'vibration', tone: 'neutral' },
            { label: 'External power alarm', value: switchValue(values[8]), rawValue: rawLabel(values[8]), icon: 'power', tone: switchTone(values[8]) },
            { label: 'Tamper alarm', value: switchValue(values[9]), rawValue: rawLabel(values[9]), icon: 'door', tone: switchTone(values[9]) },
            { label: 'Fuel-level alarm', value: switchValue(values[10]), rawValue: rawLabel(values[10]), icon: 'fuel', tone: switchTone(values[10]) },
            { label: 'Low-battery alarm', value: switchValue(values[11]), rawValue: rawLabel(values[11]), icon: 'battery', tone: switchTone(values[11]) },
            { label: 'SMS alarm repeats', value: values[12] ? `${values[12]} message${values[12] === '1' ? '' : 's'}` : 'Not configured', rawValue: rawLabel(values[12]), icon: 'alarm', tone: 'neutral' }
          ]
        },
        {
          title: 'Vehicle & movement',
          details: [
            { label: 'Fuel/power relay', value: switchValue(values[7], 'Cut off', 'Supply restored'), rawValue: rawLabel(values[7]), icon: 'relay', tone: values[7] === '1' ? 'danger' : 'good' },
            { label: 'Speed alarm', value: values[4] === '0' || values[4] === '0.00' ? 'Disabled' : `${values[4]} km/h`, rawValue: rawLabel(values[4]), icon: 'speed', tone: values[4] === '0' || values[4] === '0.00' ? 'neutral' : 'good' },
            { label: 'Fuel tank capacity', value: values[13] === '0' || !values[13] ? 'Not configured' : `${values[13]} litres`, rawValue: rawLabel(values[13]), icon: 'fuel', tone: values[13] === '0' || !values[13] ? 'warning' : 'good' },
            { label: 'Smart turn update', value: values[16] === '0' || !values[16] ? 'Disabled' : `After ${values[16]}° turn`, rawValue: rawLabel(values[16]), icon: 'angle', tone: values[16] === '0' || !values[16] ? 'neutral' : 'good' },
            { label: 'Movement alarm', value: movementAlarm, rawValue: rawLabel(values[17]), icon: 'movement', tone: values[17] && values[17] !== '0' ? 'good' : 'neutral' }
          ]
        },
        {
          title: 'Device & firmware fields',
          details: [
            { label: 'Device password', value: 'Protected', rawValue: rawLabel(values[14]), icon: 'key', tone: 'good' },
            { label: 'Balance inquiry number', value: values[15] || 'Not configured', rawValue: rawLabel(values[15]), icon: 'phone', tone: 'neutral' },
            ...values.slice(19).map((value, index) => ({
              label: `Firmware extension ${index + 1}`,
              value: 'Not defined by published Coban schema',
              rawValue: rawLabel(value),
              icon: 'unknown' as const,
              tone: 'neutral' as const
            }))
          ]
        }
      ]
    };
  }
  if (raw === message.imei || /^\d{12,18};?$/.test(raw)) {
    return { title: 'Device identity received', summary: `Tracker ${message.imei} announced itself to the server.` };
  }
  return { title: 'Device message received', summary: 'The tracker sent a protocol message that has been saved for inspection.' };
}

function FitTripPath({ points }: { points: L.LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [20, 20], animate: false });
    else if (points[0]) map.setView(points[0], 15, { animate: false });
  }, [map, points]);
  return null;
}

function TripPathMap({ trip }: { trip: VehicleTrip }) {
  const points: L.LatLngTuple[] = trip.pathPoints.length
    ? trip.pathPoints.map(point => [point.latitude, point.longitude])
    : [[trip.startLatitude, trip.startLongitude], [trip.endLatitude, trip.endLongitude]];
  return (
    <div className="trip-path-map">
      <MapContainer center={points[0] ?? [52.52, 13.405]} zoom={14} zoomControl={false} scrollWheelZoom={false} className="leaflet-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitTripPath points={points} />
        <Polyline positions={points} pathOptions={{ color: '#6558f5', weight: 4, opacity: 0.85 }} />
      </MapContainer>
      <small>{trip.pathPoints.length || points.length} retained path points</small>
    </div>
  );
}

export function VehicleTelematicsDialog({ vehicle, actorId, onClose }: VehicleTelematicsDialogProps) {
  const { t, formatNumber, formatDateTime } = useI18n();
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [commandResponse, setCommandResponse] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [customCommand, setCustomCommand] = useState('');
  const [confirmCut, setConfirmCut] = useState<'delayed' | 'immediate' | null>(null);
  const [deviceMessages, setDeviceMessages] = useState<DeviceMessage[]>([]);
  const [messageLogError, setMessageLogError] = useState<string | null>(null);
  const [details, setDetails] = useState<VehicleTelematicsDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'state' | 'trips' | 'logs' | 'controls'>('state');
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);

  const device = vehicle.device;
  const imei = device?.serial || 'Not Available';

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/telematics/vehicles/${encodeURIComponent(vehicle.id)}/messages?limit=200`, {
          headers: { 'x-demo-actor': actorId }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Could not load device messages.');
        if (active) {
          setDeviceMessages(data.messages || []);
          setMessageLogError(null);
        }
      } catch (error) {
        if (active) setMessageLogError(error instanceof Error ? error.message : String(error));
      }
    };
    void loadMessages();
    const interval = window.setInterval(loadMessages, 3000);
    return () => { active = false; window.clearInterval(interval); };
  }, [actorId, vehicle.id]);

  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      try {
        const response = await fetch(`/api/telematics/vehicles/${encodeURIComponent(vehicle.id)}/details`, { headers: { 'x-demo-actor': actorId } });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(data.error?.message || 'Could not load vehicle state and trips.');
        if (active) { setDetails(data); setDetailsError(null); }
      } catch (error) {
        if (active) setDetailsError(error instanceof Error ? error.message : String(error));
      }
    };
    void loadDetails();
    const interval = window.setInterval(loadDetails, 10_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [actorId, vehicle.id]);

  async function executeCommand(commandType: string, options: Record<string, unknown> = {}) {
    setLoadingCommand(commandType);
    setCommandResponse(null);
    setCommandError(null);

    try {
      const res = await fetch('/api/telematics/commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-actor': actorId
        },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          commandType,
          options
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Command dispatch failed');
      }

      setCommandResponse(`[${commandType}] Device Response: ${data.response}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCommandError(`[${commandType}] Error: ${msg}`);
    } finally {
      setLoadingCommand(null);
      setConfirmCut(null);
    }
  }

  return (
    <div
      className="management-dialog-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (!loadingCommand && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="management-dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: 'min(720px, 100%)' }}
      >
        <header>
          <div>
            <span>COBAN GPS 303FG TELEMATICS CONTROLLER</span>
            <h2>{vehicle.name}</h2>
            <p>
              <LtrText>{vehicle.plate}</LtrText> · IMEI:{' '}
              <LtrText><strong>{imei}</strong></LtrText> · Protocol: Coban / TK103 TCP
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={Boolean(loadingCommand)}
          >
            <X />
          </button>
        </header>

        <nav className="telematics-view-switch" aria-label="Telematics view">
          <button type="button" className={activeView === 'state' ? 'active' : ''} onClick={() => setActiveView('state')}>
            <Gauge /> Current state
          </button>
          <button type="button" className={activeView === 'trips' ? 'active' : ''} onClick={() => setActiveView('trips')}>
            <Route /> Trips
          </button>
          <button type="button" className={activeView === 'logs' ? 'active' : ''} onClick={() => setActiveView('logs')}>
            <MessageSquareText /> Logs
          </button>
          <button type="button" className={activeView === 'controls' ? 'active' : ''} onClick={() => setActiveView('controls')}>
            <Wrench /> Device controls
          </button>
        </nav>

        {activeView === 'state' && (
          <section className="vehicle-state-section">
            {detailsError ? <p className="device-chat-state error">{detailsError}</p> : !details ? <p className="device-chat-state">Loading current vehicle state…</p> : (
              <>
                <div className="vehicle-state-summary">
                  <div className={details.connection.online ? 'good' : 'danger'}><Radio /><span>Connection</span><strong>{details.connection.online ? 'Online' : 'Offline'}</strong><small>{details.connection.lastCommunicationAt ? `Last message ${formatDateTime(details.connection.lastCommunicationAt, { dateStyle: 'short', timeStyle: 'medium' })}` : 'No messages received'}</small></div>
                  <div className={details.motion?.moving ? 'good' : 'neutral'}><Route /><span>Movement</span><strong>{details.motion ? `${details.connection.online ? '' : 'Last reported '}${details.motion.moving ? 'moving' : 'stopped'}` : 'Unknown'}</strong><small>{details.motion ? `${formatNumber(details.motion.speedKph)} km/h` : 'No position available'}</small></div>
                  <div className={details.state?.ignitionOn ? 'good' : 'neutral'}><KeyRound /><span>Ignition</span><strong>{details.state ? details.state.ignitionOn ? 'On' : 'Off' : 'Unknown'}</strong></div>
                  <div className={details.state?.doorOpen ? 'warning' : 'good'}><DoorOpen /><span>Doors</span><strong>{details.state ? details.state.doorOpen ? 'Open' : 'Closed' : 'Unknown'}</strong></div>
                  <div className={details.state?.externalPower === false ? 'danger' : 'good'}><PlugZap /><span>External power</span><strong>{details.state ? details.state.externalPower ? 'Connected' : 'Disconnected' : 'Unknown'}</strong></div>
                  <div className="neutral"><Fuel /><span>Fuel level</span><strong>{details.state?.fuelPercent === null || details.state?.fuelPercent === undefined ? 'Unknown' : `${formatNumber(details.state.fuelPercent)}%`}</strong></div>
                  <div className={details.state?.armed ? 'good' : 'neutral'}><ShieldCheck /><span>Security</span><strong>{details.state ? details.state.armed ? 'Armed' : 'Disarmed' : 'Unknown'}</strong></div>
                  <div className={details.state?.immobilized ? 'danger' : 'good'}><Power /><span>Fuel relay</span><strong>{details.state ? details.state.immobilized ? 'Immobilized' : 'Normal supply' : 'Unknown'}</strong></div>
                </div>
                <p className="vehicle-state-note">State values reflect the latest decoded tracker packet. Offline vehicles retain their last known state and show when it was last received.</p>
              </>
            )}
          </section>
        )}

        {activeView === 'trips' && (
          <section className="trip-history-section">
            <div className="device-chat-heading"><div><span><Route size={14} /> TRIP HISTORY</span><p>A new trip starts after the vehicle moves again following a stop of five minutes or more.</p></div></div>
            {detailsError ? <p className="device-chat-state error">{detailsError}</p> : !details ? <p className="device-chat-state">Loading trips…</p> : details.trips.length === 0 ? <p className="device-chat-state">No recorded trips yet. Trips begin when the tracker reports movement above 2 km/h.</p> : (
              <div className="trip-history-list">{details.trips.map(trip => (
                <article key={trip.id} className="trip-history-card">
                  <div><span className={trip.status === 'IN_PROGRESS' ? 'trip-live' : ''}>{trip.status === 'IN_PROGRESS' ? 'In progress' : 'Completed'}</span><strong>{formatDateTime(trip.startedAt, { dateStyle: 'medium', timeStyle: 'short' })}</strong><small>{trip.endedAt ? `Ended ${formatDateTime(trip.endedAt, { dateStyle: 'medium', timeStyle: 'short' })}` : 'Vehicle is still on this trip'}</small></div>
                  <dl><div><dt>Distance</dt><dd>{formatNumber(trip.distanceKm, { maximumFractionDigits: 1 })} km</dd></div><div><dt>Duration</dt><dd>{Math.floor(trip.durationSeconds / 3600)}h {Math.floor(trip.durationSeconds % 3600 / 60)}m</dd></div><div><dt>Start</dt><dd dir="ltr">{trip.startLatitude.toFixed(5)}, {trip.startLongitude.toFixed(5)}</dd></div><div><dt>End</dt><dd dir="ltr">{trip.endLatitude.toFixed(5)}, {trip.endLongitude.toFixed(5)}</dd></div></dl>
                  <TripPathMap trip={trip} />
                </article>
              ))}</div>
            )}
          </section>
        )}

        {activeView === 'logs' && (
        <section className="device-chat-section">
          <div className="device-chat-heading">
            <div>
              <span><MessageSquareText size={14} /> DEVICE LOGS</span>
              <p>Short meanings first. Use the info button for decoded details and the original frame.</p>
            </div>
            <small><i className={details?.connection.online ? '' : 'offline'} /> {details?.connection.online ? 'Live' : 'Offline'} · saved to database</small>
          </div>
          <div className="device-chat-thread">
            {messageLogError ? (
              <p className="device-chat-state error">{messageLogError}</p>
            ) : deviceMessages.length === 0 ? (
              <p className="device-chat-state">No messages or commands have been saved for this tracker yet.</p>
            ) : deviceMessages.slice(0, visibleMessageCount).map(message => {
              const presentation = presentDeviceMessage(message);
              return (
                <article
                  key={message.id}
                  className={`device-chat-message ${message.direction.toLowerCase()} ${message.kind.toLowerCase()} ${presentation.variant ?? ''}`}
                  aria-label={presentation.title}
                >
                  <div className="device-chat-avatar" aria-hidden="true">
                    {message.kind === 'LOCATION' ? <MapPin /> : message.direction === 'OUTBOUND' ? <Send /> : <Radio />}
                  </div>
                  <div className="device-chat-bubble">
                    <div className="device-chat-meta">
                      <strong>{message.direction === 'INBOUND' ? 'Vehicle tracker' : 'Fleet server'}</strong>
                      <time>{formatDateTime(message.recordedAt, { dateStyle: 'short', timeStyle: 'medium' })}</time>
                    </div>
                    <h3>{presentation.title}</h3>
                    <p>{presentation.summary}</p>
                    <details className="device-message-more">
                      <summary aria-label={`More information about ${presentation.title}`} title="More information"><Info /></summary>
                      <div className="device-message-expanded">
                        {presentation.details && presentation.details.length > 0 && (
                          <dl className="device-chat-details">
                            {presentation.details.map(detail => (
                              <div key={detail.label}>
                                <dt>{detail.icon && <StatusDetailIconView icon={detail.icon} />}{detail.label}</dt>
                                <dd dir="ltr">{detail.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {presentation.sections && (
                          <div className="device-status-sections">
                            {presentation.sections.map(section => (
                              <section key={section.title}>
                                <h4>{section.title}</h4>
                                <dl>
                                  {section.details.map(detail => (
                                    <div key={detail.label} className={`device-status-field ${detail.tone ?? 'neutral'}`}>
                                      <span aria-hidden="true"><StatusDetailIconView icon={detail.icon} /></span>
                                      <dt>{detail.label}</dt>
                                      <dd>{detail.value}</dd>
                                      <small dir="ltr">Protocol value: {detail.rawValue}</small>
                                    </div>
                                  ))}
                                </dl>
                              </section>
                            ))}
                          </div>
                        )}
                        <div className="device-message-raw">
                          <span>ORIGINAL {message.kind} · {message.direction}</span>
                          <code dir="ltr">{message.raw}</code>
                        </div>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
            {deviceMessages.length > visibleMessageCount && (
              <button type="button" className="device-chat-load-more" onClick={() => setVisibleMessageCount(count => count + 50)}>
                Load 50 older messages · {deviceMessages.length - visibleMessageCount} remaining
              </button>
            )}
          </div>
        </section>
        )}

        {activeView === 'controls' && <>
        {/* Live Hardware Telemetry HUD */}
        <div className="control-status-grid">
          <div className="control-status-item">
            <span>
              <KeyRound size={12} /> Ignition (ACC)
            </span>
            <strong>
              {vehicle.location?.speedKph && vehicle.location.speedKph > 0 ? 'Engine ON' : 'Engine Idle / OFF'}
            </strong>
          </div>

          <div className="control-status-item">
            <span>
              <Zap size={12} /> Power Source
            </span>
            <strong>
              Main Battery (12V)
            </strong>
          </div>

          <div className="control-status-item">
            <span>
              <Gauge size={12} /> Live Speed
            </span>
            <strong>
              {vehicle.location ? `${formatNumber(vehicle.location.speedKph)} km/h` : '0 km/h'}
            </strong>
          </div>

          <div className={`control-status-item ${details?.connection.online ? 'online' : 'offline'}`}>
            <span>
              <Radio size={12} /> Link Status
            </span>
            <strong>
              {details?.connection.online && <CheckCircle2 size={13} />} GPRS {details?.connection.online ? 'Online' : 'Offline'}
            </strong>
          </div>
        </div>

        {/* Safety Warning / Confirmation for Engine Cut */}
        {confirmCut && (
          <div
            style={{
              marginTop: '14px',
              padding: '14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#991b1b'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <AlertTriangle size={16} />
              Confirm Vehicle Immobilization ({confirmCut === 'delayed' ? 'Safe Delayed' : 'Immediate Cut'})
            </div>
            <p style={{ fontSize: '11px', marginTop: '6px' }}>
              {confirmCut === 'delayed'
                ? 'The GPS tracker will cut the fuel pump relay safely as soon as the vehicle speed drops below 20 km/h.'
                : 'WARNING: The fuel pump relay will trip immediately. Ensure the vehicle is in a safe condition before proceeding.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="primary"
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand(confirmCut === 'delayed' ? 'STOP' : 'QUICKSTOP')}
              >
                {loadingCommand ? <LoaderCircle className="spin" size={13} /> : <Power size={13} />}
                Confirm Cut
              </button>
              <button
                type="button"
                className="outline"
                onClick={() => setConfirmCut(null)}
                disabled={Boolean(loadingCommand)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Command Action Sections */}
        <div className="device-control-console">
          {/* Section 1: Engine Immobilizer Controls */}
          <section className="device-control-panel danger-panel">
            <div className="device-control-panel-heading">
              <span><Power /></span>
              <div><h3>Engine & fuel relay</h3><p>Restore normal operation, or immobilize only when the vehicle is in a safe location.</p></div>
              <em>High risk</em>
            </div>
            <div className="device-control-actions">
              <button
                type="button"
                className="control-action success-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('RESUME')}
              >
                <CheckCircle2 /> <span><strong>Restore fuel & engine</strong><small>Return the relay to normal supply</small></span>
              </button>
              <button
                type="button"
                className="control-action warning-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => setConfirmCut('delayed')}
              >
                <Power /> <span><strong>Safe delayed cut</strong><small>Activates below 20 km/h</small></span>
              </button>

              <button
                type="button"
                className="control-action danger-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => setConfirmCut('immediate')}
              >
                <AlertTriangle /> <span><strong>Immediate cut</strong><small>Emergency use only</small></span>
              </button>
            </div>
          </section>

          {/* Section 2: Arming & Security Controls */}
          <section className="device-control-panel">
            <div className="device-control-panel-heading">
              <span><Shield /></span>
              <div><h3>Vehicle security</h3><p>Choose how the tracker should monitor doors, ignition and vibration.</p></div>
            </div>
            <div className="device-control-actions three-up">
              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('ARM')}
              >
                <Lock /> <span><strong>Arm with siren</strong><small>Audible alarms enabled</small></span>
              </button>

              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('SILENT')}
              >
                <VolumeX /> <span><strong>Silent arm</strong><small>Notifications without siren</small></span>
              </button>

              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('DISARM')}
              >
                <Unlock /> <span><strong>Disarm</strong><small>Disable security monitoring</small></span>
              </button>
            </div>
          </section>

          {/* Section 3: Calibration & Diagnostics */}
          <section className="device-control-panel">
            <div className="device-control-panel-heading">
              <span><Wrench /></span>
              <div><h3>Diagnostics & calibration</h3><p>Read device health or calibrate the optional fuel sensor.</p></div>
            </div>
            <div className="device-control-actions three-up">
              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('CHECK')}
              >
                <Cpu /> <span><strong>Check hardware</strong><small>Battery, GPS, GSM and network</small></span>
              </button>

              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('OIL_ZERO')}
              >
                <Fuel /> <span><strong>Set tank empty</strong><small>Calibrate the 0% reference</small></span>
              </button>

              <button
                type="button"
                className="control-action"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('OIL_FULL')}
              >
                <Fuel /> <span><strong>Set tank full</strong><small>Calibrate the 100% reference</small></span>
              </button>
            </div>
          </section>

          {/* Section 4: Raw Command Terminal */}
          <details className="advanced-command-panel">
            <summary><span><Send /> Advanced command terminal</span><small>For protocol experts</small></summary>
            <p>Send a raw Coban command body. The configured device password is appended securely by the server.</p>
            <div className="advanced-command-form">
              <input
                type="text"
                placeholder="e.g. check, sensitivity 2, fix020s002h***n"
                value={customCommand}
                onChange={e => setCustomCommand(e.target.value)}
                disabled={Boolean(loadingCommand)}
              />
              <button
                type="button"
                className="primary"
                disabled={!customCommand.trim() || Boolean(loadingCommand)}
                onClick={() => executeCommand('CUSTOM', { rawCommand: customCommand.trim() })}
              >
                {loadingCommand === 'CUSTOM' ? <LoaderCircle className="spin" size={13} /> : <Send size={13} />}
                Send
              </button>
            </div>
          </details>
        </div>

        {/* Feedback Display */}
        {commandResponse && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#15803d',
              fontFamily: 'monospace',
              fontSize: '11px'
            }}
          >
            {commandResponse}
          </div>
        )}

        {commandError && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontFamily: 'monospace',
              fontSize: '11px'
            }}
          >
            {commandError}
          </div>
        )}
        </>}

        <footer>
          <button type="button" className="outline" onClick={onClose} disabled={Boolean(loadingCommand)}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
