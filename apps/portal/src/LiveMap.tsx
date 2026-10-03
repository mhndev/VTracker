import { useEffect } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { LockKeyhole, LocateFixed } from 'lucide-react';
import type { Vehicle } from './types';

function FitFleet({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();
  useEffect(() => {
    const points = vehicles.flatMap((vehicle) => vehicle.location ? [[vehicle.location.latitude, vehicle.location.longitude] as L.LatLngTuple] : []);
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 14 });
  }, [map, vehicles]);
  return null;
}

export default function LiveMap({ vehicles, tall = false }: { vehicles: Vehicle[]; tall?: boolean }) {
  const visible = vehicles.filter((vehicle) => vehicle.location);
  return (
    <div className={`live-map ${tall ? 'tall' : ''}`}>
      <MapContainer center={[52.52, 13.405]} zoom={12} zoomControl={false} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitFleet vehicles={visible} />
        {visible.map((vehicle) => (
          <CircleMarker
            key={vehicle.id}
            center={[vehicle.location!.latitude, vehicle.location!.longitude]}
            radius={10}
            pathOptions={{ color: '#fff', weight: 4, fillColor: vehicle.device?.status === 'ONLINE' ? '#6558f5' : '#f59e0b', fillOpacity: 1 }}
          >
            <Popup>
              <div className="map-popup"><strong>{vehicle.name}</strong><span>{vehicle.plate}</span><b>{vehicle.location!.speedKph} km/h</b><small>Reported {new Date(vehicle.location!.occurredAt).toLocaleTimeString()}</small></div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-float"><LocateFixed size={15} /><strong>{visible.length}</strong> visible now</div>
      {visible.length === 0 && <div className="map-locked"><LockKeyhole /><strong>Locations are private</strong><span>Customer approval is required for this view.</span></div>}
    </div>
  );
}
