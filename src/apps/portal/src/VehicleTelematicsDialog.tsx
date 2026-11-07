import { useState } from 'react';
import { LtrText, useI18n } from '@sentinel/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Fuel,
  Gauge,
  KeyRound,
  LoaderCircle,
  Lock,
  Power,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  Unlock,
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

export function VehicleTelematicsDialog({ vehicle, actorId, onClose }: VehicleTelematicsDialogProps) {
  const { t, formatNumber, formatDateTime } = useI18n();
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [commandResponse, setCommandResponse] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [customCommand, setCustomCommand] = useState('');
  const [confirmCut, setConfirmCut] = useState<'delayed' | 'immediate' | null>(null);

  const device = vehicle.device;
  const imei = device?.serial || 'Not Available';

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

        {/* Live Hardware Telemetry HUD */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginTop: '16px',
            padding: '14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <KeyRound size={12} /> Ignition (ACC)
            </span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
              {vehicle.location?.speedKph && vehicle.location.speedKph > 0 ? 'Engine ON' : 'Engine Idle / OFF'}
            </strong>
          </div>

          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> Power Source
            </span>
            <strong style={{ fontSize: '13px', color: '#0284c7' }}>
              Main Battery (12V)
            </strong>
          </div>

          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Gauge size={12} /> Live Speed
            </span>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
              {vehicle.location ? `${formatNumber(vehicle.location.speedKph)} km/h` : '0 km/h'}
            </strong>
          </div>

          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={12} /> Link Status
            </span>
            <strong style={{ fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> GPRS Online
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
          {/* Section 1: Engine Immobilizer Controls */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Power size={13} /> REMOTE ENGINE IMMOBILIZER (RELAY)
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="outline"
                style={{ color: '#b45309', borderColor: '#fde68a' }}
                disabled={Boolean(loadingCommand)}
                onClick={() => setConfirmCut('delayed')}
              >
                <Power size={13} /> Delayed Cut (Safe: Speed &lt; 20 km/h)
              </button>

              <button
                type="button"
                className="outline"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                disabled={Boolean(loadingCommand)}
                onClick={() => setConfirmCut('immediate')}
              >
                <AlertTriangle size={13} /> Immediate Cut
              </button>

              <button
                type="button"
                className="outline"
                style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('RESUME')}
              >
                <CheckCircle2 size={13} /> Restore Fuel & Engine
              </button>
            </div>
          </div>

          {/* Section 2: Arming & Security Controls */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={13} /> SECURITY & ARMING SYSTEM
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('ARM')}
              >
                <Lock size={13} /> Arm (Siren Active)
              </button>

              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('SILENT')}
              >
                <VolumeX size={13} /> Silent Arm
              </button>

              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('DISARM')}
              >
                <Unlock size={13} /> Disarm
              </button>
            </div>
          </div>

          {/* Section 3: Calibration & Diagnostics */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wrench size={13} /> SENSORS & DIAGNOSTICS
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('CHECK')}
              >
                <Cpu size={13} /> Check Hardware Status
              </button>

              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('OIL_ZERO')}
              >
                <Fuel size={13} /> Calibrate Empty Tank (0%)
              </button>

              <button
                type="button"
                className="outline"
                disabled={Boolean(loadingCommand)}
                onClick={() => executeCommand('OIL_FULL')}
              >
                <Fuel size={13} /> Calibrate Full Tank (100%)
              </button>
            </div>
          </div>

          {/* Section 4: Raw Command Terminal */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={13} /> RAW COBAN COMMAND TERMINAL
            </span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="e.g. check, sensitivity 2, fix020s002h***n"
                value={customCommand}
                onChange={e => setCustomCommand(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
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
          </div>
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

        <footer>
          <button type="button" className="outline" onClick={onClose} disabled={Boolean(loadingCommand)}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
