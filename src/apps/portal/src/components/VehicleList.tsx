import { EmptyState, LtrText, StatusPill, useI18n, type MessageKey } from '@sentinel/ui';
import { Archive, CarFront, Pencil, Radio, RotateCcw } from 'lucide-react';
import type { Vehicle } from '../types';
import { vehicleType } from '../vehicleAppearance';

export function VehicleList({ vehicles, isCustomer = true, archived = false, onEdit, onLifecycle, onTelematics }: {
  vehicles: Vehicle[];
  isCustomer?: boolean;
  archived?: boolean;
  onEdit?: (vehicle: Vehicle) => void;
  onLifecycle?: (vehicle: Vehicle) => void;
  onTelematics?: (vehicle: Vehicle) => void;
}) {
  const { t, formatDateTime, formatNumber, formatRelativeTime } = useI18n();
  if (!vehicles.length) return <EmptyState icon={<CarFront />} title={archived ? t('portal.vehicles.archivedEmptyTitle') : isCustomer ? t('portal.vehicles.emptyTitle') : t('portal.vehicles.resellerEmptyTitle')} copy={archived ? t('portal.vehicles.archivedEmptyCopy') : isCustomer ? t('portal.vehicles.emptyCopy') : t('portal.vehicles.resellerEmptyCopy')} />;
  return <div className="vehicle-list">
    {vehicles.map(vehicle => {
      const Icon = vehicleType(vehicle.kind).icon;
      const kindLabel = t(`portal.vehicleTypes.${vehicle.kind}` as MessageKey).toLowerCase();
      const speedText = vehicle.location ? t('portal.vehicles.speedKph', { speed: formatNumber(vehicle.location.speedKph) }) : t(isCustomer ? 'portal.vehicles.privateSpeed' : 'portal.vehicles.resellerNoLocation');
      const batteryText = vehicle.device ? t('portal.vehicles.batteryPercent', { percent: formatNumber(vehicle.device.batteryPercent) }) : t('common.notApplicable');
      const lastReportText = vehicle.device?.lastCommunicationAt ? formatRelativeTime(vehicle.device.lastCommunicationAt) : t('common.never');
      return <article className={`vehicle-line${onLifecycle || onTelematics ? ' manageable' : ''}`} id={`vehicle-${vehicle.id}`} tabIndex={-1} key={vehicle.id}>
        <div className="vehicle-photo"><Icon /></div>
        <div className="vehicle-name"><strong>{vehicle.name}</strong><span><LtrText>{vehicle.plate}</LtrText> · {kindLabel}</span></div>
        <StatusPill value={archived ? 'ARCHIVED' : vehicle.device?.status || 'UNASSIGNED'} />
        <div className="vehicle-reading"><span>{t('portal.vehicles.speed')}</span><strong>{speedText}</strong></div>
        <div className="vehicle-reading"><span>{t('portal.vehicles.battery')}</span><strong>{batteryText}</strong></div>
        <div className="vehicle-reading"><span>{t('portal.vehicles.lastReport')}</span><strong>{lastReportText}</strong></div>
        {archived && vehicle.archivedAt && <div className="vehicle-archived-at">{t('portal.vehicles.archivedAt', { date: formatDateTime(vehicle.archivedAt) })}</div>}
        {(onLifecycle || onTelematics) && <div className="vehicle-actions">
          {!archived && vehicle.device && onTelematics && <button className="outline" onClick={() => onTelematics(vehicle)} title="Coban GPS 303FG Controls"><Radio />Telematics</button>}
          {!archived && onEdit && <button className="outline" onClick={() => onEdit(vehicle)}><Pencil />{t('portal.vehicles.editButton')}</button>}
          {onLifecycle && <button className="outline" onClick={() => onLifecycle(vehicle)}>{archived ? <RotateCcw /> : <Archive />}{t(archived ? 'portal.vehicles.restoreButton' : 'portal.vehicles.archiveButton')}</button>}
        </div>}
      </article>;
    })}
  </div>;
}
