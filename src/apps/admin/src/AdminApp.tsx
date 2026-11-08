import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { DashboardSearch, DashboardSidebar, DashboardTopbar, EmptyState, LtrText, MetricCard, SectionTitle, StatusPill, Surface, Toast, WorkspaceRail as SharedWorkspaceRail, isMessageKey, useI18n, type MessageKey, type SupportedLocale } from '@sentinel/ui';
import {
  Activity, AlertTriangle, BookOpen, Building2, CheckCircle2, CirclePlay, Clock, ExternalLink, FileClock, LayoutDashboard,
  LockKeyhole, Pencil, Plus, Radio, RefreshCw, Search, Server, ShieldCheck, Signal, Users, X
} from 'lucide-react';
import { OnboardingLibrary } from './components/OnboardingLibrary';
import { DELEGATED_CAPABILITIES, type AdminData, type AdminView, type DelegatedCapability, type DeviceCatalogData, type ProtocolProfile, type ResellerInput, type ResellerRecord, type ResellerStatus } from './types';
import { AdminFetchError, fetchAdmin, fetchDeviceCatalog, fetchResellers, fetchSession, saveDeviceAvailability, saveReseller, updateOrganizationLocale } from './api';

const VIEWS: readonly { id: AdminView; icon: LucideIcon }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'resellers', icon: Users },
  { id: 'organizations', icon: Building2 },
  { id: 'devices', icon: Radio },
  { id: 'catalog', icon: BookOpen },
  { id: 'incidents', icon: AlertTriangle },
  { id: 'audit', icon: FileClock },
  { id: 'onboarding', icon: CirclePlay }
];

function WorkspaceRail({ view }: { view: AdminView }) {
  const { t } = useI18n();
  const modes = [
    { id: 'operations', label: t('admin.rail.operations') },
    { id: 'tenants', label: t('admin.rail.tenants') },
    { id: 'network', label: t('admin.rail.network') },
    { id: 'risk', label: t('admin.rail.risk') }
  ];
  const activeModeId = view === 'overview' || view === 'onboarding' ? 'operations' : view === 'organizations' || view === 'resellers' ? 'tenants' : view === 'devices' || view === 'catalog' ? 'network' : view === 'incidents' ? 'risk' : 'operations';
  return <SharedWorkspaceRail label={t('admin.rail.timelineAria')} modes={modes} activeModeId={activeModeId} completedModeIds={['tenants', 'network']} />;
}

type Tone = 'positive' | 'warning' | 'critical' | 'neutral';

const humanize = (value: string): string =>
  value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, character => character.toUpperCase());

const matches = (query: string, ...values: Array<string | number>): boolean =>
  !query || values.some(value => String(value).toLowerCase().includes(query));

function Metric({ icon: Icon, label, value, caption, tone }: {
  icon: LucideIcon; label: string; value: string; caption: string; tone: Tone;
}) {
  const color: Record<Tone, 'violet' | 'mint' | 'peach' | 'sky'> = { positive: 'mint', warning: 'peach', critical: 'peach', neutral: 'violet' };
  return <MetricCard icon={<Icon />} label={label} value={value} meta={caption} color={color[tone]} />;
}

function Panel({ overline, title, meta, children, flush }: {
  overline: string; title: string; meta?: ReactNode; children: ReactNode; flush?: boolean;
}) {
  return <Surface className="admin-panel"><SectionTitle eyebrow={overline} title={title} action={meta} /><div className={flush ? 'admin-panel-body is-flush' : 'admin-panel-body'}>{children}</div></Surface>;
}

function ResultCount({ shown, total }: { shown: number; total: number }) {
  const { t, formatNumber } = useI18n();
  return (
    <span className="result-count">
      {shown === total
        ? t('admin.results.totalRecords', { count: formatNumber(total) })
        : t('admin.results.filteredRecords', { shown: formatNumber(shown), total: formatNumber(total) })}
    </span>
  );
}

function NoResults({ message }: { message: string }) {
  const { t } = useI18n();
  return <EmptyState icon={<Search aria-hidden="true" />} title={t('common.noResults')} copy={message} />;
}

function ResellerTable({ resellers, onEdit }: { resellers: ResellerRecord[]; onEdit: (reseller: ResellerRecord) => void }) {
  const { t, formatNumber } = useI18n();
  if (!resellers.length) return <NoResults message={t('admin.resellers.emptyMessage')} />;
  return (
    <div className="table-wrap">
      <table className="data-table reseller-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.resellers.colPartner')}</th>
            <th scope="col">{t('admin.resellers.colLanguage')}</th>
            <th scope="col">{t('admin.resellers.colCapabilities')}</th>
            <th scope="col" className="col-num">{t('admin.resellers.colCustomers')}</th>
            <th scope="col">{t('admin.resellers.colStatus')}</th>
            <th scope="col"><span className="sr-only">{t('admin.resellers.colActions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {resellers.map(reseller => (
            <tr key={reseller.id}>
              <td>
                <span className="entity">
                  <span className="entity-mark" aria-hidden="true">{reseller.name.charAt(0)}</span>
                  <span className="entity-text"><strong>{reseller.name}</strong><small><LtrText>{reseller.id}</LtrText></small></span>
                </span>
              </td>
              <td>{reseller.defaultLocale === 'fa' ? t('common.farsi') : t('common.english')}</td>
              <td>
                <div className="capability-list">
                  {reseller.capabilities.length
                    ? reseller.capabilities.map(capability => <span key={capability}>{t(`admin.resellers.capabilities.${capability}.short` as MessageKey)}</span>)
                    : <span className="is-muted">{t('admin.resellers.noCapabilities')}</span>}
                </div>
              </td>
              <td className="col-num">{formatNumber(reseller.customerCount)}</td>
              <td><StatusPill value={reseller.status} /></td>
              <td className="table-action-cell">
                <button type="button" className="table-action" onClick={() => onEdit(reseller)} aria-label={t('admin.resellers.editAria', { name: reseller.name })}>
                  <Pencil aria-hidden="true" />{t('admin.resellers.edit')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResellerDialog({ reseller, submitting, errorKey, onDismiss, onSubmit }: {
  reseller: ResellerRecord | null;
  submitting: boolean;
  errorKey: MessageKey | null;
  onDismiss: () => void;
  onSubmit: (input: ResellerInput) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(reseller?.name ?? '');
  const [defaultLocale, setDefaultLocale] = useState<SupportedLocale>(reseller?.defaultLocale ?? 'en');
  const [status, setStatus] = useState<ResellerStatus>(reseller?.status ?? 'ACTIVE');
  const [capabilities, setCapabilities] = useState<DelegatedCapability[]>(reseller?.capabilities ?? []);
  const [nameInvalid, setNameInvalid] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (errorKey) errorRef.current?.focus(); }, [errorKey]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setNameInvalid(true);
      return;
    }
    onSubmit({ name: normalizedName, defaultLocale, status, capabilities });
  };

  const toggleCapability = (capability: DelegatedCapability) => {
    setCapabilities(current => current.includes(capability) ? current.filter(item => item !== capability) : [...current, capability]);
  };

  return (
    <div className="admin-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onDismiss(); }}>
      <form className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="reseller-dialog-title" aria-busy={submitting} onSubmit={submit}>
        <div className="admin-dialog-head">
          <div><p className="overline">{t(reseller ? 'admin.resellers.editOverline' : 'admin.resellers.createOverline')}</p><h2 id="reseller-dialog-title">{t(reseller ? 'admin.resellers.editTitle' : 'admin.resellers.createTitle')}</h2></div>
          <button type="button" className="dialog-close" onClick={onDismiss} disabled={submitting} aria-label={t('common.close')}><X aria-hidden="true" /></button>
        </div>
        <p className="dialog-copy">{t('admin.resellers.dialogCopy')}</p>
        {errorKey ? <div className="dialog-error" role="alert" tabIndex={-1} ref={errorRef}><AlertTriangle aria-hidden="true" />{t(errorKey)}</div> : null}
        <div className="reseller-form-grid">
          <label className="form-field form-field-wide">
            <span>{t('admin.resellers.nameLabel')}</span>
            <input value={name} maxLength={120} autoFocus aria-invalid={nameInvalid || undefined} aria-describedby={nameInvalid ? 'reseller-name-error' : undefined} onChange={event => { setName(event.target.value); setNameInvalid(false); }} />
            {nameInvalid ? <small id="reseller-name-error" className="field-error">{t('admin.resellers.nameValidation')}</small> : null}
          </label>
          <label className="form-field">
            <span>{t('admin.resellers.languageLabel')}</span>
            <select value={defaultLocale} onChange={event => setDefaultLocale(event.target.value as SupportedLocale)}>
              <option value="en">{t('common.english')}</option>
              <option value="fa">{t('common.farsi')}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t('admin.resellers.statusLabel')}</span>
            <select value={status} onChange={event => setStatus(event.target.value as ResellerStatus)}>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
            </select>
          </label>
        </div>
        <fieldset className="capability-fieldset">
          <legend>{t('admin.resellers.capabilitiesLegend')}</legend>
          <p>{t('admin.resellers.capabilitiesHelp')}</p>
          <div className="capability-options">
            {DELEGATED_CAPABILITIES.map(capability => (
              <label key={capability} className="capability-option">
                <input type="checkbox" checked={capabilities.includes(capability)} onChange={() => toggleCapability(capability)} />
                <span><strong>{t(`admin.resellers.capabilities.${capability}.label` as MessageKey)}</strong><small>{t(`admin.resellers.capabilities.${capability}.description` as MessageKey)}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="privacy-callout"><LockKeyhole aria-hidden="true" />{t('admin.resellers.privacyBoundary')}</p>
        <div className="admin-dialog-actions">
          <button type="button" className="outline" onClick={onDismiss} disabled={submitting}>{t('common.cancel')}</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? <Activity className="spin" aria-hidden="true" /> : null}{submitting ? t('common.saving') : t(reseller ? 'admin.resellers.saveChanges' : 'admin.resellers.createAction')}</button>
        </div>
      </form>
    </div>
  );
}

function OrganizationTable({ organizations, updatingId, onLocaleChange }: { organizations: AdminData['organizations']; updatingId?: string | null; onLocaleChange?: (organizationId: string, locale: SupportedLocale) => void }) {
  const { t, formatNumber } = useI18n();
  if (!organizations.length) return <NoResults message={t('admin.organizations.emptyMessage')} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.organizations.colOrganization')}</th>
            <th scope="col">{t('admin.organizations.colPartner')}</th>
            <th scope="col" className="col-num">{t('admin.organizations.colFleet')}</th>
            <th scope="col" className="col-num">{t('admin.organizations.colDevicesOnline')}</th>
            <th scope="col" className="col-num">{t('admin.organizations.colOpenAlerts')}</th>
            {onLocaleChange ? <th scope="col">{t('admin.organizations.colLanguage')}</th> : null}
            <th scope="col">{t('admin.organizations.colService')}</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map(organization => {
            const share = organization.devices ? Math.round((organization.onlineDevices / organization.devices) * 100) : 0;
            return (
              <tr key={organization.id}>
                <td>
                  <span className="entity">
                    <span className="entity-mark" aria-hidden="true">{organization.name.charAt(0)}</span>
                    <span className="entity-text">
                      <strong>{organization.name}</strong>
                      <small><LtrText>{organization.id}</LtrText></small>
                    </span>
                  </span>
                </td>
                <td className="cell-muted">
                  {organization.resellerName === 'Direct' ? t('admin.organizations.directPartner') : organization.resellerName}
                </td>
                <td className="col-num">{formatNumber(organization.vehicles)}</td>
                <td className="col-num">
                  <span className="ratio">
                    <span className="ratio-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
                    <span className="ratio-text">{formatNumber(organization.onlineDevices)}/{formatNumber(organization.devices)}</span>
                  </span>
                </td>
                <td className="col-num">
                  {organization.openAlerts ? <span className="cell-strong">{formatNumber(organization.openAlerts)}</span> : <span className="cell-muted">—</span>}
                </td>
                {onLocaleChange ? (
                  <td>
                    <select
                      className="table-select"
                      value={organization.defaultLocale}
                      disabled={updatingId === organization.id}
                      aria-label={t('admin.organizations.languageLabel', { name: organization.name })}
                      onChange={event => onLocaleChange(organization.id, event.target.value as SupportedLocale)}
                    >
                      <option value="en">{t('common.english')}</option>
                      <option value="fa">{t('common.farsi')}</option>
                    </select>
                  </td>
                ) : null}
                <td><StatusPill value={organization.serviceStatus} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeviceTable({ devices, emptyMessage }: {
  devices: AdminData['devices']; emptyMessage?: string;
}) {
  const { t, formatDateTime, formatRelativeTime } = useI18n();
  const defaultEmpty = t('admin.devices.emptyMessage');
  if (!devices.length) return <NoResults message={emptyMessage ?? defaultEmpty} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.devices.colDevice')}</th>
            <th scope="col">{t('admin.devices.colCustody')}</th>
            <th scope="col">{t('admin.devices.colModel')}</th>
            <th scope="col">{t('admin.devices.colRadio')}</th>
            <th scope="col">{t('admin.devices.colSignal')}</th>
            <th scope="col">{t('admin.devices.colLastCommunication')}</th>
            <th scope="col">{t('admin.devices.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.id}>
              <td>
                <span className="entity">
                  <span className="entity-mark square" aria-hidden="true"><Radio /></span>
                  <span className="entity-text">
                    <strong><LtrText>{device.serial}</LtrText></strong>
                    <small><LtrText>{device.id}</LtrText></small>
                  </span>
                </span>
              </td>
              <td className="cell-muted">
                {device.custodyOrganizationName === 'Unassigned' ? t('admin.devices.unassignedCustody') : device.custodyOrganizationName}
              </td>
              <td className="cell-muted"><LtrText>{device.model}</LtrText></td>
              <td className="cell-muted"><LtrText>{device.radio}</LtrText></td>
              <td><StatusPill value={device.signalQuality} /></td>
              <td className="cell-muted" title={formatDateTime(device.lastCommunicationAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}>
                {device.lastCommunicationAt ? formatRelativeTime(device.lastCommunicationAt) : t('common.never')}
              </td>
              <td><StatusPill value={device.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ events, emptyMessage }: { events: AdminData['recentAudit']; emptyMessage: string }) {
  const { t, formatDateTime, formatRelativeTime } = useI18n();
  if (!events.length) return <NoResults message={emptyMessage} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.audit.colEvent')}</th>
            <th scope="col">{t('admin.audit.colActor')}</th>
            <th scope="col">{t('admin.audit.colResource')}</th>
            <th scope="col">{t('admin.audit.colOutcome')}</th>
            <th scope="col">{t('admin.audit.colWhen')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => {
            const actionKey = `audit.action.${event.action}`;
            const actionLabel = isMessageKey(actionKey) ? t(actionKey) : humanize(event.action);
            const resourceKey = `audit.resourceType.${event.resourceType}`;
            const resourceLabel = isMessageKey(resourceKey) ? t(resourceKey) : humanize(event.resourceType);
            return (
              <tr key={event.id}>
                <td>
                  <span className="entity">
                    <span className={`entity-mark square${event.outcome === 'DENIED' ? ' is-critical' : ''}`} aria-hidden="true"><ShieldCheck /></span>
                    <span className="entity-text">
                      <strong>{actionLabel}</strong>
                      <small><LtrText>{event.id}</LtrText></small>
                    </span>
                  </span>
                </td>
                <td className="cell-muted">{event.actorName === 'System' ? t('admin.audit.systemActor') : event.actorName}</td>
                <td className="cell-muted">{resourceLabel}</td>
                <td><StatusPill value={event.outcome} /></td>
                <td className="cell-muted" title={formatDateTime(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}>
                  {event.occurredAt ? formatRelativeTime(event.occurredAt) : t('common.never')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SystemStatus({ checks }: { checks: AdminData['systemChecks'] }) {
  const { t, formatNumber } = useI18n();
  return (
    <ul className="status-list">
      {checks.map(check => {
        const nameKey = `admin.systemChecks.${check.id}.name`;
        const name = isMessageKey(nameKey) ? t(nameKey) : check.id;
        const detailKey = `admin.systemChecks.${check.id}.detail`;
        const legacyCount = Number.parseInt(check.detail, 10);
        const detailCount = check.detailCount ?? (Number.isFinite(legacyCount) ? legacyCount : undefined);
        const detail = isMessageKey(detailKey)
          ? t(detailKey, detailCount == null ? undefined : { count: formatNumber(detailCount) })
          : check.id;
        return (
          <li key={check.id}>
            <span className="status-icon" aria-hidden="true"><Server /></span>
            <span className="status-text">
              <strong>{name}</strong>
              <small>{detail}</small>
            </span>
            <StatusPill value={check.status} />
          </li>
        );
      })}
    </ul>
  );
}

function Connectivity({ data }: { data: AdminData }) {
  const { t, formatNumber } = useI18n();
  const { devices, onlineDevices, quarantinedDevices } = data.stats;
  const offlineDevices = Math.max(0, devices - onlineDevices - quarantinedDevices);
  const percent = (value: number) => (devices ? `${(value / devices) * 100}%` : '0%');
  const onlineRate = devices ? Math.round((onlineDevices / devices) * 100) : 0;
  return (
    <div className="connectivity">
      <p className="connectivity-summary">
        <strong>{formatNumber(onlineRate / 100, { style: 'percent', maximumFractionDigits: 0 })}</strong>
        <span>{t('admin.connectivity.summary', { count: formatNumber(devices) })}</span>
      </p>
      <div
        className="dist-bar"
        role="img"
        aria-label={t('admin.connectivity.distBarAria', {
          online: formatNumber(onlineDevices),
          offline: formatNumber(offlineDevices),
          quarantined: formatNumber(quarantinedDevices)
        })}
      >
        <span className="dist-segment is-online" style={{ width: percent(onlineDevices) }} />
        <span className="dist-segment is-offline" style={{ width: percent(offlineDevices) }} />
        <span className="dist-segment is-quarantine" style={{ width: percent(quarantinedDevices) }} />
      </div>
      <ul className="legend">
        <li><span className="dot is-online" aria-hidden="true" />{t('admin.connectivity.online')}<strong>{formatNumber(onlineDevices)}</strong></li>
        <li><span className="dot is-offline" aria-hidden="true" />{t('admin.connectivity.offline')}<strong>{formatNumber(offlineDevices)}</strong></li>
        <li><span className="dot is-quarantine" aria-hidden="true" />{t('admin.connectivity.quarantined')}<strong>{formatNumber(quarantinedDevices)}</strong></li>
      </ul>
    </div>
  );
}

function Overview({ data, organizations, audit, query, updatingId, onLocaleChange }: {
  data: AdminData; organizations: AdminData['organizations']; audit: AdminData['recentAudit']; query: string; updatingId: string | null; onLocaleChange: (organizationId: string, locale: SupportedLocale) => void;
}) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const onlineRate = data.stats.devices ? Math.round((data.stats.onlineDevices / data.stats.devices) * 100) : 0;
  const availabilityTone: Tone = onlineRate >= 80 ? 'positive' : onlineRate >= 50 ? 'warning' : 'critical';
  return (
    <>
      <section className="metrics">
        <Metric
          icon={Building2}
          tone="neutral"
          label={t('admin.metrics.customers')}
          value={formatNumber(data.stats.customers)}
          caption={t('admin.metrics.resellersCaption', { count: formatNumber(data.stats.resellers) })}
        />
        <Metric
          icon={Radio}
          tone="neutral"
          label={t('admin.metrics.managedDevices')}
          value={formatNumber(data.stats.devices)}
          caption={t('admin.metrics.reportingNowCaption', { count: formatNumber(data.stats.onlineDevices) })}
        />
        <Metric
          icon={Signal}
          tone={availabilityTone}
          label={t('admin.metrics.networkAvailability')}
          value={formatNumber(onlineRate / 100, { style: 'percent', maximumFractionDigits: 0 })}
          caption={t('admin.metrics.networkAvailabilityCaption')}
        />
        <Metric
          icon={AlertTriangle}
          tone={data.stats.openAlerts ? 'warning' : 'positive'}
          label={t('admin.metrics.openIncidents')}
          value={formatNumber(data.stats.openAlerts)}
          caption={t('admin.metrics.quarantinedCaption', { count: formatNumber(data.stats.quarantinedDevices) })}
        />
      </section>
      <section className="admin-grid">
        <Panel overline={t('admin.panels.tenantOperations')} title={t('admin.panels.organizationHealth')} meta={<ResultCount shown={organizations.length} total={data.organizations.length} />} flush>
          <OrganizationTable organizations={organizations} updatingId={updatingId} onLocaleChange={onLocaleChange} />
        </Panel>
        <Panel overline={t('admin.panels.infrastructure')} title={t('admin.panels.systemStatus')}>
          <SystemStatus checks={data.systemChecks} />
        </Panel>
      </section>
      <section className="admin-grid">
        <Panel overline={t('admin.panels.connectivity')} title={t('admin.panels.deviceNetwork')} meta={<span className="meta-note">{t('admin.panels.updatedAt', { time: formatRelativeTime(data.generatedAt) })}</span>}>
          <Connectivity data={data} />
        </Panel>
        <Panel overline={t('admin.panels.securityEvidence')} title={t('admin.panels.auditPulse')} meta={<ResultCount shown={audit.length} total={data.recentAudit.length} />} flush>
          <AuditTable events={audit.slice(0, 6)} emptyMessage={t('admin.audit.emptyMessage')} />
        </Panel>
      </section>
      {query ? <p className="filter-note">{t('admin.overview.filteredBy', { query })}</p> : null}
    </>
  );
}

function DeviceCatalog({ data, query, updatingKey, onAvailabilityChange }: {
  data: DeviceCatalogData;
  query: string;
  updatingKey: string | null;
  onAvailabilityChange: (resellerId: string, protocolProfileId: string, available: boolean) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const profiles = data.profiles.filter(profile => matches(normalized, profile.displayName, profile.vendor, profile.family, profile.transport, profile.frameFormat, profile.implementationStatus));
  const isAvailable = (resellerId: string, profileId: string) => data.availability.some(item => item.resellerOrganizationId === resellerId && item.protocolProfileId === profileId && item.available);
  return (
    <div className="protocol-catalog">
      <div className="protocol-callout">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Runtime support is explicit</strong><p>Only profiles marked Active have a server decoder. Catalog-only entries are documentation and planning references and cannot ingest data or send commands.</p></div>
      </div>
      {profiles.map(profile => (
        <details className="protocol-card surface" key={profile.id} open={profile.implementationStatus === 'ACTIVE'}>
          <summary>
            <span className="protocol-title"><BookOpen aria-hidden="true" /><span><strong>{profile.displayName}</strong><small>{profile.vendor} · {profile.family}</small></span></span>
            <span className={`protocol-support ${profile.implementationStatus === 'ACTIVE' ? 'is-active' : ''}`}>{humanize(profile.implementationStatus)}</span>
          </summary>
          <div className="protocol-body">
            <div className="protocol-facts">
              <span><small>Transport</small><strong><LtrText>{humanize(profile.transport)}</LtrText></strong></span>
              <span><small>Wire format</small><strong><LtrText>{humanize(profile.frameFormat)}</LtrText></strong></span>
              <span><small>Platform API</small><strong>Normalized JSON after decoding</strong></span>
              <a href={profile.documentationUrl} target="_blank" rel="noreferrer">Source reference <ExternalLink aria-hidden="true" /></a>
            </div>
            {profile.notes ? <p className="protocol-note">{profile.notes}</p> : null}
            <h3>Messages sent by the device</h3>
            <div className="table-wrap"><table><thead><tr><th>Message</th><th>Direction</th><th>Meaning</th><th>Example / fields</th></tr></thead><tbody>
              {profile.messageDefinitions.map(message => <tr key={message.id}><td><strong>{message.displayName}</strong><small className="table-code">{message.messageType}</small></td><td>{humanize(message.direction ?? '')}</td><td>{message.description}</td><td><LtrText>{message.example ?? message.fieldSchema?.map(field => String(field.name ?? '')).join(', ') ?? 'Binary fields'}</LtrText></td></tr>)}
            </tbody></table></div>
            <h3>Available device commands</h3>
            <div className="table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th><th>Wire template</th><th>Risk / status</th></tr></thead><tbody>
              {profile.commandDefinitions.map(command => <tr key={command.id}><td><strong>{command.displayName}</strong><small className="table-code">{command.commandKey}</small></td><td>{command.description}</td><td><LtrText>{command.wireTemplate ?? 'Vendor/model specific'}</LtrText></td><td>{humanize(command.riskLevel ?? '')} · {humanize(command.implementationStatus ?? '')}</td></tr>)}
            </tbody></table></div>
            <h3>Reseller availability</h3>
            <div className="protocol-resellers">
              {data.resellers.map(reseller => {
                const key = `${reseller.id}:${profile.id}`;
                return <label key={reseller.id}><input type="checkbox" checked={isAvailable(reseller.id, profile.id)} disabled={updatingKey === key} onChange={event => onAvailabilityChange(reseller.id, profile.id, event.target.checked)} /><span><strong>{reseller.name}</strong><small>{reseller.status}</small></span></label>;
              })}
            </div>
          </div>
        </details>
      ))}
      {!profiles.length ? <EmptyState icon={<Search />} title="No matching device profiles" copy="Try a vendor, family, transport, or support status." /> : null}
    </div>
  );
}

const initialsOf = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');

export default function AdminApp() {
  const { t, formatNumber, formatDateTime, setLocale } = useI18n();
  const [data, setData] = useState<AdminData | null>(null);
  const [resellers, setResellers] = useState<ResellerRecord[]>([]);
  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogData>({ profiles: [], resellers: [], availability: [] });
  const [view, setView] = useState<AdminView>('overview');
  const [query, setQuery] = useState('');
  const [resellerStatusFilter, setResellerStatusFilter] = useState<'ALL' | ResellerStatus>('ALL');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing' | 'error'>('loading');
  const [clock, setClock] = useState(() => Date.now());
  const [updatingLocaleId, setUpdatingLocaleId] = useState<string | null>(null);
  const [localeNoticeKey, setLocaleNoticeKey] = useState<MessageKey | null>(null);
  const [resellerDialog, setResellerDialog] = useState<ResellerRecord | 'create' | null>(null);
  const [resellerMutationState, setResellerMutationState] = useState<'idle' | 'submitting'>('idle');
  const [resellerFormErrorKey, setResellerFormErrorKey] = useState<MessageKey | null>(null);
  const [resellerToast, setResellerToast] = useState<{ name: string; mode: 'created' | 'updated' } | null>(null);
  const [updatingDeviceAvailability, setUpdatingDeviceAvailability] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    setStatus(mode === 'refresh' ? 'refreshing' : 'loading');
    try {
      const [next, session, nextResellers, nextCatalog] = await Promise.all([fetchAdmin(), fetchSession(), fetchResellers(), fetchDeviceCatalog()]);
      setData(next);
      setResellers(nextResellers);
      setDeviceCatalog(nextCatalog);
      setLocale(session.effectiveLocale);
      setErrorKey(null);
      setStatus('ready');
    } catch (cause) {
      setErrorKey(cause instanceof AdminFetchError && cause.code === 'forbidden'
        ? 'admin.state.permissionDenied'
        : 'admin.state.apiUnavailable');
      setStatus('error');
    }
  }, [setLocale]);

  useEffect(() => { void load('initial'); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!resellerToast) return;
    const timer = window.setTimeout(() => setResellerToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [resellerToast]);

  const active = VIEWS.find(item => item.id === view) ?? VIEWS[0];
  const activeLabel = t(`admin.views.${active.id}.label` as MessageKey);
  const activeOverline = t(`admin.views.${active.id}.overline` as MessageKey);
  const activeTitle = t(`admin.views.${active.id}.title` as MessageKey);
  const activeDescription = t(`admin.views.${active.id}.description` as MessageKey);
  const activePlaceholder = t(`admin.views.${active.id}.placeholder` as MessageKey);

  const trimmed = query.trim().toLowerCase();

  const organizations = useMemo(
    () => (data?.organizations ?? []).filter(organization =>
      matches(trimmed, organization.name, organization.resellerName, organization.id, organization.serviceStatus)),
    [data, trimmed]
  );
  const filteredResellers = useMemo(
    () => resellers.filter(reseller =>
      (resellerStatusFilter === 'ALL' || reseller.status === resellerStatusFilter)
      && matches(trimmed, reseller.name, reseller.id, reseller.defaultLocale, reseller.status, ...reseller.capabilities)),
    [resellers, resellerStatusFilter, trimmed]
  );
  const devices = useMemo(
    () => (data?.devices ?? []).filter(device =>
      matches(trimmed, device.serial, device.model, device.radio, device.custodyOrganizationName, device.status, device.signalQuality)),
    [data, trimmed]
  );
  const incidents = useMemo(
    () => devices.filter(device => ['OFFLINE', 'QUARANTINED'].includes(device.status)),
    [devices]
  );
  const audit = useMemo(
    () => (data?.recentAudit ?? []).filter(event =>
      matches(trimmed, event.action, event.actorName, event.resourceType, event.outcome)),
    [data, trimmed]
  );

  const selectView = (next: AdminView) => { setView(next); setQuery(''); };

  const openResellerDialog = (reseller: ResellerRecord | 'create') => {
    setResellerFormErrorKey(null);
    setResellerDialog(reseller);
  };

  const submitReseller = async (input: ResellerInput) => {
    const existing = resellerDialog === 'create' ? undefined : resellerDialog ?? undefined;
    setResellerMutationState('submitting');
    setResellerFormErrorKey(null);
    try {
      const saved = await saveReseller(input, existing?.id);
      setResellers(current => existing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved].sort((left, right) => left.name.localeCompare(right.name)));
      setResellerDialog(null);
      setResellerToast({ name: saved.name, mode: existing ? 'updated' : 'created' });
      setData(current => current && !existing ? { ...current, stats: { ...current.stats, resellers: current.stats.resellers + 1 } } : current);
    } catch (cause) {
      setResellerFormErrorKey(cause instanceof AdminFetchError && cause.code === 'duplicate'
        ? 'admin.resellers.duplicateError'
        : cause instanceof AdminFetchError && cause.code === 'forbidden'
          ? 'admin.resellers.permissionError'
          : cause instanceof AdminFetchError && cause.code === 'invalid'
            ? 'admin.resellers.validationError'
            : 'admin.resellers.saveError');
    } finally {
      setResellerMutationState('idle');
    }
  };

  const changeOrganizationLocale = async (organizationId: string, defaultLocale: SupportedLocale) => {
    setUpdatingLocaleId(organizationId);
    setLocaleNoticeKey(null);
    try {
      const settings = await updateOrganizationLocale(organizationId, defaultLocale);
      setData(current => current ? {
        ...current,
        organizations: current.organizations.map(organization => organization.id === organizationId ? { ...organization, defaultLocale: settings.defaultLocale } : organization)
      } : current);
      setLocaleNoticeKey('admin.organizations.languageSaved');
    } catch {
      setLocaleNoticeKey('admin.organizations.languageFailed');
    } finally {
      setUpdatingLocaleId(null);
    }
  };

  const changeDeviceAvailability = async (resellerId: string, protocolProfileId: string, available: boolean) => {
    const key = `${resellerId}:${protocolProfileId}`;
    setUpdatingDeviceAvailability(key);
    try {
      const saved = await saveDeviceAvailability(resellerId, protocolProfileId, available);
      setDeviceCatalog(current => ({
        ...current,
        availability: [...current.availability.filter(item => !(item.resellerOrganizationId === resellerId && item.protocolProfileId === protocolProfileId)), saved]
      }));
    } catch {
      setErrorKey('admin.state.apiUnavailable');
    } finally {
      setUpdatingDeviceAvailability(null);
    }
  };

  return (
    <div className="portal-shell admin-shell">
      <DashboardSidebar className="admin-nav">
        <div className="logo">
          <span><ShieldCheck /></span>
          <div><strong>{t('admin.brand.title')}</strong><small>{t('admin.brand.subtitle')}</small></div>
        </div>
        <div className="org-select admin-plane"><small>{t('admin.nav.planeBadge')}</small><strong>{t('admin.nav.operationsTitle')}</strong></div>
        <nav aria-label={t('admin.nav.sectionsAria')}>
          {VIEWS.map(item => {
            const itemLabel = t(`admin.views.${item.id}.label` as MessageKey);
            return (
              <button
                key={item.id}
                type="button"
                className={item.id === view ? 'active' : ''}
                aria-current={item.id === view ? 'page' : undefined}
                onClick={() => selectView(item.id)}
              >
                <item.icon aria-hidden="true" />
                {itemLabel}
                {item.id === 'incidents' && data?.stats.openAlerts ? <b>{formatNumber(data.stats.openAlerts)}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="nav-bottom">
          <div className="user-card">
            <span className="avatar reseller" aria-hidden="true">{data?.actor?.name ? initialsOf(data.actor.name) : '—'}</span>
            <span>
              <strong>{data?.actor?.name ?? t('admin.nav.defaultActorName')}</strong>
              <small>{data?.actor?.email ? <LtrText>{data.actor.email}</LtrText> : t('admin.nav.sessionPending')}</small>
            </span>
          </div>
          <div className="privacy-status">
            <LockKeyhole aria-hidden="true" />
            <div>
              <strong>{t('admin.nav.isolatedPlaneTitle')}</strong>
              <small>{t('admin.nav.coordinatesExcludedDesc')}</small>
            </div>
          </div>
        </div>
      </DashboardSidebar>
      <div className="portal-main admin-main">
        <DashboardTopbar>
          <div><span>{t('admin.header.eyebrow')}</span><h2>{activeLabel}</h2></div>
          <div className="header-tools">
            <DashboardSearch icon={<Search aria-hidden="true" />} value={query} onChange={setQuery} placeholder={activePlaceholder} />
            <button
              type="button"
              className={status === 'refreshing' ? 'outline is-busy' : 'outline'}
              onClick={() => void load('refresh')}
              disabled={status === 'refreshing'}
              title={t('admin.header.refreshTitle')}
              aria-label={t('admin.header.refreshTitle')}
            >
              <RefreshCw aria-hidden="true" />
            </button>
            <span className="clock">
              <Clock aria-hidden="true" />
              {t('admin.header.utcTime', {
                time: formatDateTime(clock, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
              })}
            </span>
          </div>
        </DashboardTopbar>

        <main className="portal-content admin-content">
          <WorkspaceRail view={view} />
          <section className="page-head">
            <div className="page-head-main">
              <p className="overline">{activeOverline}</p>
              <h1>{activeTitle}</h1>
              <p className="page-copy">{activeDescription}</p>
            </div>
            <div className="page-head-side">
              {data ? <span className="boundary-chip"><LockKeyhole aria-hidden="true" />{t('admin.pageHead.coordinatesExcluded')}</span> : null}
              <span className="meta-note">{t('admin.pageHead.generatedAt', { time: data ? formatDateTime(data.generatedAt) : '—' })}</span>
            </div>
          </section>

          {errorKey ? (
            <div className="banner" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{t(errorKey)}</span>
              <button type="button" onClick={() => void load('refresh')}>{t('admin.actions.retry')}</button>
            </div>
          ) : null}

          {localeNoticeKey ? <div className={localeNoticeKey.endsWith('Failed') ? 'banner' : 'banner success'} role={localeNoticeKey.endsWith('Failed') ? 'alert' : 'status'}><span>{t(localeNoticeKey)}</span></div> : null}

          {!data ? (
            <div className="state-block" aria-live="polite">
              {status === 'error' ? <AlertTriangle aria-hidden="true" /> : <Activity className="spin" aria-hidden="true" />}
              <span>{status === 'error' ? t('admin.state.dataUnavailable') : t('admin.state.loadingOperations')}</span>
            </div>
          ) : (
            <>
              {view === 'overview' && <Overview data={data} organizations={organizations} audit={audit} query={query.trim()} updatingId={updatingLocaleId} onLocaleChange={changeOrganizationLocale} />}

              {view === 'resellers' && (
                <Panel
                  overline={t('admin.resellers.overline')}
                  title={t('admin.resellers.panelTitle')}
                  meta={<ResultCount shown={filteredResellers.length} total={resellers.length} />}
                  flush
                >
                  <div className="reseller-toolbar">
                    <DashboardSearch className="reseller-search" icon={<Search aria-hidden="true" />} value={query} onChange={setQuery} placeholder={t('admin.views.resellers.placeholder')} />
                    <label className="filter-field">
                      <span>{t('admin.resellers.statusFilter')}</span>
                      <select value={resellerStatusFilter} onChange={event => setResellerStatusFilter(event.target.value as 'ALL' | ResellerStatus)}>
                        <option value="ALL">{t('admin.resellers.allStatuses')}</option>
                        <option value="ACTIVE">{t('status.ACTIVE')}</option>
                        <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
                      </select>
                    </label>
                    <button type="button" className="primary reseller-create" onClick={() => openResellerDialog('create')}><Plus aria-hidden="true" />{t('admin.resellers.createAction')}</button>
                  </div>
                  <ResellerTable resellers={filteredResellers} onEdit={openResellerDialog} />
                </Panel>
              )}

              {view === 'organizations' && (
                <Panel overline={t('admin.organizations.overline')} title={t('admin.organizations.panelTitle')} meta={<ResultCount shown={organizations.length} total={data.organizations.length} />} flush>
                  <OrganizationTable organizations={organizations} updatingId={updatingLocaleId} onLocaleChange={changeOrganizationLocale} />
                </Panel>
              )}

              {view === 'devices' && (
                <Panel overline={t('admin.devices.overline')} title={t('admin.devices.panelTitle')} meta={<ResultCount shown={devices.length} total={data.devices.length} />} flush>
                  <DeviceTable devices={devices} />
                </Panel>
              )}

              {view === 'catalog' && (
                <DeviceCatalog data={deviceCatalog} query={query} updatingKey={updatingDeviceAvailability} onAvailabilityChange={(resellerId, profileId, available) => void changeDeviceAvailability(resellerId, profileId, available)} />
              )}

              {view === 'incidents' && (
                <section className="admin-grid incidents-grid">
                  <Panel overline={t('admin.incidents.overline')} title={t('admin.incidents.panelTitle')} meta={<ResultCount shown={incidents.length} total={data.devices.length} />} flush>
                    <DeviceTable devices={incidents} emptyMessage={t('admin.incidents.emptyMessage')} />
                  </Panel>
                  <aside className="surface guardrail">
                    <span className="guardrail-icon" aria-hidden="true"><LockKeyhole /></span>
                    <h2>{t('admin.guardrail.title')}</h2>
                    <p>{t('admin.guardrail.body')}</p>
                    <p className="guardrail-note"><ShieldCheck aria-hidden="true" />{t('admin.guardrail.note')}</p>
                  </aside>
                </section>
              )}

              {view === 'audit' && (
                <Panel overline={t('admin.audit.overline')} title={t('admin.audit.panelTitle')} meta={<ResultCount shown={audit.length} total={data.recentAudit.length} />} flush>
                  <AuditTable events={audit} emptyMessage={t('admin.audit.emptyMessage')} />
                </Panel>
              )}

              {view === 'onboarding' && <OnboardingLibrary />}
            </>
          )}

          <footer className="footer">
            <span>{t('admin.footer.brand')}</span>
            <span className="footer-boundary">{t('admin.footer.defaultBoundary')}</span>
          </footer>
        </main>
      </div>
      {resellerDialog ? (
        <ResellerDialog
          key={resellerDialog === 'create' ? 'create' : resellerDialog.id}
          reseller={resellerDialog === 'create' ? null : resellerDialog}
          submitting={resellerMutationState === 'submitting'}
          errorKey={resellerFormErrorKey}
          onDismiss={() => { if (resellerMutationState !== 'submitting') setResellerDialog(null); }}
          onSubmit={input => void submitReseller(input)}
        />
      ) : null}
      {resellerToast ? (
        <Toast
          title={t(resellerToast.mode === 'created' ? 'admin.resellers.createdToastTitle' : 'admin.resellers.updatedToastTitle')}
          message={t(resellerToast.mode === 'created' ? 'admin.resellers.createdToastMessage' : 'admin.resellers.updatedToastMessage', { name: resellerToast.name })}
          icon={<CheckCircle2 />}
          onDismiss={() => setResellerToast(null)}
        />
      ) : null}
    </div>
  );
}
