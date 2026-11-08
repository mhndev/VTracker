import net from 'node:net';
import dgram from 'node:dgram';
import { env } from '../config/env.js';
import { decodeCobanPacket } from './decoder.js';
import { initializeTelematicsIngestion } from './ingestion.js';
import { telematicsSessions } from './session.js';
import {
  buildIdentificationQuery,
  detectProtocolFromFrame,
  markIdentificationQuery,
  recordDeviceInformation,
  recordProtocolDetection
} from '../services/device-protocol.service.js';

let tcpServer: net.Server | null = null;
let udpServer: dgram.Socket | null = null;

export function startTelematicsServer(port = env.telematicsPort, host = '0.0.0.0'): net.Server {
  if (tcpServer) return tcpServer;

  // Initialize ingestion event listeners
  initializeTelematicsIngestion();

  tcpServer = net.createServer(socket => {
    telematicsSessions.registerSocket(socket);

    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Telematics TCP] Incoming connection from ${remote}`);

    let buffer = '';

    socket.on('data', chunk => {
      buffer += chunk.toString('ascii');

      // Process frames delimited by ';' or '\n'
      while (buffer.includes(';') || buffer.includes('\n')) {
        let delimiterIndex = buffer.indexOf(';');
        const newlineIndex = buffer.indexOf('\n');

        if (delimiterIndex === -1 || (newlineIndex !== -1 && newlineIndex < delimiterIndex)) {
          delimiterIndex = newlineIndex;
        }

        const rawFrame = buffer.slice(0, delimiterIndex + 1);
        buffer = buffer.slice(delimiterIndex + 1);

        const currentImei = telematicsSessions.getImeiForSocket(socket);
        const packet = decodeCobanPacket(rawFrame, currentImei);
        const packetImei = packet.type === 'LOGIN' || packet.type === 'HEARTBEAT'
          ? packet.imei
          : packet.type === 'LOCATION' || packet.type === 'ALARM'
            ? packet.data.imei
            : packet.type === 'COMMAND_RESPONSE'
              ? packet.imei ?? currentImei
              : packet.type === 'DEVICE_INFO'
                ? packet.imei
              : currentImei;
        if (packetImei) telematicsSessions.recordIncomingMessage(packetImei, packet.type, packet.raw);

        switch (packet.type) {
          case 'LOGIN': {
            console.log(`[Telematics TCP] Handshake LOGIN from IMEI: ${packet.imei}`);
            telematicsSessions.authenticateSession(packet.imei, socket);
            // Reply with LOAD to acknowledge login handshake
            socket.write('LOAD\r\n');
            telematicsSessions.recordOutgoingMessage(packet.imei, 'ACK', 'LOAD');
            const detection = detectProtocolFromFrame(packet.raw);
            if (detection) {
              void recordProtocolDetection(packet.imei, detection).then(async () => {
                const query = buildIdentificationQuery(detection.protocolProfileId, packet.imei);
                if (!query || socket.destroyed) return;
                socket.write(query);
                telematicsSessions.recordOutgoingMessage(packet.imei, 'COMMAND', query);
                await markIdentificationQuery(packet.imei);
              }).catch(error => console.warn(`[Telematics TCP] Device identification failed: ${error instanceof Error ? error.message : String(error)}`));
            }
            break;
          }

          case 'HEARTBEAT': {
            telematicsSessions.updateLastCommunication(packet.imei);
            socket.write('ON\r\n');
            telematicsSessions.recordOutgoingMessage(packet.imei, 'ACK', 'ON');
            break;
          }

          case 'LOCATION': {
            if (!currentImei) {
              telematicsSessions.authenticateSession(packet.data.imei, socket);
            }
            telematicsSessions.updateLastCommunication(packet.data.imei, packet.data);
            telematicsSessions.emit('telemetry:location', packet.data);
            break;
          }

          case 'ALARM': {
            if (!currentImei) {
              telematicsSessions.authenticateSession(packet.data.imei, socket);
            }
            telematicsSessions.updateLastCommunication(packet.data.imei, packet.data.location);
            telematicsSessions.emit('telemetry:alarm', packet.data);
            break;
          }

          case 'COMMAND_RESPONSE': {
            const imei = packet.imei || currentImei;
            if (imei) {
              console.log(`[Telematics TCP] Device response from ${imei}: "${packet.response}"`);
              telematicsSessions.handleCommandResponse(imei, packet.response);
            }
            break;
          }

          case 'DEVICE_INFO': {
            console.log(`[Telematics TCP] Identified ${packet.imei}: ${packet.detectedModel ?? 'unknown model'} ${packet.firmwareVersion ?? ''}`.trim());
            void recordDeviceInformation(packet).catch(error => console.warn(`[Telematics TCP] Could not persist device information: ${error instanceof Error ? error.message : String(error)}`));
            break;
          }

          default:
            // Ignore unrecognized chunks
            break;
        }
      }
    });

    socket.on('error', err => {
      console.warn(`[Telematics TCP] Socket error (${remote}): ${err.message}`);
      telematicsSessions.handleSocketClose(socket);
    });

    socket.on('close', () => {
      console.log(`[Telematics TCP] Connection closed (${remote})`);
      telematicsSessions.handleSocketClose(socket);
    });
  });

  tcpServer.listen(port, host, () => {
    console.log(`📡 Coban GPS 303FG Telematics TCP Server listening on ${host}:${port}`);
  });

  udpServer = dgram.createSocket('udp4');
  udpServer.on('message', (message, remote) => {
    const rawFrame = message.toString('ascii').trim();
    const packet = decodeCobanPacket(rawFrame);
    const packetImei = packet.type === 'LOGIN' || packet.type === 'HEARTBEAT'
      ? packet.imei
      : packet.type === 'LOCATION' || packet.type === 'ALARM'
        ? packet.data.imei
        : packet.type === 'COMMAND_RESPONSE'
          ? packet.imei
          : packet.type === 'DEVICE_INFO'
            ? packet.imei
          : undefined;
    if (packetImei) telematicsSessions.recordIncomingMessage(packetImei, packet.type, packet.raw);
    const reply = (value: string, imei: string) => {
      udpServer?.send(Buffer.from(`${value}\r\n`, 'ascii'), remote.port, remote.address);
      telematicsSessions.recordOutgoingMessage(imei, 'ACK', value);
    };

    switch (packet.type) {
      case 'LOGIN':
        console.log(`[Telematics UDP] Handshake LOGIN from IMEI: ${packet.imei}`);
        reply('LOAD', packet.imei);
        break;
      case 'HEARTBEAT':
        reply('ON', packet.imei);
        break;
      case 'LOCATION':
        telematicsSessions.emit('telemetry:location', packet.data);
        break;
      case 'ALARM':
        telematicsSessions.emit('telemetry:alarm', packet.data);
        break;
      default:
        break;
    }
  });
  udpServer.on('error', error => console.warn(`[Telematics UDP] Socket error: ${error.message}`));
  udpServer.bind(port, host, () => console.log(`📡 Coban GPS 303FG Telematics UDP Server listening on ${host}:${port}`));

  return tcpServer;
}

export async function stopTelematicsServer(): Promise<void> {
  await Promise.all([
    new Promise<void>(resolve => {
      if (!tcpServer) return resolve();
      tcpServer.close(() => { tcpServer = null; console.log('📡 Coban Telematics TCP Server stopped.'); resolve(); });
    }),
    new Promise<void>(resolve => {
      if (!udpServer) return resolve();
      udpServer.close(() => { udpServer = null; console.log('📡 Coban Telematics UDP Server stopped.'); resolve(); });
    })
  ]);
}
