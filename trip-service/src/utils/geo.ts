/**
 * Haversine great-circle distance.
 *
 * Returns the shortest distance over the Earth's surface between two
 * coordinate pairs, in **metres**.
 *
 * Accuracy: < 0.3 % error over typical school-route distances (< 50 km).
 * The formula assumes a spherical Earth (radius 6 371 000 m); the actual
 * oblate-spheroid deviation is well within the tolerance of a 1 km geofence.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R  = 6_371_000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
