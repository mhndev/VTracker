import { AuditEvent } from '../models/index.js';

export async function recordAudit(input: {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  details?: Record<string, unknown>;
}): Promise<AuditEvent> {
  return AuditEvent.create({
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: new Date(),
    details: {},
    ...input
  });
}
