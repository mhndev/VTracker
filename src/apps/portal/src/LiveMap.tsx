import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { LockKeyhole, LocateFixed } from 'lucide-react';
import { LtrText, useI18n } from '@sentinel/ui';
import type { Vehicle } from './types';
import { markerColorHex } from './vehicleAppearance';

const markerGlyph = (kind: Vehicle['kind']): string => {
  const paths: Record<Vehicle['kind'], string> = {
    CAR: '<path d="M4 15l2-6h12l2 6v3h-2v2h-2v-2H8v2H6v-2H4zM7 13h10M8 9l2-3h4l2 3"/>',
    VAN: '<path d="M4 6h11l5 5v7h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4zM15 8v4h4"/>',
    TRUCK: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>',
    MOTORCYCLE: '<path d="M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8 15l3-6h3l3 6M10 12h5M13 9l-2-3"/>',
    SCOOTER: '<path d="M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4M9 16h5l3-9h2M15 7h4"/>',
    BICYCLE: '<path d="M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5 15l5-7 4 7M10 8h5l4 7M8 6h3"/>',
    BUS: '<path d="M5 4h14v13H5zM7 7h10v5H7zM8 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M16 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>',
    UTILITY: '<path d="M4 17h16M6 17l2-8h8l2 8M10 9V5h4v4M8 13h8M5 5l3 3M19 5l-3 3"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</svg>`;
};

function FitFleet({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();
  useEffect(() => {
    const points = vehicles.flatMap((vehicle) => vehicle.location ? [[vehicle.location.latitude, vehicle.location.longitude] as L.LatLngTuple] : []);
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 14, animate: false });
  }, [map, vehicles]);
  return null;
}

export default function LiveMap({ vehicles, tall = false, isCustomer = true }: { vehicles: Vehicle[]; tall?: boolean; isCustomer?: boolean }) {
  const { t, formatNumber, formatDateTime } = useI18n();
  const visible = vehicles.filter((vehicle) => vehicle.location);
  const markerIcon = (vehicle: Vehicle) => {
    const style = vehicle.markerStyle || 'DOT';
    const size = vehicle.markerSize === 'SMALL' ? 28 : vehicle.markerSize === 'LARGE' ? 44 : 36;
    const color = markerColorHex[vehicle.markerColor] ?? markerColorHex.BLUE;
    const glyph = style === 'DOT' ? '' : markerGlyph(vehicle.kind);
    const className = `vehicle-map-marker style-${style.toLowerCase().replace('_', '-')} ${vehicle.device?.status === 'ONLINE' ? 'online' : 'offline'}`;
    return L.divIcon({
      className: 'vehicle-marker-host',
      html: `<span class="${className}" style="--marker-color:${color};--marker-heading:${vehicle.location?.heading ?? 0}deg">${glyph}</span>`,
      iconSize: [style === 'STATUS' ? size + 16 : size, size],
      iconAnchor: [style === 'STATUS' ? (size + 16) / 2 : size / 2, style === 'PIN' ? size : size / 2],
      popupAnchor: [0, -size / 2]
    });
  };
  return (
    <div className={`live-map ${tall ? 'tall' : ''}`}>
      <MapContainer center={[52.52, 13.405]} zoom={12} zoomControl={false} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitFleet vehicles={visible} />
        {visible.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.location!.latitude, vehicle.location!.longitude]}
            icon={markerIcon(vehicle)}
          >
            <Popup>
              <div className="map-popup">
                <strong>{vehicle.name}</strong>
                <span><LtrText>{vehicle.plate}</LtrText></span>
                <b>{t('portal.vehicles.speedKph', { speed: formatNumber(vehicle.location!.speedKph) })}</b>
                <small>{t('portal.map.reportedAt', { time: formatDateTime(vehicle.location!.occurredAt, { timeStyle: 'short' }) })}</small>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-float"><LocateFixed size={15} /><strong>{formatNumber(visible.length)}</strong> {t('portal.map.visibleNow')}</div>
      {visible.length === 0 && (
        <div className="map-locked">
          <LockKeyhole />
          <strong>{isCustomer ? t('portal.map.customerNoLocationsTitle') : t('portal.map.resellerLocationsPrivateTitle')}</strong>
          <span>{isCustomer ? t('portal.map.customerNoLocationsSubtitle') : t('portal.map.resellerLocationsPrivateSubtitle')}</span>
        </div>
      )}
    </div>
  );
}
