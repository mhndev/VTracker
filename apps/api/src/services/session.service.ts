import { Op } from 'sequelize';
import { Membership, Organization, ServiceRelationship, User } from '../models/index.js';
import { hasPlatformRole } from './policy.service.js';

export async function getSession(actorId: string) {
  const actor = await User.findByPk(actorId);
  if (!actor) return null;
  const memberships = await Membership.findAll({ where: { userId: actorId } });
  const membershipOrganizationIds = memberships.map(membership => membership.organizationId);
  const organizations = membershipOrganizationIds.length
    ? await Organization.findAll({ where: { id: { [Op.in]: membershipOrganizationIds } } })
    : [];
  const organizationById = new Map(organizations.map(organization => [organization.id, organization]));
  const resellerOrganizationIds = organizations.filter(organization => organization.type === 'RESELLER').map(organization => organization.id);
  // One query for every active relationship instead of one per reseller membership.
  const relationships = resellerOrganizationIds.length
    ? await ServiceRelationship.findAll({ where: { resellerOrganizationId: { [Op.in]: resellerOrganizationIds }, status: 'ACTIVE' } })
    : [];
  const customerOrganizationIds = [...new Set(relationships.map(relationship => relationship.customerOrganizationId))];
  const customers = customerOrganizationIds.length
    ? await Organization.findAll({ where: { id: { [Op.in]: customerOrganizationIds } } })
    : [];
  const customerById = new Map(customers.map(customer => [customer.id, customer]));
  const scopes: Array<{ id: string; name: string; type: string; access: string }> = [];
  for (const membership of memberships) {
    const organization = organizationById.get(membership.organizationId);
    if (organization?.type === 'CUSTOMER') scopes.push({ ...organization.get(), access: 'member' });
    if (organization?.type === 'RESELLER') {
      for (const relationship of relationships.filter(item => item.resellerOrganizationId === organization.id)) {
        const customer = customerById.get(relationship.customerOrganizationId);
        if (customer) scopes.push({ ...customer.get(), access: 'service' });
      }
    }
  }
  if (await hasPlatformRole(actorId)) {
    const platformCustomers = await Organization.findAll({ where: { type: 'CUSTOMER' } });
    scopes.push(...platformCustomers.map(customer => ({ ...customer.get(), access: 'platform' })));
  }
  return {
    actor: actor.get(),
    memberships: memberships.map(item => item.get()),
    scopes: scopes.filter((scope, index, all) => all.findIndex(item => item.id === scope.id) === index)
  };
}
