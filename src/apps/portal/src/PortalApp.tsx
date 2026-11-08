import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { EmptyState, LtrText, MetricCard, SectionTitle, StatusPill, Toast, createI18n, isMessageKey, statusTone, useI18n, type MessageKey, type SupportedLocale } from '@sentinel/ui';
import {
  Activity, AlertCircle, Bell, CarFront, ChevronDown, CircleHelp, Eye, Gauge, KeyRound,
  LayoutDashboard, LockKeyhole, Map, Menu, Radio, RefreshCw, Route, Search, ShieldCheck,
  Signal, UserRound, UsersRound, X, Plus, Check, ArrowLeft, LoaderCircle, Building2, Pencil, AlertTriangle, LockKeyholeOpen, Archive, RotateCcw, Link2, Unlink, History
} from 'lucide-react';
import LiveMap from './LiveMap';
import { VehicleTelematicsDialog } from './VehicleTelematicsDialog';
import type { AlertItem, CustomerLifecycle, Dashboard, DeviceAssignmentHistory, DeviceInventoryItem, Grant, ManagedCustomer, ManagedCustomerInput, MarkerColor, MarkerSize, MarkerStyle, NewVehicleInput, PortalView, Session, Vehicle, VehicleKind, VehicleUpdateInput } from './types';
import { MARKER_COLORS, MARKER_SIZES, MARKER_STYLES, VEHICLE_TYPES, markerColorHex, vehicleType } from './vehicleAppearance';

const CUSTOMER = 'user-customer-admin';
const RESELLER_ADMIN = 'user-reseller-admin';
const RESELLER_SUPPORT = 'user-reseller-support';
type MutationState = 'idle' | 'submitting' | 'success' | 'error';
type CreatedVehicle = Pick<Vehicle, 'id' | 'name' | 'plate' | 'kind' | 'markerStyle' | 'markerColor' | 'markerSize'>;
interface VehicleToast { id: string; name: string; markerLabel: string }
interface VehicleCreateError { message: string; field?: 'plate' }
interface CustomerToast { kind: 'created' | 'updated'; name: string }
interface VehicleLifecycleToast { kind: 'updated' | 'archived' | 'restored'; name: string }
interface DeviceToast { kind: 'assigned' | 'unassigned'; serial: string }

const CUSTOMER_NAV = [
  { id: 'overview', labelKey: 'portal.nav.overview', icon: LayoutDashboard },
  { id: 'map', labelKey: 'portal.nav.map', icon: Map },
  { id: 'vehicles', labelKey: 'portal.nav.vehicles', icon: CarFront },
  { id: 'devices', labelKey: 'portal.nav.devices', icon: Radio },
  { id: 'alerts', labelKey: 'portal.nav.alerts', icon: Bell },
  { id: 'privacy', labelKey: 'portal.nav.privacy', icon: KeyRound }
] as const;

const RESELLER_NAV = [
  { id: 'overview', labelKey: 'portal.nav.serviceDesk', icon: LayoutDashboard },
  { id: 'map', labelKey: 'portal.nav.grantedMap', icon: Map },
  { id: 'vehicles', labelKey: 'portal.nav.customerFleet', icon: CarFront },
  { id: 'devices', labelKey: 'portal.nav.deviceHealth', icon: Radio },
  { id: 'alerts', labelKey: 'portal.nav.supportAlerts', icon: Bell }
] as const;

const RESELLER_ADMIN_NAV = [
  { id: 'customers', labelKey: 'portal.nav.customers', icon: Building2 },
  ...RESELLER_NAV
] as const;

class ApiRequestError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, actorId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', 'x-demo-actor': actorId, ...(init?.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ApiRequestError(payload?.error?.message || 'Request failed.', payload?.error?.code);
  return payload as T;
}

const tone = (value?: string) => statusTone(value || '');

function StatusText({ value }: { value: string }) {
  const { t } = useI18n();
  const key = `status.${value}`;
  return <>{isMessageKey(key) ? t(key) : value}</>;
}

function WorkspaceRail({ isCustomer, view }: { isCustomer: boolean; view: PortalView }) {
  const { formatDate, t } = useI18n();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset - 3);
    return { day: formatDate(date, { weekday: 'short' }), date: formatDate(date, { day: '2-digit' }), key: date.toISOString(), active: offset === 3 };
  });
  const modes = isCustomer
    ? [
        { id: 'fleet', label: t('portal.workspaceRail.fleetView') },
        { id: 'live', label: t('portal.workspaceRail.live') },
        { id: 'alerts', label: t('portal.workspaceRail.alerts') },
        { id: 'privacy', label: t('portal.workspaceRail.privacy') }
      ]
    : [
        { id: 'customer', label: t('portal.workspaceRail.customer') },
        { id: 'grantedMap', label: t('portal.workspaceRail.grantedMap') },
        { id: 'health', label: t('portal.workspaceRail.health') },
        { id: 'alerts', label: t('portal.workspaceRail.alerts') }
      ];
  const activeModeId = view === 'overview'
    ? (isCustomer ? 'live' : 'customer')
    : view === 'map'
      ? (isCustomer ? 'fleet' : 'grantedMap')
      : view === 'alerts'
        ? 'alerts'
        : view === 'privacy'
          ? 'privacy'
          : 'health';

  return (
    <div className="workspace-rail" aria-label={t('portal.workspaceRail.timelineAria')}>
      <span className="rail-back" aria-hidden="true">←</span>
      <div className="rail-days">
        {days.map(day => (
          <span className={day.active ? 'rail-day active' : 'rail-day'} key={day.key}>
            <small>{day.day}</small>
            <b>{day.date}</b>
          </span>
        ))}
      </div>
      <div className="rail-modes">
        {modes.map(mode => (
          <span className={mode.id === activeModeId ? 'active' : ''} key={mode.id}>
            {mode.label}
            {mode.id === 'live' || mode.id === 'health' ? ' ✓' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function VehicleList({ vehicles, isCustomer = true, archived = false, onEdit, onLifecycle, onTelematics }: { vehicles: Vehicle[]; isCustomer?: boolean; archived?: boolean; onEdit?: (vehicle: Vehicle) => void; onLifecycle?: (vehicle: Vehicle) => void; onTelematics?: (vehicle: Vehicle) => void }) {
  const { t, formatDateTime, formatNumber, formatRelativeTime } = useI18n();
  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<CarFront />}
        title={archived ? t('portal.vehicles.archivedEmptyTitle') : isCustomer ? t('portal.vehicles.emptyTitle') : t('portal.vehicles.resellerEmptyTitle')}
        copy={archived ? t('portal.vehicles.archivedEmptyCopy') : isCustomer ? t('portal.vehicles.emptyCopy') : t('portal.vehicles.resellerEmptyCopy')}
      />
    );
  }
  return (
    <div className="vehicle-list">
      {vehicles.map(vehicle => {
        const Icon = vehicleType(vehicle.kind).icon;
        const kindLabel = t(`portal.vehicleTypes.${vehicle.kind}` as MessageKey).toLowerCase();
        const speedText = vehicle.location
          ? t('portal.vehicles.speedKph', { speed: formatNumber(vehicle.location.speedKph) })
          : (isCustomer ? t('portal.vehicles.privateSpeed') : t('portal.vehicles.resellerNoLocation'));
        const batteryText = vehicle.device
          ? t('portal.vehicles.batteryPercent', { percent: formatNumber(vehicle.device.batteryPercent) })
          : t('common.notApplicable');
        const lastReportText = vehicle.device?.lastCommunicationAt
          ? formatRelativeTime(vehicle.device.lastCommunicationAt)
          : t('common.never');
        return (
          <article className={`vehicle-line${onLifecycle || onTelematics ? ' manageable' : ''}`} id={`vehicle-${vehicle.id}`} tabIndex={-1} key={vehicle.id}>
            <div className="vehicle-photo"><Icon /></div>
            <div className="vehicle-name"><strong>{vehicle.name}</strong><span><LtrText>{vehicle.plate}</LtrText> · {kindLabel}</span></div>
            <StatusPill value={archived ? 'ARCHIVED' : vehicle.device?.status || 'UNASSIGNED'} />
            <div className="vehicle-reading"><span>{t('portal.vehicles.speed')}</span><strong>{speedText}</strong></div>
            <div className="vehicle-reading"><span>{t('portal.vehicles.battery')}</span><strong>{batteryText}</strong></div>
            <div className="vehicle-reading"><span>{t('portal.vehicles.lastReport')}</span><strong>{lastReportText}</strong></div>
            {archived && vehicle.archivedAt && <div className="vehicle-archived-at">{t('portal.vehicles.archivedAt', { date: formatDateTime(vehicle.archivedAt) })}</div>}
            {(onLifecycle || onTelematics) && (
              <div className="vehicle-actions">
                {!archived && vehicle.device && onTelematics && (
                  <button className="outline" onClick={() => onTelematics(vehicle)} title="Coban GPS 303FG Controls">
                    <Radio />
                    Telematics
                  </button>
                )}
                {!archived && onEdit && <button className="outline" onClick={() => onEdit(vehicle)}><Pencil />{t('portal.vehicles.editButton')}</button>}
                {onLifecycle && <button className="outline" onClick={() => onLifecycle(vehicle)}>{archived ? <RotateCcw /> : <Archive />}{t(archived ? 'portal.vehicles.restoreButton' : 'portal.vehicles.archiveButton')}</button>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function MarkerSample({ style, kind, color, size = 'MEDIUM' }: { style: MarkerStyle; kind: VehicleKind; color: MarkerColor; size?: MarkerSize }) {
  const Icon = vehicleType(kind).icon;
  return <span className={`marker-sample style-${style.toLowerCase().replace('_', '-')} size-${size.toLowerCase()}`} style={{ '--marker-color': markerColorHex[color] } as CSSProperties}>{style !== 'DOT' && <Icon />}</span>;
}

function VehicleStudio({ open, delegated, createState, createError, organizationId, onClose, onCreate, onClearError }: { open: boolean; delegated: boolean; createState: MutationState; createError: VehicleCreateError | null; organizationId: string; onClose: () => void; onCreate: (input: NewVehicleInput) => Promise<void>; onClearError: () => void }) {
  const { t, formatNumber } = useI18n();
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [kind, setKind] = useState<VehicleKind>('CAR');
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('DOT');
  const [markerColor, setMarkerColor] = useState<MarkerColor>('BLUE');
  const [markerSize, setMarkerSize] = useState<MarkerSize>('MEDIUM');
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = createState === 'submitting';

  useEffect(() => { if (open) { setName(''); setPlate(''); setKind('CAR'); setMarkerStyle('DOT'); setMarkerColor('BLUE'); setMarkerSize('MEDIUM'); } }, [open]);
  useEffect(() => { if (open && createState === 'error' && createError) errorRef.current?.focus(); }, [open, createState, createError]);
  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onCreate({ organizationId, name, plate, kind, markerStyle, markerColor, markerSize });
  };

  const currentMarkerStyleLabel = t(`portal.markerStyles.${markerStyle}.label` as MessageKey);
  const currentKindLabel = t(`portal.vehicleTypes.${kind}` as MessageKey);
  const currentMarkerSizeLabel = t(`portal.markerSizes.${markerSize}` as MessageKey).toLowerCase();

  return (
    <div className="vehicle-studio-backdrop" role="presentation" onMouseDown={event => { if (!submitting && event.target === event.currentTarget) onClose(); }}>
      <form className="vehicle-studio" role="dialog" aria-modal="true" aria-labelledby="vehicle-studio-title" aria-busy={submitting} onSubmit={submit}>
        <header className="vehicle-studio-head">
          <div>
            <span>{t(delegated ? 'portal.vehicleStudio.resellerEyebrow' : 'portal.vehicleStudio.eyebrow')}</span>
            <h2 id="vehicle-studio-title">{t(delegated ? 'portal.vehicleStudio.resellerTitle' : 'portal.vehicleStudio.title')}</h2>
          </div>
          <div>
            <button type="button" className="outline" onClick={onClose} disabled={submitting}>{t('portal.vehicleStudio.cancel')}</button>
            <button className="primary" disabled={submitting || name.trim().length < 2 || plate.trim().length < 2}>
              {submitting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {submitting ? t('portal.vehicleStudio.creatingButton') : t('portal.vehicleStudio.createButton')}
            </button>
          </div>
        </header>
        <p className="sr-only" role="status" aria-live="polite">
          {submitting ? t('portal.vehicleStudio.submittingStatus') : createState === 'success' ? t('portal.vehicleStudio.successStatus') : createState === 'error' ? t('portal.vehicleStudio.errorStatus') : ''}
        </p>
        <ol className="vehicle-steps" aria-label={t('portal.vehicleStudio.stepsAriaLabel')}>
          <li><span><Check /></span>{t('portal.vehicleStudio.stepDetails')}</li>
          <i />
          <li><span><Check /></span>{t('portal.vehicleStudio.stepVehicleType')}</li>
          <i className="active" />
          <li className="active"><span>3</span>{t('portal.vehicleStudio.stepMapAppearance')}</li>
        </ol>
        <div className="vehicle-studio-grid">
          <div className="vehicle-studio-controls">
            {createError && (
              <div className="vehicle-form-error" role="alert" tabIndex={-1} ref={errorRef}>
                <AlertCircle aria-hidden="true" />
                <div>
                  <strong>{t('portal.vehicleStudio.errorTitle')}</strong>
                  <span>{createError.message}</span>
                </div>
              </div>
            )}
            <section>
              <div className="studio-section-title">
                <div>
                  <h3>{t('portal.vehicleStudio.section1Title')}</h3>
                  <p>{t(delegated ? 'portal.vehicleStudio.resellerSection1Subtitle' : 'portal.vehicleStudio.section1Subtitle')}</p>
                </div>
              </div>
              <div className="vehicle-fields">
                <label>
                  {t('portal.vehicleStudio.nameLabel')}
                  <input
                    value={name}
                    onChange={event => { setName(event.target.value); if (createError) onClearError(); }}
                    placeholder={t('portal.vehicleStudio.namePlaceholder')}
                    required
                    minLength={2}
                    maxLength={80}
                    autoFocus
                  />
                </label>
                <label>
                  {t('portal.vehicleStudio.plateLabel')}
                  <input
                    dir="ltr"
                    value={plate}
                    onChange={event => { setPlate(event.target.value.toUpperCase()); if (createError) onClearError(); }}
                    placeholder={t('portal.vehicleStudio.platePlaceholder')}
                    required
                    minLength={2}
                    maxLength={24}
                    aria-invalid={createError?.field === 'plate'}
                    aria-describedby={createError?.field === 'plate' ? 'vehicle-plate-error' : undefined}
                  />
                  {createError?.field === 'plate' && (
                    <span className="vehicle-field-error" id="vehicle-plate-error">
                      {t('portal.vehicleStudio.duplicatePlateError')}
                    </span>
                  )}
                </label>
              </div>
            </section>
            <section>
              <div className="studio-section-title">
                <div>
                  <h3>{t('portal.vehicleStudio.section2Title')}</h3>
                  <p>{t('portal.vehicleStudio.section2Subtitle')}</p>
                </div>
                <span>{t('portal.vehicleStudio.typesCount', { count: formatNumber(VEHICLE_TYPES.length) })}</span>
              </div>
              <div className="vehicle-type-grid" role="radiogroup" aria-label={t('portal.vehicleStudio.vehicleTypeAria')}>
                {VEHICLE_TYPES.map(type => (
                  <button
                    type="button"
                    key={type.id}
                    aria-pressed={kind === type.id}
                    className={kind === type.id ? 'selected' : ''}
                    onClick={() => { setKind(type.id); if (createError) onClearError(); }}
                  >
                    <type.icon />
                    {kind === type.id && <i><Check /></i>}
                    <strong>{t(`portal.vehicleTypes.${type.id}` as MessageKey)}</strong>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="studio-section-title">
                <div>
                  <h3>{t('portal.vehicleStudio.section3Title')}</h3>
                  <p>{t('portal.vehicleStudio.section3Subtitle')}</p>
                </div>
                <span className="preview-label"><Eye />{t('portal.vehicleStudio.livePreviewBadge')}</span>
              </div>
              <div className="marker-style-grid" role="radiogroup" aria-label={t('portal.vehicleStudio.markerStyleAria')}>
                {MARKER_STYLES.map(style => (
                  <button
                    type="button"
                    key={style.id}
                    aria-pressed={markerStyle === style.id}
                    className={markerStyle === style.id ? 'selected' : ''}
                    onClick={() => { setMarkerStyle(style.id); if (createError) onClearError(); }}
                  >
                    <MarkerSample style={style.id} kind={kind} color={markerColor} size={markerSize} />
                    {style.id === 'DOT' && <i>{t('portal.vehicleStudio.defaultBadge')}</i>}
                    <strong>{t(`portal.markerStyles.${style.id}.label` as MessageKey)}</strong>
                    <small>{t(`portal.markerStyles.${style.id}.copy` as MessageKey)}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="vehicle-preview-panel">
            <div className="preview-heading">
              <div>
                <h3>{t('portal.vehicleStudio.mapPreviewTitle')}</h3>
                <p>{currentMarkerStyleLabel} · {currentKindLabel} · {currentMarkerSizeLabel}</p>
              </div>
            </div>
            <div className="vehicle-preview-map">
              <span className="preview-live"><i />{t('portal.vehicleStudio.previewUpdatesInstantly')}</span>
              <div className="preview-marker">
                <MarkerSample style={markerStyle} kind={kind} color={markerColor} size={markerSize} />
                <strong>{name || t('portal.vehicleStudio.defaultVehicleName')}</strong>
              </div>
              <small>{t('portal.vehicleStudio.osmAttribution')}</small>
            </div>
            <div className="appearance-controls">
              <fieldset>
                <legend>{t('portal.vehicleStudio.markerColorLegend')}</legend>
                <div>
                  {MARKER_COLORS.map(color => (
                    <button
                      type="button"
                      key={color}
                      aria-label={t('portal.vehicleStudio.markerColorAria', { color: t(`portal.markerColors.${color}` as MessageKey) })}
                      aria-pressed={markerColor === color}
                      className={markerColor === color ? 'selected' : ''}
                      style={{ background: markerColorHex[color] }}
                      onClick={() => { setMarkerColor(color); if (createError) onClearError(); }}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t('portal.vehicleStudio.markerSizeLegend')}</legend>
                <div className="marker-size-control">
                  {MARKER_SIZES.map(size => (
                    <button
                      type="button"
                      key={size}
                      className={markerSize === size ? 'selected' : ''}
                      onClick={() => { setMarkerSize(size); if (createError) onClearError(); }}
                    >
                      {size[0]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="vehicle-ready">
              <span><MarkerSample style={markerStyle} kind={kind} color={markerColor} size="SMALL" /></span>
              <div>
                <strong>{name || t('portal.vehicleStudio.defaultVehicleName')}</strong>
                <small>{plate ? <LtrText>{plate}</LtrText> : t('portal.vehicleStudio.defaultPlate')} · {currentKindLabel} · {currentMarkerStyleLabel}</small>
              </div>
              <b>{t('portal.vehicleStudio.readyBadge')}</b>
            </div>
            <footer>
              <button type="button" onClick={onClose} disabled={submitting}>
                <ArrowLeft />{t('portal.vehicleStudio.backToVehicles')}
              </button>
              <span><ShieldCheck />{t(delegated ? 'portal.vehicleStudio.resellerLocationPrivacyUnchanged' : 'portal.vehicleStudio.locationPrivacyUnchanged')}</span>
            </footer>
          </aside>
        </div>
      </form>
    </div>
  );
}

function VehicleEditDialog({ vehicle, submitting, errorKey, onDismiss, onSubmit }: { vehicle: Vehicle; submitting: boolean; errorKey: MessageKey | null; onDismiss: () => void; onSubmit: (input: VehicleUpdateInput) => void }) {
  const { t } = useI18n();
  const [values, setValues] = useState<VehicleUpdateInput>({ name: vehicle.name, plate: vehicle.plate, kind: vehicle.kind, markerStyle: vehicle.markerStyle, markerColor: vehicle.markerColor, markerSize: vehicle.markerSize });
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (errorKey) errorRef.current?.focus(); }, [errorKey]);
  const update = <K extends keyof VehicleUpdateInput>(key: K, value: VehicleUpdateInput[K]) => setValues(current => ({ ...current, [key]: value }));
  return (
    <div className="management-dialog-backdrop" role="presentation" onMouseDown={event => { if (!submitting && event.target === event.currentTarget) onDismiss(); }}>
      <form className="management-dialog vehicle-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-edit-title" aria-busy={submitting} onSubmit={event => { event.preventDefault(); onSubmit(values); }}>
        <header><div><span>{t('portal.vehicles.directoryEyebrow')}</span><h2 id="vehicle-edit-title">{t('portal.vehicles.editTitle', { name: vehicle.name })}</h2><p>{t('portal.vehicles.editDescription')}</p></div><button type="button" className="icon-button" aria-label={t('common.close')} onClick={onDismiss} disabled={submitting}><X /></button></header>
        {errorKey && <div className="management-error" role="alert" tabIndex={-1} ref={errorRef}><AlertCircle /><span>{t(errorKey)}</span></div>}
        <div className="management-form-grid">
          <label>{t('portal.vehicles.nameLabel')}<input value={values.name} minLength={2} maxLength={80} required autoFocus onChange={event => update('name', event.target.value)} /></label>
          <label>{t('portal.vehicles.plateLabel')}<input dir="ltr" value={values.plate} minLength={2} maxLength={24} required onChange={event => update('plate', event.target.value.toUpperCase())} /></label>
          <label>{t('portal.vehicles.typeLabel')}<select value={values.kind} onChange={event => update('kind', event.target.value as VehicleKind)}>{VEHICLE_TYPES.map(type => <option key={type.id} value={type.id}>{t(`portal.vehicleTypes.${type.id}` as MessageKey)}</option>)}</select></label>
          <label>{t('portal.vehicles.markerStyleLabel')}<select value={values.markerStyle} onChange={event => update('markerStyle', event.target.value as MarkerStyle)}>{MARKER_STYLES.map(style => <option key={style.id} value={style.id}>{t(`portal.markerStyles.${style.id}.label` as MessageKey)}</option>)}</select></label>
          <label>{t('portal.vehicles.markerColorLabel')}<select value={values.markerColor} onChange={event => update('markerColor', event.target.value as MarkerColor)}>{MARKER_COLORS.map(color => <option key={color} value={color}>{t(`portal.markerColors.${color}` as MessageKey)}</option>)}</select></label>
          <label>{t('portal.vehicles.markerSizeLabel')}<select value={values.markerSize} onChange={event => update('markerSize', event.target.value as MarkerSize)}>{MARKER_SIZES.map(size => <option key={size} value={size}>{t(`portal.markerSizes.${size}` as MessageKey)}</option>)}</select></label>
        </div>
        <footer><button type="button" className="outline" onClick={onDismiss} disabled={submitting}>{t('common.cancel')}</button><button className="primary" disabled={submitting || values.name.trim().length < 2 || values.plate.trim().length < 2}>{submitting && <LoaderCircle className="spin" />}{submitting ? t('common.saving') : t('portal.vehicles.saveButton')}</button></footer>
      </form>
    </div>
  );
}

function VehicleLifecycleDialog({ vehicle, restore, submitting, onDismiss, onConfirm }: { vehicle: Vehicle; restore: boolean; submitting: boolean; onDismiss: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  return (
    <div className="management-dialog-backdrop" role="presentation" onMouseDown={event => { if (!submitting && event.target === event.currentTarget) onDismiss(); }}>
      <div className="management-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="vehicle-lifecycle-title" aria-describedby="vehicle-lifecycle-description">
        <header><div><span>{restore ? t('portal.vehicles.archivedFilter') : t('portal.vehicles.activeFilter')}</span><h2 id="vehicle-lifecycle-title">{t(restore ? 'portal.vehicles.restoreTitle' : 'portal.vehicles.archiveTitle', { name: vehicle.name })}</h2></div></header>
        <p id="vehicle-lifecycle-description">{t(restore ? 'portal.vehicles.restoreDescription' : 'portal.vehicles.archiveDescription')}</p>
        <footer><button className="outline" onClick={onDismiss} disabled={submitting}>{t('common.cancel')}</button><button className="primary" onClick={onConfirm} disabled={submitting}>{submitting && <LoaderCircle className="spin" />}{t(restore ? 'portal.vehicles.restoreConfirm' : 'portal.vehicles.archiveConfirm')}</button></footer>
      </div>
    </div>
  );
}

function AlertList({ alerts, isCustomer = true }: { alerts: AlertItem[]; isCustomer?: boolean }) {
  const { t, formatRelativeTime } = useI18n();
  if (!alerts.length) {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title={isCustomer ? t('portal.alerts.allClearTitle') : t('portal.alerts.resellerAllClearTitle')}
        copy={isCustomer ? t('portal.alerts.allClearSubtitle') : t('portal.alerts.resellerAllClearSubtitle')}
      />
    );
  }
  return (
    <div className="alert-stack">
      {alerts.map(alert => {
        const alertTypeKey = `portal.alertTypes.${alert.type}`;
        const summary = isMessageKey(alertTypeKey) ? t(alertTypeKey) : alert.summary;
        return (
          <article className="alert-line" key={alert.id}>
            <span className={`alert-symbol ${tone(alert.severity)}`}><AlertCircle /></span>
            <div><strong>{summary}</strong><p>{alert.vehicleName} · {formatRelativeTime(alert.occurredAt)}</p></div>
            <StatusPill value={alert.severity} />
          </article>
        );
      })}
    </div>
  );
}

function Overview({ data, isCustomer, actorName, onTelematics }: { data: Dashboard; isCustomer: boolean; actorName: string; onTelematics?: (vehicle: Vehicle) => void }) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const featured = data.vehicles.find(vehicle => vehicle.location) || data.vehicles[0];
  return (
    <>
      <div className="welcome">
        <div>
          <span>{isCustomer ? t('portal.welcome.customerEyebrow') : t('portal.welcome.resellerEyebrow')}</span>
          <h1>{isCustomer ? t('portal.welcome.customerTitle') : t('portal.welcome.resellerTitle', { name: actorName })}</h1>
          <p>{isCustomer ? t('portal.welcome.customerSubtitle') : t('portal.welcome.resellerSubtitle')}</p>
        </div>
        <div className="live-chip"><i />{t('portal.welcome.liveUpdates')}</div>
      </div>
      <section className="metrics">
        <MetricCard
          icon={<CarFront />}
          label={isCustomer ? t('portal.metrics.totalVehicles') : t('portal.metrics.customerVehicles')}
          value={formatNumber(data.stats.vehicles)}
          meta={isCustomer ? t('portal.metrics.inActiveScope') : t('portal.metrics.inCustomerScope')}
          color="violet"
        />
        <MetricCard
          icon={<Signal />}
          label={t('portal.metrics.onlineNow')}
          value={formatNumber(data.stats.online)}
          meta={t('portal.metrics.needAttention', { count: formatNumber(data.stats.vehicles - data.stats.online) })}
          color="mint"
        />
        <MetricCard
          icon={<Bell />}
          label={isCustomer ? t('portal.metrics.openAlerts') : t('portal.metrics.supportAlerts')}
          value={formatNumber(data.stats.activeAlerts)}
          meta={isCustomer ? t('portal.metrics.requiresReview') : t('portal.metrics.customerSupportReview')}
          color="peach"
        />
        <MetricCard
          icon={<Eye />}
          label={isCustomer ? t('portal.metrics.visibleLocations') : t('portal.metrics.grantedLocations')}
          value={formatNumber(data.stats.locationVisible)}
          meta={isCustomer ? t('portal.metrics.ofVehicles', { count: formatNumber(data.stats.vehicles) }) : t('portal.metrics.ofCustomerVehicles', { count: formatNumber(data.stats.vehicles) })}
          color="sky"
        />
      </section>
      <section className="overview-grid">
        <article className="surface map-surface">
          <SectionTitle
            eyebrow={isCustomer ? t('portal.overview.livePositionEyebrow') : t('portal.overview.grantedPositionEyebrow')}
            title={isCustomer ? t('portal.overview.livePositionTitle') : t('portal.overview.grantedPositionTitle')}
            action={<span className="soft-label"><i />{t('portal.overview.updatedNow')}</span>}
          />
          <LiveMap vehicles={data.vehicles} isCustomer={isCustomer} />
        </article>
        <article className="surface focus-card">
          <SectionTitle
            eyebrow={isCustomer ? t('portal.overview.quickLookEyebrow') : t('portal.overview.resellerFocusEyebrow')}
            title={featured?.name || (isCustomer ? t('portal.overview.fleetStatusFallback') : t('portal.overview.resellerFleetFallback'))}
            action={featured?.device && <StatusPill value={featured.device.status} />}
          />
          {featured && (
            <div className="focus-body">
              <div className="speed-orb">
                <Gauge />
                <strong>{featured.location ? formatNumber(featured.location.speedKph) : t('common.notApplicable')}</strong>
                <span>{t('portal.overview.speedUnit')}</span>
              </div>
              <div className="focus-details">
                <div><span>{t('portal.overview.registrationLabel')}</span><strong><LtrText>{featured.plate}</LtrText></strong></div>
                <div><span>{t('portal.overview.lastUpdateLabel')}</span><strong>{featured.device?.lastCommunicationAt ? formatRelativeTime(featured.device.lastCommunicationAt) : t('common.never')}</strong></div>
                <div><span>{t('portal.overview.locationLabel')}</span><strong>{featured.location ? <LtrText>{`${featured.location.latitude.toFixed(4)}, ${featured.location.longitude.toFixed(4)}`}</LtrText> : (isCustomer ? t('portal.overview.protectedLocation') : t('portal.overview.restrictedLocation'))}</strong></div>
              </div>
            </div>
          )}
          <div className="safety-note">
            <LockKeyhole />
            <div>
              <strong>{t('portal.overview.safetyTitle')}</strong>
              <p>{isCustomer ? t('portal.overview.safetyBody') : t('portal.overview.resellerSafetyBody')}</p>
            </div>
          </div>
        </article>
      </section>
      <section className="surface">
        <SectionTitle
          eyebrow={t('portal.overview.fleetStatusEyebrow')}
          title={isCustomer ? t('portal.overview.vehiclesTitle') : t('portal.overview.resellerVehiclesTitle')}
        />
        <VehicleList vehicles={data.vehicles} isCustomer={isCustomer} onTelematics={onTelematics} />
      </section>
      <section className="surface">
        <SectionTitle
          eyebrow={isCustomer ? t('portal.overview.recentActivityEyebrow') : t('portal.overview.resellerActivityEyebrow')}
          title={isCustomer ? t('portal.overview.alertsTitle') : t('portal.overview.resellerAlertsTitle')}
          action={<span className="count-badge">{t('portal.overview.openBadge', { count: formatNumber(data.stats.activeAlerts) })}</span>}
        />
        <AlertList alerts={data.alerts.slice(0, 3)} isCustomer={isCustomer} />
      </section>
    </>
  );
}

function Privacy({ data, grants, locale, localeState, grantCreateState, revokingGrantId, createGrant, revoke, updateLocale }: { data: Dashboard; grants: Grant[]; locale: SupportedLocale; localeState: MutationState; grantCreateState: MutationState; revokingGrantId: string | null; createGrant: (vehicle: string, purpose: string, hours: number) => Promise<void>; revoke: (id: string) => Promise<void>; updateLocale: (locale: SupportedLocale) => Promise<void> }) {
  const { t, formatDateTime, formatRelativeTime } = useI18n();
  const [vehicle, setVehicle] = useState(data.vehicles[0]?.id || '');
  const [purpose, setPurpose] = useState(t('portal.privacy.defaultPurpose'));
  const [hours, setHours] = useState(2);
  const [selectedLocale, setSelectedLocale] = useState(locale);
  useEffect(() => setSelectedLocale(locale), [locale]);
  return (
    <div className="privacy-grid">
      <section className="surface">
        <SectionTitle eyebrow={t('portal.privacy.grantsEyebrow')} title={t('portal.privacy.grantsTitle')} />
        <div className="grant-list">
          {grants.map(grant => (
            <article className={grant.revokedAt ? 'grant muted-grant' : 'grant'} key={grant.id}>
              <span className="grant-icon"><Eye /></span>
              <div><strong>{grant.vehicleName}</strong><p>{grant.granteeOrganizationName}</p><small>{grant.purpose}</small></div>
              <div className="grant-expiry">
                <span>{grant.revokedAt ? t('portal.privacy.revokedLabel') : t('portal.privacy.expiresLabel')}</span>
                <strong>{grant.revokedAt ? formatRelativeTime(grant.revokedAt) : formatDateTime(grant.expiresAt)}</strong>
              </div>
              {!grant.revokedAt && (
                <button className="text-danger" disabled={revokingGrantId === grant.id} onClick={() => revoke(grant.id)}>
                  {revokingGrantId === grant.id ? t('portal.privacy.revokingButton') : t('portal.privacy.revokeButton')}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="surface grant-builder locale-settings">
        <span className="round-icon"><UsersRound /></span>
        <p className="overline">{t('portal.privacy.languageEyebrow')}</p>
        <h2>{t('portal.privacy.languageTitle')}</h2>
        <p>{t('portal.privacy.languageDescription')}</p>
        <label>
          {t('portal.privacy.languageLabel')}
          <select value={selectedLocale} onChange={event => setSelectedLocale(event.target.value as SupportedLocale)}>
            <option value="en">{t('common.english')}</option>
            <option value="fa">{t('common.farsi')}</option>
          </select>
        </label>
        <button className="primary" disabled={localeState === 'submitting' || selectedLocale === locale} onClick={() => void updateLocale(selectedLocale)}>
          {localeState === 'submitting' ? t('common.saving') : t('common.save')}
        </button>
      </section>
      <aside className="surface grant-builder">
        <span className="round-icon"><KeyRound /></span>
        <h2>{t('portal.privacy.grantTemporaryAccessTitle')}</h2>
        <p>{t('portal.privacy.grantTemporaryAccessSubtitle')}</p>
        <label>
          {t('portal.privacy.vehicleSelectLabel')}
          <select value={vehicle} onChange={e => setVehicle(e.target.value)}>
            {data.vehicles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          {t('portal.privacy.durationSelectLabel')}
          <select value={hours} onChange={e => setHours(Number(e.target.value))}>
            <option value="1">{t('portal.privacy.duration1Hour')}</option>
            <option value="2">{t('portal.privacy.duration2Hours')}</option>
            <option value="4">{t('portal.privacy.duration4Hours')}</option>
            <option value="8">{t('portal.privacy.duration8Hours')}</option>
            <option value="24">{t('portal.privacy.duration24Hours')}</option>
          </select>
        </label>
        <label>
          {t('portal.privacy.purposeLabel')}
          <textarea value={purpose} onChange={e => setPurpose(e.target.value)} />
        </label>
        <button className="primary" disabled={grantCreateState === 'submitting'} onClick={() => createGrant(vehicle, purpose, hours)}>
          {grantCreateState === 'submitting' ? t('portal.privacy.creatingGrantButton') : t('portal.privacy.createGrantButton')}
        </button>
      </aside>
    </div>
  );
}

const CUSTOMER_TIMEZONES = ['Europe/Berlin', 'Asia/Tehran', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai'];

function CustomerDialog({ customer, submitting, errorKey, onDismiss, onSubmit }: {
  customer: ManagedCustomer | null;
  submitting: boolean;
  errorKey: MessageKey | null;
  onDismiss: () => void;
  onSubmit: (input: ManagedCustomerInput) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(customer?.name ?? '');
  const [defaultLocale, setDefaultLocale] = useState<SupportedLocale>(customer?.defaultLocale ?? 'en');
  const [timezone, setTimezone] = useState(customer?.timezone ?? 'Europe/Berlin');
  const [status, setStatus] = useState<CustomerLifecycle>(customer?.status ?? 'ACTIVE');
  const [nameInvalid, setNameInvalid] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const timezoneOptions = CUSTOMER_TIMEZONES.includes(timezone) ? CUSTOMER_TIMEZONES : [timezone, ...CUSTOMER_TIMEZONES];

  useEffect(() => { if (errorKey) errorRef.current?.focus(); }, [errorKey]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setNameInvalid(true);
      return;
    }
    onSubmit({ name: normalizedName, defaultLocale, timezone, status });
  };

  return (
    <div className="customer-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onDismiss(); }}>
      <form className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title" aria-busy={submitting} onSubmit={submit}>
        <div className="customer-dialog-head">
          <div><span>{t(customer ? 'portal.customers.editOverline' : 'portal.customers.createOverline')}</span><h2 id="customer-dialog-title">{t(customer ? 'portal.customers.editTitle' : 'portal.customers.createTitle')}</h2></div>
          <button type="button" className="dialog-close" onClick={onDismiss} disabled={submitting} aria-label={t('common.close')}><X aria-hidden="true" /></button>
        </div>
        <p className="customer-dialog-copy">{t('portal.customers.dialogCopy')}</p>
        {errorKey ? <div className="customer-dialog-error" role="alert" tabIndex={-1} ref={errorRef}><AlertTriangle aria-hidden="true" />{t(errorKey)}</div> : null}
        <div className="customer-form-grid">
          <label className="customer-field customer-field-wide">
            <span>{t('portal.customers.nameLabel')}</span>
            <input value={name} maxLength={120} autoFocus aria-invalid={nameInvalid || undefined} aria-describedby={nameInvalid ? 'customer-name-error' : undefined} onChange={event => { setName(event.target.value); setNameInvalid(false); }} />
            {nameInvalid ? <small id="customer-name-error">{t('portal.customers.nameValidation')}</small> : null}
          </label>
          <label className="customer-field">
            <span>{t('portal.customers.languageLabel')}</span>
            <select value={defaultLocale} onChange={event => setDefaultLocale(event.target.value as SupportedLocale)}><option value="en">{t('common.english')}</option><option value="fa">{t('common.farsi')}</option></select>
          </label>
          <label className="customer-field">
            <span>{t('portal.customers.timezoneLabel')}</span>
            <select dir="ltr" value={timezone} onChange={event => setTimezone(event.target.value)}>{timezoneOptions.map(value => <option key={value} value={value}>{value}</option>)}</select>
          </label>
          <label className="customer-field customer-field-wide">
            <span>{t('portal.customers.statusLabel')}</span>
            <select value={status} onChange={event => setStatus(event.target.value as CustomerLifecycle)}><option value="ACTIVE">{t('status.ACTIVE')}</option><option value="SUSPENDED">{t('status.SUSPENDED')}</option></select>
          </label>
        </div>
        <p className="customer-privacy-callout"><LockKeyhole aria-hidden="true" />{t('portal.customers.privacyBoundary')}</p>
        <div className="customer-dialog-actions">
          <button type="button" className="outline" onClick={onDismiss} disabled={submitting}>{t('common.cancel')}</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? <LoaderCircle className="spin" aria-hidden="true" /> : null}{submitting ? t('common.saving') : t(customer ? 'portal.customers.saveChanges' : 'portal.customers.createAction')}</button>
        </div>
      </form>
    </div>
  );
}

function CustomerDirectory({ customers, loading, search, statusFilter, onSearch, onStatusFilter, onCreate, onEdit, onOpenWorkspace }: {
  customers: ManagedCustomer[];
  loading: boolean;
  search: string;
  statusFilter: 'ALL' | CustomerLifecycle;
  onSearch: (value: string) => void;
  onStatusFilter: (value: 'ALL' | CustomerLifecycle) => void;
  onCreate: () => void;
  onEdit: (customer: ManagedCustomer) => void;
  onOpenWorkspace: (customer: ManagedCustomer) => void;
}) {
  const { t, formatDate, formatNumber } = useI18n();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = customers.filter(customer => (!normalizedSearch || `${customer.name} ${customer.timezone}`.toLocaleLowerCase().includes(normalizedSearch)) && (statusFilter === 'ALL' || customer.status === statusFilter));

  return (
    <section className="surface customer-directory">
      <div className="customer-directory-head"><div><span>{t('portal.customers.eyebrow')}</span><h1>{t('portal.customers.title')}</h1><p>{t('portal.customers.description')}</p></div><button className="primary" onClick={onCreate}><Plus aria-hidden="true" />{t('portal.customers.createAction')}</button></div>
      <div className="customer-boundary"><LockKeyholeOpen aria-hidden="true" /><div><strong>{t('portal.customers.boundaryTitle')}</strong><span>{t('portal.customers.boundaryCopy')}</span></div></div>
      <div className="customer-toolbar">
        <label className="customer-search"><Search aria-hidden="true" /><span className="sr-only">{t('portal.customers.searchPlaceholder')}</span><input value={search} onChange={event => onSearch(event.target.value)} placeholder={t('portal.customers.searchPlaceholder')} /></label>
        <label className="customer-filter"><span>{t('portal.customers.statusFilter')}</span><select value={statusFilter} onChange={event => onStatusFilter(event.target.value as 'ALL' | CustomerLifecycle)}><option value="ALL">{t('portal.customers.allStatuses')}</option><option value="ACTIVE">{t('status.ACTIVE')}</option><option value="SUSPENDED">{t('status.SUSPENDED')}</option></select></label>
        <span className="customer-count">{t('portal.customers.count', { count: formatNumber(filtered.length) })}</span>
      </div>
      {loading ? <div className="customer-loading"><LoaderCircle className="spin" />{t('common.loading')}</div> : filtered.length === 0 ? (
        <EmptyState icon={<Building2 />} title={customers.length ? t('portal.customers.noResultsTitle') : t('portal.customers.emptyTitle')} copy={customers.length ? t('portal.customers.noResultsCopy') : t('portal.customers.emptyCopy')} />
      ) : (
        <div className="customer-cards">{filtered.map(customer => (
          <article className="customer-card" key={customer.id}>
            <div className="customer-card-title"><span aria-hidden="true">{customer.name.charAt(0)}</span><div><h3>{customer.name}</h3><small><LtrText>{customer.id}</LtrText></small></div><StatusPill value={customer.status} /></div>
            <dl><div><dt>{t('portal.customers.language')}</dt><dd>{customer.defaultLocale === 'fa' ? t('common.farsi') : t('common.english')}</dd></div><div><dt>{t('portal.customers.timezone')}</dt><dd><LtrText>{customer.timezone}</LtrText></dd></div><div><dt>{t('portal.customers.relationship')}</dt><dd><StatusPill value={customer.serviceRelationship.status} /></dd></div></dl>
            <p>{t('portal.customers.started', { date: formatDate(customer.serviceRelationship.startedAt) })}</p>
            <div className="customer-card-actions"><button className="outline" onClick={() => onEdit(customer)} aria-label={t('portal.customers.editAria', { name: customer.name })}><Pencil aria-hidden="true" />{t('portal.customers.edit')}</button><button className="primary" onClick={() => onOpenWorkspace(customer)} aria-label={t('portal.customers.openWorkspaceAria', { name: customer.name })}>{t('portal.customers.openWorkspace')}</button></div>
          </article>
        ))}</div>
      )}
      <p className="identity-gate"><UserRound aria-hidden="true" />{t('portal.customers.identityGate')}</p>
    </section>
  );
}

function DeviceWorkspace({ inventory, history, vehicles, loading, canManage, isCustomer, selectedId, mutationState, errorKey, onSelect, onAssign, onEnd }: {
  inventory: DeviceInventoryItem[]; history: DeviceAssignmentHistory[]; vehicles: Vehicle[]; loading: boolean; canManage: boolean; isCustomer: boolean;
  selectedId: string | null; mutationState: MutationState; errorKey: MessageKey | null;
  onSelect: (id: string) => void; onAssign: (deviceId: string, vehicleId: string) => void; onEnd: (assignmentId: string) => void;
}) {
  const { t, formatDateTime, formatNumber, formatRelativeTime } = useI18n();
  const selected = inventory.find(device => device.id === selectedId) ?? inventory[0];
  const deviceHistory = selected ? history.filter(item => item.deviceId === selected.id) : [];
  const availableVehicles = vehicles.filter(vehicle => !vehicle.device);
  const [vehicleId, setVehicleId] = useState('');
  useEffect(() => setVehicleId(availableVehicles[0]?.id ?? ''), [selected?.id, availableVehicles.map(vehicle => vehicle.id).join(',')]);

  if (loading) return <div className="loading"><Activity className="spin" />{t('portal.devices.loading')}</div>;
  if (inventory.length === 0) return <EmptyState icon={<Radio />} title={isCustomer ? t('portal.devices.emptyTitle') : t('portal.devices.resellerEmptyTitle')} copy={isCustomer ? t('portal.devices.inventoryEmptyCopy') : t('portal.devices.resellerInventoryEmptyCopy')} />;

  return (
    <div className="device-workspace">
      <section className="device-inventory" aria-label={t('portal.devices.inventoryAria')}>
        <div className="device-inventory-head">
          <div><span>{t(isCustomer ? 'portal.devices.eyebrow' : 'portal.devices.resellerEyebrow')}</span><h1>{t(isCustomer ? 'portal.devices.title' : 'portal.devices.resellerTitle')}</h1></div>
          <strong>{t('portal.devices.deviceCount', { count: formatNumber(inventory.length) })}</strong>
        </div>
        <div className="cards-grid">
          {inventory.map(device => (
            <button type="button" className={`device-tile device-select${selected?.id === device.id ? ' selected' : ''}`} onClick={() => onSelect(device.id)} aria-pressed={selected?.id === device.id} key={device.id}>
              <div><span className="round-icon"><Radio /></span><StatusPill value={device.status} /></div>
              <h3><LtrText>{device.serial}</LtrText></h3>
              <p><LtrText>{device.model}</LtrText></p>
              <dl>
                <div><dt>{t('portal.devices.custodyLabel')}</dt><dd>{t('portal.devices.customerCustody')}</dd></div>
                <div><dt>{t('portal.devices.vehicleLabel')}</dt><dd>{device.currentAssignment?.vehicle?.name ?? t('portal.devices.unassigned')}</dd></div>
                <div><dt>{t('portal.devices.signalLabel')}</dt><dd><StatusText value={device.signalQuality} /></dd></div>
                <div><dt>{t('portal.devices.lastSeenLabel')}</dt><dd>{formatRelativeTime(device.lastCommunicationAt)}</dd></div>
              </dl>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <section className="surface device-detail" aria-labelledby="device-detail-title">
          <div className="device-detail-head">
            <div><span>{t('portal.devices.detailEyebrow')}</span><h2 id="device-detail-title"><LtrText>{selected.serial}</LtrText></h2><p><LtrText>{selected.model}</LtrText> · <LtrText>{selected.radio}</LtrText></p></div>
            <StatusPill value={selected.status} />
          </div>
          <div className="device-detail-stats">
            <div><span>{t('portal.devices.custodyLabel')}</span><strong>{t('portal.devices.customerCustody')}</strong></div>
            <div><span>{t('portal.devices.batteryLabel')}</span><strong>{t('portal.vehicles.batteryPercent', { percent: formatNumber(selected.batteryPercent) })}</strong></div>
            <div><span>{t('portal.devices.currentVehicleLabel')}</span><strong>{selected.currentAssignment?.vehicle?.name ?? t('portal.devices.unassigned')}</strong></div>
          </div>
          {errorKey && <div className="device-action-error" role="alert"><AlertCircle />{t(errorKey)}</div>}
          {canManage && (
            selected.currentAssignment ? (
              <div className="device-current-assignment">
                <div><Link2 /><div><strong>{t('portal.devices.assignedTo', { name: selected.currentAssignment.vehicle?.name ?? t('portal.devices.unknownVehicle') })}</strong><span>{t('portal.devices.assignedSince', { date: formatDateTime(selected.currentAssignment.assignedAt) })}</span></div></div>
                <button className="outline" disabled={mutationState === 'submitting'} onClick={() => onEnd(selected.currentAssignment!.id)}>{mutationState === 'submitting' ? <LoaderCircle className="spin" /> : <Unlink />}{t(mutationState === 'submitting' ? 'portal.devices.endingAssignment' : 'portal.devices.endAssignment')}</button>
              </div>
            ) : (
              <form className="device-assign-form" onSubmit={event => { event.preventDefault(); if (vehicleId) onAssign(selected.id, vehicleId); }}>
                <label>{t('portal.devices.assignVehicleLabel')}<select value={vehicleId} onChange={event => setVehicleId(event.target.value)} disabled={!availableVehicles.length || mutationState === 'submitting'}>{availableVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select></label>
                <button className="primary" disabled={!vehicleId || mutationState === 'submitting'}>{mutationState === 'submitting' ? <LoaderCircle className="spin" /> : <Link2 />}{t(mutationState === 'submitting' ? 'portal.devices.assigning' : 'portal.devices.assignAction')}</button>
                {!availableVehicles.length && <p>{t('portal.devices.noAvailableVehicles')}</p>}
              </form>
            )
          )}
          <div className="assignment-history">
            <h3><History />{t('portal.devices.historyTitle')}</h3>
            {deviceHistory.length === 0 ? <p>{t('portal.devices.historyEmpty')}</p> : <ol>{deviceHistory.map(item => <li key={item.id}><span className={item.unassignedAt ? 'history-dot ended' : 'history-dot'} /><div><strong>{item.vehicle?.name ?? t('portal.devices.unknownVehicle')}</strong><span><LtrText>{item.vehicle?.plate ?? item.vehicleId}</LtrText></span></div><div><span>{t('portal.devices.assignedDate', { date: formatDateTime(item.assignedAt) })}</span><strong>{item.unassignedAt ? t('portal.devices.endedDate', { date: formatDateTime(item.unassignedAt) }) : t('portal.devices.activeAssignment')}</strong></div></li>)}</ol>}
          </div>
        </section>
      )}
    </div>
  );
}

export default function PortalApp() {
  const { t, formatNumber, formatRelativeTime, setLocale } = useI18n();
  const [actorId, setActorId] = useState(CUSTOMER);
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [view, setView] = useState<PortalView>('overview');
  const [telemetryState, setTelemetryState] = useState<MutationState>('idle');
  const [grantCreateState, setGrantCreateState] = useState<MutationState>('idle');
  const [localeState, setLocaleState] = useState<MutationState>('idle');
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [vehicleCreateState, setVehicleCreateState] = useState<MutationState>('idle');
  const [vehicleCreateError, setVehicleCreateError] = useState<VehicleCreateError | null>(null);
  const [vehicleToast, setVehicleToast] = useState<VehicleToast | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [archivedVehicles, setArchivedVehicles] = useState<Vehicle[]>([]);
  const [archivedVehiclesLoading, setArchivedVehiclesLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [lifecycleVehicle, setLifecycleVehicle] = useState<Vehicle | null>(null);
  const [vehicleManagementState, setVehicleManagementState] = useState<MutationState>('idle');
  const [vehicleManagementErrorKey, setVehicleManagementErrorKey] = useState<MessageKey | null>(null);
  const [vehicleLifecycleToast, setVehicleLifecycleToast] = useState<VehicleLifecycleToast | null>(null);
  const [deviceInventory, setDeviceInventory] = useState<DeviceInventoryItem[]>([]);
  const [deviceHistory, setDeviceHistory] = useState<DeviceAssignmentHistory[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceMutationState, setDeviceMutationState] = useState<MutationState>('idle');
  const [deviceErrorKey, setDeviceErrorKey] = useState<MessageKey | null>(null);
  const [deviceToast, setDeviceToast] = useState<DeviceToast | null>(null);
  const [customers, setCustomers] = useState<ManagedCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'ALL' | CustomerLifecycle>('ALL');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ManagedCustomer | null>(null);
  const [customerMutationState, setCustomerMutationState] = useState<MutationState>('idle');
  const [customerErrorKey, setCustomerErrorKey] = useState<MessageKey | null>(null);
  const [customerToast, setCustomerToast] = useState<CustomerToast | null>(null);
  const [telematicsVehicle, setTelematicsVehicle] = useState<Vehicle | null>(null);
  const [message, setMessage] = useState('');
  const [menu, setMenu] = useState(false);
  const [vehicleStudio, setVehicleStudio] = useState(false);
  const vehicleCreateInFlight = useRef(false);
  const isCustomer = actorId === CUSTOMER;
  const isResellerAdmin = actorId === RESELLER_ADMIN;
  const nav = isCustomer ? CUSTOMER_NAV : isResellerAdmin ? RESELLER_ADMIN_NAV : RESELLER_NAV;
  const activeScope = session?.scopes.find(scope => scope.id === organizationId);
  const resellerId = session?.memberships.find(membership => membership.role === 'RESELLER_ADMIN')?.organizationId ?? '';
  const canManageVehicles = session?.provisioningCapabilities.manageVehiclesForCustomerIds.includes(organizationId) ?? false;
  const canManageDevices = session?.provisioningCapabilities.manageDeviceAssignmentsForCustomerIds.includes(organizationId) ?? false;

  const loadData = async (actor = actorId, org = organizationId) => {
    if (!org) return;
    const next = await request<Dashboard>(`/api/dashboard?organizationId=${org}`, actor);
    setData(next);
  };

  const loadDevices = async (actor = actorId, org = organizationId) => {
    if (!org || !canManageDevices) return;
    const [inventory, history] = await Promise.all([
      request<DeviceInventoryItem[]>(`/api/device-assignments/inventory?organizationId=${encodeURIComponent(org)}`, actor),
      request<DeviceAssignmentHistory[]>(`/api/device-assignments?organizationId=${encodeURIComponent(org)}`, actor)
    ]);
    setDeviceInventory(inventory);
    setDeviceHistory(history);
    setSelectedDeviceId(current => inventory.some(device => device.id === current) ? current : inventory[0]?.id ?? null);
  };

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/telematics/stream');
      es.addEventListener('location:update', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setData(current => {
            if (!current) return current;
            const updated = current.vehicles.map(v => {
              if (v.id === payload.vehicleId) {
                return {
                  ...v,
                  location: {
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    speedKph: payload.speedKph,
                    heading: payload.heading,
                    occurredAt: payload.occurredAt,
                    quality: 'VALID'
                  },
                  device: v.device ? {
                    ...v.device,
                    status: 'ONLINE',
                    lastCommunicationAt: payload.lastCommunicationAt
                  } : undefined,
                  currentState: {
                    ignitionOn: payload.ignitionOn,
                    doorOpen: payload.doorOpen,
                    externalPower: payload.externalPower,
                    armed: payload.armed,
                    immobilized: payload.immobilized,
                    fuelPercent: payload.fuelPercent ?? null,
                    updatedAt: payload.lastCommunicationAt
                  }
                };
              }
              return v;
            });
            return { ...current, vehicles: updated };
          });
        } catch {
          // Ignore parse errors
        }
      });

      es.addEventListener('alarm:triggered', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setData(current => {
            if (!current) return current;
            const newAlert: AlertItem = {
              id: payload.alertId,
              vehicleId: payload.vehicleId,
              vehicleName: payload.vehicleName,
              type: payload.alarmType,
              severity: payload.severity,
              status: 'TRIGGERED',
              occurredAt: payload.occurredAt,
              summary: payload.summary
            };
            return {
              ...current,
              alerts: [newAlert, ...current.alerts],
              stats: { ...current.stats, activeAlerts: current.stats.activeAlerts + 1 }
            };
          });
        } catch {
          // Ignore parse errors
        }
      });
    } catch {
      // EventSource not supported
    }

    return () => {
      es?.close();
    };
  }, []);

  useEffect(() => {
    setSession(null);
    setData(null);
    request<Session>('/api/session', actorId)
      .then(next => {
        setSession(next);
        setOrganizationId(next.scopes[0]?.id || '');
      })
      .catch(error => setMessage(error.message));
  }, [actorId]);

  useEffect(() => {
    setLocale(activeScope?.effectiveLocale ?? session?.effectiveLocale ?? 'en');
  }, [activeScope?.effectiveLocale, session?.effectiveLocale, setLocale]);

  useEffect(() => {
    if (organizationId) loadData().catch(error => setMessage(error.message));
    setVehicleFilter('ACTIVE');
    setArchivedVehicles([]);
    setEditingVehicle(null);
    setLifecycleVehicle(null);
    setDeviceInventory([]);
    setDeviceHistory([]);
    setSelectedDeviceId(null);
  }, [organizationId, actorId]);

  useEffect(() => {
    if (!organizationId) return;
    const interval = window.setInterval(() => {
      void loadData().catch(error => setMessage(error.message));
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [organizationId, actorId]);

  useEffect(() => {
    if (view !== 'devices' || !canManageDevices || !organizationId) return;
    setDevicesLoading(true);
    setDeviceErrorKey(null);
    loadDevices().catch(() => setDeviceErrorKey('portal.devices.loadError')).finally(() => setDevicesLoading(false));
  }, [view, canManageDevices, organizationId, actorId]);

  useEffect(() => {
    if (view !== 'vehicles' || vehicleFilter !== 'ARCHIVED' || !canManageVehicles || !organizationId) return;
    setArchivedVehiclesLoading(true);
    request<Vehicle[]>(`/api/vehicles?organizationId=${encodeURIComponent(organizationId)}&status=ARCHIVED`, actorId)
      .then(vehicles => setArchivedVehicles(vehicles.map(vehicle => ({ ...vehicle, locationAccess: false }))))
      .catch(() => setMessage(t('portal.vehicles.saveError')))
      .finally(() => setArchivedVehiclesLoading(false));
  }, [view, vehicleFilter, canManageVehicles, organizationId, actorId, t]);

  useEffect(() => {
    if (isCustomer && organizationId) {
      request<Grant[]>(`/api/grants?organizationId=${organizationId}`, actorId)
        .then(setGrants)
        .catch(() => setGrants([]));
    } else {
      setGrants([]);
    }
  }, [isCustomer, organizationId, actorId]);

  useEffect(() => {
    if (!isResellerAdmin || !resellerId) {
      setCustomers([]);
      return;
    }
    setCustomersLoading(true);
    request<ManagedCustomer[]>(`/api/resellers/${resellerId}/customers`, actorId)
      .then(setCustomers)
      .catch(() => setMessage(t('portal.customers.loadError')))
      .finally(() => setCustomersLoading(false));
  }, [isResellerAdmin, resellerId, actorId, t]);

  useEffect(() => {
    if (!nav.some(item => item.id === view)) setView('overview');
  }, [actorId]);

  useEffect(() => {
    if (!vehicleToast) return;
    const timer = window.setTimeout(() => setVehicleToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [vehicleToast]);

  useEffect(() => {
    if (!customerToast) return;
    const timer = window.setTimeout(() => setCustomerToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [customerToast]);

  useEffect(() => {
    if (!vehicleLifecycleToast) return;
    const timer = window.setTimeout(() => setVehicleLifecycleToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [vehicleLifecycleToast]);

  useEffect(() => {
    if (!deviceToast) return;
    const timer = window.setTimeout(() => setDeviceToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [deviceToast]);

  const simulate = async () => {
    setTelemetryState('submitting');
    try {
      const result = await request<{ accepted: number }>('/api/telemetry/simulate', actorId, { method: 'POST', body: JSON.stringify({ organizationId }) });
      await loadData();
      setTelemetryState('success');
      setMessage(t('portal.notices.telemetryUpdated', { count: formatNumber(result.accepted) }));
    } catch (error) {
      setTelemetryState('error');
      setMessage(error instanceof Error ? error.message : t('portal.notices.telemetryFailed'));
    }
  };

  const createGrant = async (vehicleId: string, purpose: string, durationHours: number) => {
    setGrantCreateState('submitting');
    try {
      await request('/api/grants', actorId, { method: 'POST', body: JSON.stringify({ organizationId, vehicleId, purpose, durationHours }) });
      setGrants(await request(`/api/grants?organizationId=${organizationId}`, actorId));
      setGrantCreateState('success');
      setMessage(t('portal.notices.grantCreated'));
    } catch (error) {
      setGrantCreateState('error');
      setMessage(error instanceof Error ? error.message : t('portal.notices.grantFailed'));
    }
  };

  const revoke = async (id: string) => {
    setRevokingGrantId(id);
    try {
      await request(`/api/grants/${id}`, actorId, { method: 'DELETE' });
      setGrants(await request(`/api/grants?organizationId=${organizationId}`, actorId));
      setMessage(t('portal.notices.accessRevoked'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('portal.notices.revokeFailed'));
    } finally {
      setRevokingGrantId(null);
    }
  };

  const updateLocale = async (nextLocale: SupportedLocale) => {
    setLocaleState('submitting');
    try {
      const settings = await request<{ defaultLocale: SupportedLocale; effectiveLocale: SupportedLocale }>(`/api/organizations/${organizationId}/settings`, actorId, {
        method: 'PATCH',
        body: JSON.stringify({ defaultLocale: nextLocale })
      });
      setSession(current => current ? {
        ...current,
        scopes: current.scopes.map(scope => scope.id === organizationId ? { ...scope, defaultLocale: settings.defaultLocale, effectiveLocale: settings.effectiveLocale } : scope)
      } : current);
      setLocale(settings.effectiveLocale);
      setLocaleState('success');
      setMessage(createI18n(settings.effectiveLocale).t('portal.privacy.languageSaved'));
    } catch {
      setLocaleState('error');
      setMessage(t('portal.privacy.languageFailed'));
    }
  };

  const saveCustomer = async (input: ManagedCustomerInput) => {
    if (!resellerId || customerMutationState === 'submitting') return;
    setCustomerMutationState('submitting');
    setCustomerErrorKey(null);
    const isEditing = Boolean(editingCustomer);
    try {
      const path = editingCustomer
        ? `/api/resellers/${resellerId}/customers/${editingCustomer.id}`
        : `/api/resellers/${resellerId}/customers`;
      const saved = await request<ManagedCustomer>(path, actorId, { method: editingCustomer ? 'PATCH' : 'POST', body: JSON.stringify(input) });
      setCustomers(current => editingCustomer ? current.map(customer => customer.id === saved.id ? saved : customer) : [...current, saved]);
      const nextSession = await request<Session>('/api/session', actorId);
      setSession(nextSession);
      setCustomerMutationState('success');
      setCustomerDialogOpen(false);
      setEditingCustomer(null);
      setCustomerToast({ kind: isEditing ? 'updated' : 'created', name: saved.name });
    } catch (error) {
      setCustomerMutationState('error');
      const code = error instanceof ApiRequestError ? error.code : undefined;
      const errorKey: MessageKey = code === 'CUSTOMER_NAME_EXISTS'
        ? 'portal.customers.duplicateError'
        : code === 'CUSTOMER_PROVISIONING_DENIED' || code === 'CUSTOMER_SETTINGS_DENIED'
          ? 'portal.customers.permissionError'
          : code === 'CUSTOMER_SCOPE_DENIED'
            ? 'portal.customers.scopeError'
            : code === 'INVALID_CUSTOMER'
              ? 'portal.customers.validationError'
              : 'portal.customers.saveError';
      setCustomerErrorKey(errorKey);
    }
  };

  const openCustomerWorkspace = (customer: ManagedCustomer) => {
    setOrganizationId(customer.id);
    setView('overview');
  };

  const createVehicle = async (input: NewVehicleInput) => {
    if (vehicleCreateInFlight.current) return;
    vehicleCreateInFlight.current = true;
    setVehicleCreateError(null);
    setVehicleCreateState('submitting');
    try {
      const created = await request<CreatedVehicle>('/api/vehicles', actorId, { method: 'POST', body: JSON.stringify(input) });
      const vehicle: Vehicle = { ...created, locationAccess: activeScope?.access === 'member' };
      setData(current => {
        if (!current || current.vehicles.some(item => item.id === vehicle.id)) return current;
        return { ...current, stats: { ...current.stats, vehicles: current.stats.vehicles + 1 }, vehicles: [...current.vehicles, vehicle] };
      });
      setVehicleCreateState('success');
      setVehicleStudio(false);
      const markerStyleEntry = MARKER_STYLES.find(style => style.id === created.markerStyle);
      const markerLabel = markerStyleEntry
        ? t(`portal.markerStyles.${markerStyleEntry.id}.label` as MessageKey).toLowerCase()
        : 'selected';
      setVehicleToast({ id: created.id, name: created.name, markerLabel });
      void loadData().catch(() => setMessage(t('portal.notices.vehicleCreatedRefreshFailed')));
    } catch (error) {
      setVehicleCreateState('error');
      const code = error instanceof ApiRequestError ? error.code : undefined;
      setVehicleCreateError({
        message: error instanceof TypeError
          ? t('portal.notices.networkError')
          : code === 'VEHICLE_ADMIN_REQUIRED'
            ? t('portal.vehicleStudio.permissionError')
          : error instanceof Error
            ? error.message
            : t('portal.notices.genericCreateError'),
        field: error instanceof ApiRequestError && error.code === 'VEHICLE_PLATE_EXISTS' ? 'plate' : undefined
      });
    } finally {
      vehicleCreateInFlight.current = false;
    }
  };

  const saveVehicle = async (input: VehicleUpdateInput) => {
    if (!editingVehicle || vehicleManagementState === 'submitting') return;
    setVehicleManagementState('submitting');
    setVehicleManagementErrorKey(null);
    try {
      const saved = await request<Vehicle>(`/api/vehicles/${editingVehicle.id}`, actorId, { method: 'PATCH', body: JSON.stringify(input) });
      setData(current => current ? { ...current, vehicles: current.vehicles.map(vehicle => vehicle.id === saved.id ? { ...vehicle, ...saved } : vehicle) } : current);
      setEditingVehicle(null);
      setVehicleManagementState('success');
      setVehicleLifecycleToast({ kind: 'updated', name: saved.name });
    } catch (error) {
      setVehicleManagementState('error');
      const code = error instanceof ApiRequestError ? error.code : undefined;
      setVehicleManagementErrorKey(code === 'VEHICLE_PLATE_EXISTS' ? 'portal.vehicles.duplicatePlateError' : code === 'VEHICLE_ADMIN_REQUIRED' ? 'portal.vehicles.permissionError' : 'portal.vehicles.saveError');
    }
  };

  const changeVehicleLifecycle = async () => {
    if (!lifecycleVehicle || vehicleManagementState === 'submitting') return;
    const restore = Boolean(lifecycleVehicle.archivedAt);
    setVehicleManagementState('submitting');
    try {
      const saved = await request<Vehicle>(`/api/vehicles/${lifecycleVehicle.id}/${restore ? 'restore' : 'archive'}`, actorId, { method: 'POST' });
      if (restore) {
        setArchivedVehicles(current => current.filter(vehicle => vehicle.id !== saved.id));
        await loadData();
      } else {
        setData(current => current ? { ...current, stats: { ...current.stats, vehicles: Math.max(0, current.stats.vehicles - 1) }, vehicles: current.vehicles.filter(vehicle => vehicle.id !== saved.id) } : current);
      }
      setLifecycleVehicle(null);
      setVehicleManagementState('success');
      setVehicleLifecycleToast({ kind: restore ? 'restored' : 'archived', name: saved.name });
    } catch (error) {
      setVehicleManagementState('error');
      setMessage(error instanceof ApiRequestError && error.code === 'VEHICLE_ADMIN_REQUIRED' ? t('portal.vehicles.permissionError') : t('portal.vehicles.saveError'));
    }
  };

  const assignDevice = async (deviceId: string, vehicleId: string) => {
    if (deviceMutationState === 'submitting') return;
    const device = deviceInventory.find(item => item.id === deviceId);
    setDeviceMutationState('submitting');
    setDeviceErrorKey(null);
    try {
      await request('/api/device-assignments', actorId, { method: 'POST', body: JSON.stringify({ deviceId, vehicleId }) });
      await Promise.all([loadDevices(), loadData()]);
      setDeviceMutationState('success');
      setDeviceToast({ kind: 'assigned', serial: device?.serial ?? deviceId });
    } catch (error) {
      setDeviceMutationState('error');
      const code = error instanceof ApiRequestError ? error.code : undefined;
      setDeviceErrorKey(code === 'DEVICE_ALREADY_ASSIGNED' || code === 'VEHICLE_ALREADY_ASSIGNED' || code === 'DEVICE_ASSIGNMENT_CONFLICT' ? 'portal.devices.conflictError' : code === 'DEVICE_ASSIGNMENT_ADMIN_REQUIRED' || code === 'DEVICE_ASSIGNMENT_SCOPE_DENIED' ? 'portal.devices.permissionError' : 'portal.devices.saveError');
    }
  };

  const endDeviceAssignment = async (assignmentId: string) => {
    if (deviceMutationState === 'submitting') return;
    const device = deviceInventory.find(item => item.currentAssignment?.id === assignmentId);
    setDeviceMutationState('submitting');
    setDeviceErrorKey(null);
    try {
      await request(`/api/device-assignments/${assignmentId}`, actorId, { method: 'DELETE' });
      await Promise.all([loadDevices(), loadData()]);
      setDeviceMutationState('success');
      setDeviceToast({ kind: 'unassigned', serial: device?.serial ?? assignmentId });
    } catch (error) {
      setDeviceMutationState('error');
      setDeviceErrorKey(error instanceof ApiRequestError && error.code === 'DEVICE_ASSIGNMENT_ADMIN_REQUIRED' ? 'portal.devices.permissionError' : 'portal.devices.saveError');
    }
  };

  const viewCreatedVehicle = () => {
    if (!vehicleToast) return;
    const vehicleId = vehicleToast.id;
    setView('vehicles');
    setVehicleToast(null);
    window.setTimeout(() => {
      const vehicle = document.getElementById(`vehicle-${vehicleId}`);
      vehicle?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      vehicle?.focus({ preventScroll: true });
    }, 0);
  };

  const currentNav = nav.find(item => item.id === view);
  const title = currentNav ? t(currentNav.labelKey as MessageKey) : t('portal.nav.overview');

  return (
    <div className="portal-shell">
      <aside className={menu ? 'portal-nav open' : 'portal-nav'}>
        <div className="logo">
          <span><Route /></span>
          <div>
            <strong>{t('portal.brand.title')}</strong>
            <small>{isCustomer ? t('portal.brand.fleetPortal') : t('portal.brand.partnerPortal')}</small>
          </div>
          <button className="nav-close" aria-label={t('portal.nav.closeNav')} onClick={() => setMenu(false)}><X /></button>
        </div>
        <div className="org-select">
          <small>{isCustomer ? t('portal.nav.myOrganization') : t('portal.nav.customerAccount')}</small>
          <select value={organizationId} onChange={e => setOrganizationId(e.target.value)}>
            {session?.scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
          </select>
        </div>
        <nav>
          {nav.map(item => (
            <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setMenu(false); }}>
              <item.icon />
              {t(item.labelKey as MessageKey)}
              {item.id === 'alerts' && data?.stats.activeAlerts ? <b>{formatNumber(data.stats.activeAlerts)}</b> : null}
            </button>
          ))}
        </nav>
        <div className="nav-bottom">
          <div className="privacy-status">
            <ShieldCheck />
            <div>
              <strong>{isCustomer ? t('portal.nav.privacyActiveTitle') : t('portal.nav.scopedAccessTitle')}</strong>
              <small>{isCustomer ? t('portal.nav.privacyActiveDesc') : t('portal.nav.scopedAccessDesc')}</small>
            </div>
          </div>
          <button><CircleHelp />{t('portal.nav.helpAndSupport')}</button>
        </div>
      </aside>
      <main className="portal-main">
        <header>
          <button className="menu-trigger" aria-label={t('portal.header.openNavigation')} onClick={() => setMenu(true)}><Menu /></button>
          <div>
            <span>{data?.organization.name || (isCustomer ? t('portal.brand.fleetPortal') : t('portal.brand.partnerPortal'))}</span>
            <h2>{title}</h2>
          </div>
          <div className="header-tools">
            <div className="search">
              <Search />
              <input placeholder={isCustomer ? t('portal.header.searchVehiclesPlaceholder') : t('portal.header.searchCustomerVehiclesPlaceholder')} />
            </div>
            {isCustomer && (
              <button className="outline" onClick={simulate} disabled={telemetryState === 'submitting'}>
                <RefreshCw className={telemetryState === 'submitting' ? 'spin' : ''} />
                {telemetryState === 'submitting' ? t('portal.header.refreshingPositions') : t('portal.header.refreshPositions')}
              </button>
            )}
            <div className="role-switch">
              <span className={isCustomer ? 'avatar customer' : 'avatar reseller'}>{isCustomer ? 'MC' : isResellerAdmin ? 'LH' : 'NF'}</span>
              <div>
                <strong>{isCustomer ? 'Maya Chen' : isResellerAdmin ? 'Leila Haddad' : 'Noah Fischer'}</strong>
                <small>{isCustomer ? t('portal.roles.customerAdmin') : isResellerAdmin ? t('portal.roles.resellerAdmin') : t('portal.roles.resellerSupport')}</small>
              </div>
              <select value={actorId} onChange={e => { const nextActor = e.target.value; setOrganizationId(''); setActorId(nextActor); setView(nextActor === RESELLER_ADMIN ? 'customers' : 'overview'); setMessage(''); }} aria-label={t('portal.roles.switchRoleAria')}>
                <option value={CUSTOMER}>{t('portal.roles.customerRoleOption')}</option>
                <option value={RESELLER_ADMIN}>{t('portal.roles.resellerAdminRoleOption')}</option>
                <option value={RESELLER_SUPPORT}>{t('portal.roles.resellerSupportRoleOption')}</option>
              </select>
              <ChevronDown />
            </div>
          </div>
        </header>
        <div className="portal-content">
          {message && (
            <div className="notice">
              <ShieldCheck />
              {message}
              <button aria-label={t('common.dismiss')} onClick={() => setMessage('')}><X /></button>
            </div>
          )}
          {view !== 'customers' && <WorkspaceRail isCustomer={isCustomer} view={view} />}
          {view === 'customers' && isResellerAdmin ? (
            <CustomerDirectory
              customers={customers}
              loading={customersLoading}
              search={customerSearch}
              statusFilter={customerStatusFilter}
              onSearch={setCustomerSearch}
              onStatusFilter={setCustomerStatusFilter}
              onCreate={() => { setEditingCustomer(null); setCustomerErrorKey(null); setCustomerMutationState('idle'); setCustomerDialogOpen(true); }}
              onEdit={customer => { setEditingCustomer(customer); setCustomerErrorKey(null); setCustomerMutationState('idle'); setCustomerDialogOpen(true); }}
              onOpenWorkspace={openCustomerWorkspace}
            />
          ) : !data ? (
            <div className="loading"><Activity className="spin" />{t('portal.notices.loadingWorkspace')}</div>
          ) : (
            <>
              {view === 'overview' && <Overview data={data} isCustomer={isCustomer} actorName={session?.actor.name ?? ''} onTelematics={isCustomer ? vehicle => setTelematicsVehicle(vehicle) : undefined} />}
              {view === 'map' && (
                <section className="surface map-page">
                  <SectionTitle
                    eyebrow={isCustomer ? t('portal.map.realTimeTrackingEyebrow') : t('portal.map.grantedLocationsEyebrow')}
                    title={isCustomer ? t('portal.map.liveFleetMapTitle') : t('portal.map.grantedLocationMapTitle')}
                    action={<span className="map-note">{t('portal.map.mapAttribution')}</span>}
                  />
                  <LiveMap vehicles={data.vehicles} tall isCustomer={isCustomer} onVehicleClick={isCustomer ? vehicle => setTelematicsVehicle(vehicle) : undefined} />
                  <VehicleList vehicles={data.vehicles} isCustomer={isCustomer} onTelematics={isCustomer ? vehicle => setTelematicsVehicle(vehicle) : undefined} />
                </section>
              )}
              {view === 'vehicles' && (
                <section className="surface">
                  <SectionTitle
                    eyebrow={isCustomer ? t('portal.vehicles.directoryEyebrow') : t('portal.vehicles.resellerDirectoryEyebrow')}
                    title={isCustomer ? t('portal.vehicles.customerVehiclesTitle') : t('portal.vehicles.resellerVehiclesTitle')}
                    action={canManageVehicles && (
                      <div className="vehicle-directory-actions">
                        <label><span className="sr-only">{t('portal.vehicles.filterLabel')}</span><select value={vehicleFilter} onChange={event => setVehicleFilter(event.target.value as 'ACTIVE' | 'ARCHIVED')}><option value="ACTIVE">{t('portal.vehicles.activeFilter')}</option><option value="ARCHIVED">{t('portal.vehicles.archivedFilter')}</option></select></label>
                        {vehicleFilter === 'ACTIVE' && <button className="primary add-vehicle" onClick={() => { setVehicleCreateState('idle'); setVehicleCreateError(null); setVehicleStudio(true); }}><Plus />{t(isCustomer ? 'portal.vehicles.addVehicleButton' : 'portal.vehicles.addCustomerVehicleButton')}</button>}
                      </div>
                    )}
                  />
                  {archivedVehiclesLoading && vehicleFilter === 'ARCHIVED'
                    ? <div className="loading"><Activity className="spin" />{t('common.loading')}</div>
                    : <VehicleList
                        vehicles={vehicleFilter === 'ARCHIVED' ? archivedVehicles : data.vehicles}
                        isCustomer={isCustomer}
                        archived={vehicleFilter === 'ARCHIVED'}
                        onEdit={canManageVehicles && vehicleFilter === 'ACTIVE' ? vehicle => { setVehicleManagementState('idle'); setVehicleManagementErrorKey(null); setEditingVehicle(vehicle); } : undefined}
                        onLifecycle={canManageVehicles ? vehicle => { setVehicleManagementState('idle'); setLifecycleVehicle(vehicle); } : undefined}
                        onTelematics={isCustomer && vehicleFilter === 'ACTIVE' ? vehicle => setTelematicsVehicle(vehicle) : undefined}
                      />}
                </section>
              )}
              {view === 'devices' && (
                canManageDevices ? (
                  <DeviceWorkspace
                    inventory={deviceInventory}
                    history={deviceHistory}
                    vehicles={data.vehicles}
                    loading={devicesLoading}
                    canManage={canManageDevices}
                    isCustomer={isCustomer}
                    selectedId={selectedDeviceId}
                    mutationState={deviceMutationState}
                    errorKey={deviceErrorKey}
                    onSelect={id => { setSelectedDeviceId(id); setDeviceErrorKey(null); setDeviceMutationState('idle'); }}
                    onAssign={assignDevice}
                    onEnd={endDeviceAssignment}
                  />
                ) : (
                <section className="cards-grid">
                  {data.vehicles.length === 0 ? (
                    <EmptyState
                      icon={<Radio />}
                      title={isCustomer ? t('portal.devices.emptyTitle') : t('portal.devices.resellerEmptyTitle')}
                      copy={isCustomer ? t('portal.devices.emptyCopy') : t('portal.devices.resellerEmptyCopy')}
                    />
                  ) : (
                    data.vehicles.map(vehicle => (
                      <article className="device-tile" key={vehicle.id}>
                        <div>
                          <span className="round-icon"><Radio /></span>
                          <StatusPill value={vehicle.device?.status || 'UNASSIGNED'} />
                        </div>
                        <h3>{vehicle.device?.serial ? <LtrText>{vehicle.device.serial}</LtrText> : (isCustomer ? t('portal.devices.noTracker') : t('portal.devices.resellerNoTracker'))}</h3>
                        <p>{vehicle.device?.model ? <LtrText>{vehicle.device.model}</LtrText> : (isCustomer ? t('portal.devices.noDeviceAssigned') : t('portal.devices.resellerNoDeviceAssigned'))}</p>
                        <dl>
                          <div><dt>{t('portal.devices.vehicleLabel')}</dt><dd>{vehicle.name}</dd></div>
                          <div><dt>{t('portal.devices.networkLabel')}</dt><dd>{vehicle.device?.radio ? <LtrText>{vehicle.device.radio}</LtrText> : t('common.notApplicable')}</dd></div>
                          <div><dt>{t('portal.devices.signalLabel')}</dt><dd>{vehicle.device?.signalQuality ? <StatusText value={vehicle.device.signalQuality} /> : t('common.notApplicable')}</dd></div>
                          <div><dt>{t('portal.devices.lastSeenLabel')}</dt><dd>{vehicle.device?.lastCommunicationAt ? formatRelativeTime(vehicle.device.lastCommunicationAt) : t('common.never')}</dd></div>
                        </dl>
                      </article>
                    ))
                  )}
                </section>
                )
              )}
              {view === 'alerts' && (
                <section className="surface">
                  <SectionTitle
                    eyebrow={isCustomer ? t('portal.alerts.inboxEyebrow') : t('portal.alerts.resellerInboxEyebrow')}
                    title={isCustomer ? t('portal.alerts.inboxTitle') : t('portal.alerts.resellerInboxTitle')}
                  />
                  <AlertList alerts={data.alerts} isCustomer={isCustomer} />
                </section>
              )}
              {view === 'privacy' && isCustomer && (
                <Privacy
                  data={data}
                  grants={grants}
                  locale={activeScope?.defaultLocale ?? 'en'}
                  localeState={localeState}
                  grantCreateState={grantCreateState}
                  revokingGrantId={revokingGrantId}
                  createGrant={createGrant}
                  revoke={revoke}
                  updateLocale={updateLocale}
                />
              )}
            </>
          )}
        </div>
      </main>
      {vehicleToast && (
        <Toast
          title={t('portal.toast.vehicleCreatedTitle')}
          message={t('portal.toast.vehicleCreatedMessage', { name: vehicleToast.name, markerLabel: vehicleToast.markerLabel })}
          icon={<Check />}
          actionLabel={t('portal.toast.viewVehicleAction')}
          onAction={viewCreatedVehicle}
          onDismiss={() => setVehicleToast(null)}
        />
      )}
      {customerToast && (
        <Toast
          title={t(customerToast.kind === 'created' ? 'portal.customers.createdToastTitle' : 'portal.customers.updatedToastTitle')}
          message={t(customerToast.kind === 'created' ? 'portal.customers.createdToastMessage' : 'portal.customers.updatedToastMessage', { name: customerToast.name })}
          icon={<Check />}
          onDismiss={() => setCustomerToast(null)}
        />
      )}
      {vehicleLifecycleToast && (
        <Toast
          title={t(`portal.toast.vehicle${vehicleLifecycleToast.kind === 'updated' ? 'Updated' : vehicleLifecycleToast.kind === 'archived' ? 'Archived' : 'Restored'}Title` as MessageKey)}
          message={t(`portal.toast.vehicle${vehicleLifecycleToast.kind === 'updated' ? 'Updated' : vehicleLifecycleToast.kind === 'archived' ? 'Archived' : 'Restored'}Message` as MessageKey, { name: vehicleLifecycleToast.name })}
          icon={<Check />}
          onDismiss={() => setVehicleLifecycleToast(null)}
        />
      )}
      {deviceToast && (
        <Toast
          title={t(deviceToast.kind === 'assigned' ? 'portal.devices.assignedToastTitle' : 'portal.devices.unassignedToastTitle')}
          message={t(deviceToast.kind === 'assigned' ? 'portal.devices.assignedToastMessage' : 'portal.devices.unassignedToastMessage', { serial: deviceToast.serial })}
          icon={<Check />}
          onDismiss={() => setDeviceToast(null)}
        />
      )}
      {customerDialogOpen && isResellerAdmin && (
        <CustomerDialog
          customer={editingCustomer}
          submitting={customerMutationState === 'submitting'}
          errorKey={customerErrorKey}
          onDismiss={() => { if (customerMutationState !== 'submitting') { setCustomerDialogOpen(false); setEditingCustomer(null); setCustomerErrorKey(null); } }}
          onSubmit={input => void saveCustomer(input)}
        />
      )}
      {editingVehicle && (
        <VehicleEditDialog
          vehicle={editingVehicle}
          submitting={vehicleManagementState === 'submitting'}
          errorKey={vehicleManagementErrorKey}
          onDismiss={() => { if (vehicleManagementState !== 'submitting') { setEditingVehicle(null); setVehicleManagementErrorKey(null); } }}
          onSubmit={input => void saveVehicle(input)}
        />
      )}
      {lifecycleVehicle && (
        <VehicleLifecycleDialog
          vehicle={lifecycleVehicle}
          restore={Boolean(lifecycleVehicle.archivedAt)}
          submitting={vehicleManagementState === 'submitting'}
          onDismiss={() => { if (vehicleManagementState !== 'submitting') setLifecycleVehicle(null); }}
          onConfirm={() => void changeVehicleLifecycle()}
        />
      )}
      <VehicleStudio
        open={vehicleStudio && canManageVehicles}
        delegated={!isCustomer}
        createState={vehicleCreateState}
        createError={vehicleCreateError}
        organizationId={organizationId}
        onClose={() => setVehicleStudio(false)}
        onCreate={createVehicle}
        onClearError={() => { setVehicleCreateError(null); setVehicleCreateState('idle'); }}
      />
      {telematicsVehicle && (
        <VehicleTelematicsDialog
          vehicle={telematicsVehicle}
          actorId={actorId}
          onClose={() => setTelematicsVehicle(null)}
        />
      )}
    </div>
  );
}
