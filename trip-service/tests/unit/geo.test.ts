import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../../src/utils/geo';

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });

  it('returns ~111 195 m for exactly 1 degree of latitude', () => {
    const dist = haversineMeters(0, 0, 1, 0);
    // Spherical Earth: 1° lat ≈ 111 195 m; allow ±1 % tolerance
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_500);
  });

  it('returns ~111 195 m for exactly 1 degree of longitude at equator', () => {
    const dist = haversineMeters(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_500);
  });

  it('1 km geofence: returns < 1000 for two points ~900 m apart', () => {
    // Bengaluru: MG Road to approx 900 m east
    const dist = haversineMeters(12.9716, 77.6099, 12.9716, 77.6180);
    expect(dist).toBeLessThan(1_000);
    expect(dist).toBeGreaterThan(500);
  });

  it('1 km geofence: returns > 1000 for two points ~1.5 km apart', () => {
    // Bengaluru: MG Road to approx 1.5 km north
    const dist = haversineMeters(12.9716, 77.6099, 12.9851, 77.6099);
    expect(dist).toBeGreaterThan(1_000);
  });

  it('known city-pair: Bengaluru to Mysuru ≈ 128 km straight-line', () => {
    // Bengaluru Central ↔ Mysuru Central (approximate coords).
    // Air distance is ~128 km (road is ~140 km — different concept).
    const dist = haversineMeters(12.9784, 77.5909, 12.2958, 76.6394);
    expect(dist).toBeGreaterThan(126_000);
    expect(dist).toBeLessThan(131_000);
  });

  it('is symmetric: d(A,B) === d(B,A)', () => {
    const ab = haversineMeters(12.9716, 77.5946, 13.0827, 80.2707);
    const ba = haversineMeters(13.0827, 80.2707, 12.9716, 77.5946);
    expect(ab).toBeCloseTo(ba, 0); // within 0.5 m
  });
});
