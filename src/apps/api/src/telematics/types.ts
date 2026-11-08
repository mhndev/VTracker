import type net from 'node:net';

export interface CobanLocationData {
  imei: string;
  occurredAt: Date;
  validFix: boolean;
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number;
  fuelVoltage?: number;
  fuelPercent?: number;
  ignitionOn: boolean;
  doorOpen: boolean;
  externalPower: boolean;
  armed: boolean;
  immobilized: boolean;
  rawStatusMask?: string;
}

export type CobanAlarmType =
  | 'SOS'
  | 'ACC_ALARM'
  | 'DOOR_ALARM'
  | 'SENSOR_ALARM'
  | 'LOW_BATTERY'
  | 'POWER_OFF'
  | 'OVERSPEED'
  | 'MOVEMENT'
  | 'FUEL_THEFT'
  | 'GENERAL_ALARM';

export interface CobanAlarmData {
  imei: string;
  alarmType: CobanAlarmType;
  rawAlarmTag: string;
  occurredAt: Date;
  location?: CobanLocationData;
}

export type ParsedPacket =
  | { type: 'LOGIN'; imei: string; raw: string }
  | { type: 'HEARTBEAT'; imei: string; raw: string }
  | { type: 'LOCATION'; data: CobanLocationData; raw: string }
  | { type: 'ALARM'; data: CobanAlarmData; raw: string }
  | { type: 'COMMAND_RESPONSE'; imei?: string; response: string; raw: string }
  | { type: 'DEVICE_INFO'; imei: string; detectedModel?: string; firmwareVersion?: string; protocolVersion?: string; variantVersion?: string; raw: string }
  | { type: 'UNKNOWN'; raw: string };

export interface DeviceSession {
  imei: string;
  socket: net.Socket;
  remoteAddress: string;
  remotePort: number;
  connectedAt: Date;
  lastCommunicationAt: Date;
  authenticated: boolean;
  latestTelemetry?: CobanLocationData;
  pendingCommands: Map<string, {
    resolve: (res: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>;
}

export type DownlinkCommandType =
  | 'STOP'          // Delayed immobilize (speed < 20km/h)
  | 'QUICKSTOP'     // Immediate immobilize
  | 'RESUME'        // Resume engine & fuel
  | 'ARM'           // Normal arm
  | 'SILENT'        // Silent arm
  | 'DISARM'        // Disarm
  | 'CHECK'         // Status inquiry
  | 'POSITION'      // Single position inquiry
  | 'OIL_ZERO'      // Calibrate empty tank (0%)
  | 'OIL_FULL'      // Calibrate full tank (100%)
  | 'FIX'           // Tracking interval
  | 'CUSTOM';       // Raw custom string
