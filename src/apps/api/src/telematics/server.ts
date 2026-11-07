import net from 'node:net';
import { env } from '../config/env.js';
import { decodeCobanPacket } from './decoder.js';
import { initializeTelematicsIngestion } from './ingestion.js';
import { telematicsSessions } from './session.js';

let tcpServer: net.Server | null = null;

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

        switch (packet.type) {
          case 'LOGIN': {
            console.log(`[Telematics TCP] Handshake LOGIN from IMEI: ${packet.imei}`);
            telematicsSessions.authenticateSession(packet.imei, socket);
            // Reply with LOAD to acknowledge login handshake
            socket.write('LOAD\r\n');
            break;
          }

          case 'HEARTBEAT': {
            telematicsSessions.updateLastCommunication(packet.imei);
            socket.write('ON\r\n');
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

  return tcpServer;
}

export function stopTelematicsServer(): Promise<void> {
  return new Promise(resolve => {
    if (!tcpServer) {
      resolve();
      return;
    }
    tcpServer.close(() => {
      tcpServer = null;
      console.log('📡 Coban Telematics TCP Server stopped.');
      resolve();
    });
  });
}
