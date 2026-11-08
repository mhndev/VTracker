const EARTH_RADIUS_METERS = 6_371_000;

export function parseCoordinateQuery(value) {
  const match = String(value || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
}

export function distanceMeters(a, b) {
  const radians = value => value * Math.PI / 180;
  const latitudeDelta = radians(b[1] - a[1]);
  const longitudeDelta = radians(b[0] - a[0]);
  const startLatitude = radians(a[1]);
  const endLatitude = radians(b[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function headingDegrees(a, b) {
  const radians = value => value * Math.PI / 180;
  const degrees = value => value * 180 / Math.PI;
  const startLatitude = radians(a[1]);
  const endLatitude = radians(b[1]);
  const longitudeDelta = radians(b[0] - a[0]);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x = Math.cos(startLatitude) * Math.sin(endLatitude) - Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function prepareGeometry(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('A route needs at least two coordinates.');
  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) cumulative.push(cumulative[index - 1] + distanceMeters(coordinates[index - 1], coordinates[index]));
  return { coordinates, cumulative, distance: cumulative.at(-1) || 0 };
}

export function pointAlongGeometry(prepared, progress) {
  const normalized = Math.max(0, Math.min(1, Number(progress) || 0));
  const target = prepared.distance * normalized;
  let index = prepared.cumulative.findIndex(distance => distance >= target);
  if (index <= 0) index = 1;
  if (index >= prepared.coordinates.length) index = prepared.coordinates.length - 1;
  const start = prepared.coordinates[index - 1];
  const end = prepared.coordinates[index];
  const segmentStart = prepared.cumulative[index - 1];
  const segmentLength = Math.max(1, prepared.cumulative[index] - segmentStart);
  const ratio = Math.max(0, Math.min(1, (target - segmentStart) / segmentLength));
  return {
    latitude: start[1] + (end[1] - start[1]) * ratio,
    longitude: start[0] + (end[0] - start[0]) * ratio,
    heading: headingDegrees(start, end)
  };
}
