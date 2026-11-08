import type { Request, Response } from 'express';
import { getVehicleTelematicsDetails, listConnectedTelematicsDevices, listVehicleTelematicsMessages, sendVehicleCommand } from '../services/telematics-command.service.js';
import { subscribeToTelematicsStream } from '../telematics/ingestion.js';
import type { DownlinkCommandType } from '../telematics/types.js';
import { HttpError } from '../utils/errors.js';
import { listProtocolCatalog } from '../services/device-protocol.service.js';

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

export async function listVehicleMessagesController(req: Request, res: Response) {
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  res.json(await listVehicleTelematicsMessages(req.actor!.id, String(req.params.vehicleId), limit));
}

export async function getVehicleTelematicsDetailsController(req: Request, res: Response) {
  res.json(await getVehicleTelematicsDetails(req.actor!.id, String(req.params.vehicleId)));
}

export async function listProtocolCatalogController(_req: Request, res: Response) {
  const profiles = await listProtocolCatalog();
  res.json({ count: profiles.length, profiles });
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
