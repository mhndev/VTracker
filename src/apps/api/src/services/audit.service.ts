import { AuditEvent } from '../models/index.js';
import type { Transaction } from 'sequelize';

export async function recordAudit(input: {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  details?: Record<string, unknown>;
}, transaction?: Transaction): Promise<AuditEvent> {
  return AuditEvent.create({
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: new Date(),
    details: {},
    ...input
  }, { transaction });
}
