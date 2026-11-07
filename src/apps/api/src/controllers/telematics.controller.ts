import type { Request, Response } from 'express';
import { listConnectedTelematicsDevices, sendVehicleCommand } from '../services/telematics-command.service.js';
import { subscribeToTelematicsStream } from '../telematics/ingestion.js';
import type { DownlinkCommandType } from '../telematics/types.js';
import { HttpError } from '../utils/errors.js';

export async function listConnectedDevicesController(req: Request, res: Response) {
  const sessions = listConnectedTelematicsDevices();
  res.json({
    count: sessions.length,
    sessions
  });
}

export async function sendCommandController(req: Request, res: Response) {
  const actorId = req.actor!.id;
  const { vehicleId, commandType, options } = req.body;

  if (!vehicleId || !commandType) {
    throw new HttpError(400, 'INVALID_REQUEST', 'vehicleId and commandType are required.');
  }

  const result = await sendVehicleCommand(
    actorId,
    vehicleId,
    commandType as DownlinkCommandType,
    options || {}
  );

  res.json(result);
}

export function telematicsStreamController(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  // Subscribe to live broadcast
  const unsubscribe = subscribeToTelematicsStream(event => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
  });

  // Keep-alive ping every 15 seconds
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    unsubscribe();
  });
}
