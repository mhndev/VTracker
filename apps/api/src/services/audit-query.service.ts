import { Op } from 'sequelize';
import { AuditEvent, User, Vehicle } from '../models/index.js';
import { HttpError } from '../utils/errors.js';
import { getMembership } from './policy.service.js';

// Audit history is an unbounded, append-only table, so responses are capped to keep
// payload size and memory bounded. Pagination is a follow-up improvement.
const AUDIT_PAGE_LIMIT = 200;

export async function listOrganizationAudit(actorId: string, organizationId: string) {
  if (!await getMembership(actorId, organizationId)) throw new HttpError(403, 'AUDIT_SCOPE_DENIED', 'Audit history is available only to customer organization members.');
  const vehicles = await Vehicle.findAll({ where: { ownerOrganizationId: organizationId } });
  const resourceIds = [organizationId, ...vehicles.map(vehicle => vehicle.id)];
  const events = await AuditEvent.findAll({
    where: { resourceId: { [Op.in]: resourceIds } },
    order: [['occurredAt', 'DESC']],
    limit: AUDIT_PAGE_LIMIT
  });
  // Resolve actor names in a single query instead of one lookup per event.
  const actorIds = [...new Set(events.map(event => event.actorId))];
  const actors = actorIds.length ? await User.findAll({ where: { id: { [Op.in]: actorIds } } }) : [];
  const actorNames = new Map(actors.map(actor => [actor.id, actor.name]));
  return events.map(event => ({ ...event.get(), actorName: actorNames.get(event.actorId) ?? 'System' }));
}
