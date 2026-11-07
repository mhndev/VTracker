import EventEmitter from 'node:events';
import type net from 'node:net';
import type { CobanAlarmData, CobanLocationData, DeviceSession } from './types.js';

export interface TelematicsEventMap {
  'session:connected': { imei?: string; remoteAddress: string; remotePort: number };
  'session:authenticated': { imei: string; remoteAddress: string };
  'session:disconnected': { imei: string };
  'telemetry:location': CobanLocationData;
  'telemetry:alarm': CobanAlarmData;
  'command:sent': { imei: string; command: string };
  'command:response': { imei: string; response: string };
}

export class TelematicsSessionManager extends EventEmitter {
  private sessionsByImei = new Map<string, DeviceSession>();
  private imeisBySocket = new Map<net.Socket, string>();

  public registerSocket(socket: net.Socket): void {
    socket.setKeepAlive(true, 30000);
    socket.setNoDelay(true);
  }

  public authenticateSession(imei: string, socket: net.Socket): DeviceSession {
    // If an existing session for this IMEI exists, cleanly close previous socket
    const existing = this.sessionsByImei.get(imei);
    if (existing && existing.socket !== socket && !existing.socket.destroyed) {
      existing.socket.destroy();
    }

    const session: DeviceSession = {
      imei,
      socket,
      remoteAddress: socket.remoteAddress || 'unknown',
      remotePort: socket.remotePort || 0,
      connectedAt: new Date(),
      lastCommunicationAt: new Date(),
      authenticated: true,
      pendingCommands: new Map()
    };

    this.sessionsByImei.set(imei, session);
    this.imeisBySocket.set(socket, imei);

    this.emit('session:authenticated', {
      imei,
      remoteAddress: session.remoteAddress
    });

    return session;
  }

  public getSession(imei: string): DeviceSession | undefined {
    return this.sessionsByImei.get(imei);
  }

  public getImeiForSocket(socket: net.Socket): string | undefined {
    return this.imeisBySocket.get(socket);
  }

  public updateLastCommunication(imei: string, telemetry?: CobanLocationData): void {
    const session = this.sessionsByImei.get(imei);
    if (session) {
      session.lastCommunicationAt = new Date();
      if (telemetry) {
        session.latestTelemetry = telemetry;
      }
    }
  }

  public handleSocketClose(socket: net.Socket): void {
    const imei = this.imeisBySocket.get(socket);
    this.imeisBySocket.delete(socket);

    if (imei) {
      const session = this.sessionsByImei.get(imei);
      if (session && session.socket === socket) {
        // Reject any pending commands on close
        for (const [cmdId, pending] of session.pendingCommands.entries()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Socket closed before response received for command ${cmdId}`));
        }
        session.pendingCommands.clear();
        this.sessionsByImei.delete(imei);
        this.emit('session:disconnected', { imei });
      }
    }
  }

  public handleCommandResponse(imei: string, response: string): void {
    const session = this.sessionsByImei.get(imei);
    this.emit('command:response', { imei, response });

    if (!session || session.pendingCommands.size === 0) return;

    // Resolve the oldest pending command
    const [oldestKey, pending] = session.pendingCommands.entries().next().value || [];
    if (oldestKey && pending) {
      clearTimeout(pending.timer);
      session.pendingCommands.delete(oldestKey);
      pending.resolve(response);
    }
  }

  public async sendCommand(
    imei: string,
    commandString: string,
    timeoutMs = 10000
  ): Promise<string> {
    const session = this.sessionsByImei.get(imei);
    if (!session || session.socket.destroyed) {
      throw new Error(`Device ${imei} is not currently connected to the telematics gateway.`);
    }

    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pendingCommands.delete(commandId);
        reject(new Error(`Timed out waiting for response from device ${imei} (${timeoutMs}ms)`));
      }, timeoutMs);

      session.pendingCommands.set(commandId, { resolve, reject, timer });

      session.socket.write(commandString, err => {
        if (err) {
          clearTimeout(timer);
          session.pendingCommands.delete(commandId);
          reject(new Error(`Failed to transmit command to ${imei}: ${err.message}`));
        } else {
          this.emit('command:sent', { imei, command: commandString });
        }
      });
    });
  }

  public listActiveSessions(): Array<{
    imei: string;
    remoteAddress: string;
    remotePort: number;
    connectedAt: Date;
    lastCommunicationAt: Date;
    latestTelemetry?: CobanLocationData;
  }> {
    return Array.from(this.sessionsByImei.values()).map(s => ({
      imei: s.imei,
      remoteAddress: s.remoteAddress,
      remotePort: s.remotePort,
      connectedAt: s.connectedAt,
      lastCommunicationAt: s.lastCommunicationAt,
      latestTelemetry: s.latestTelemetry
    }));
  }
}

export const telematicsSessions = new TelematicsSessionManager();
