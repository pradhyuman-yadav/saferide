import { MOCK_BUS, MOCK_FLEET, simulateBusMovement } from '../fixtures/bus.fixture';

describe('MOCK_BUS', () => {
  it('has all required BusState fields', () => {
    expect(MOCK_BUS.busId).toBeDefined();
    expect(MOCK_BUS.busNumber).toBeDefined();
    expect(MOCK_BUS.driverName).toBeDefined();
    expect(MOCK_BUS.routeName).toBeDefined();
    expect(MOCK_BUS.coords).toBeDefined();
    expect(MOCK_BUS.heading).toBeDefined();
    expect(MOCK_BUS.speedKmh).toBeDefined();
    expect(MOCK_BUS.status).toBeDefined();
    expect(MOCK_BUS.etaMinutes).toBeDefined();
    expect(MOCK_BUS.nextStop).toBeDefined();
    expect(MOCK_BUS.stops).toBeDefined();
    expect(MOCK_BUS.lastUpdated).toBeDefined();
  });

  it('coordinates are within Bangalore bounds', () => {
    // Bangalore rough bounding box: lat 12.8–13.1, lon 77.4–77.8
    expect(MOCK_BUS.coords.latitude).toBeGreaterThan(12.8);
    expect(MOCK_BUS.coords.latitude).toBeLessThan(13.1);
    expect(MOCK_BUS.coords.longitude).toBeGreaterThan(77.4);
    expect(MOCK_BUS.coords.longitude).toBeLessThan(77.8);
  });

  it('has at least one stop', () => {
    expect(MOCK_BUS.stops.length).toBeGreaterThan(0);
  });

  it('each stop has id, name, coords, etaMinutes, reached', () => {
    MOCK_BUS.stops.forEach((stop) => {
      expect(stop.id).toBeDefined();
      expect(stop.name).toBeDefined();
      expect(stop.coords.latitude).toBeDefined();
      expect(stop.coords.longitude).toBeDefined();
      expect(typeof stop.etaMinutes).toBe('number');
      expect(typeof stop.reached).toBe('boolean');
    });
  });

  it('speed is a non-negative number', () => {
    expect(MOCK_BUS.speedKmh).toBeGreaterThanOrEqual(0);
  });

  it('status is a valid BusState status', () => {
    expect(['on_route', 'delayed', 'stopped', 'offline']).toContain(MOCK_BUS.status);
  });

  it('lastUpdated is a recent Unix timestamp', () => {
    const fiveSecondsAgo = Date.now() - 5000;
    expect(MOCK_BUS.lastUpdated).toBeGreaterThan(fiveSecondsAgo);
  });
});

describe('MOCK_FLEET', () => {
  it('has at least 2 buses for fleet view', () => {
    expect(MOCK_FLEET.length).toBeGreaterThanOrEqual(2);
  });

  it('all fleet buses have unique busIds', () => {
    const ids = MOCK_FLEET.map((b) => b.busId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all fleet buses have activeParents count', () => {
    MOCK_FLEET.forEach((b) => {
      expect(typeof b.activeParents).toBe('number');
      expect(b.activeParents).toBeGreaterThanOrEqual(0);
    });
  });

  it('fleet covers at least 2 different statuses', () => {
    const statuses = new Set(MOCK_FLEET.map((b) => b.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);
  });
});

describe('simulateBusMovement', () => {
  it('returns a new BusState object (does not mutate input)', () => {
    const original = { ...MOCK_BUS };
    const result = simulateBusMovement(MOCK_BUS);
    expect(result).not.toBe(MOCK_BUS);
    expect(MOCK_BUS.coords.latitude).toBe(original.coords.latitude);
  });

  it('changes coordinates slightly', () => {
    const result = simulateBusMovement(MOCK_BUS);
    // At least one coordinate should differ (probabilistic — runs 100x to be safe)
    let diffFound = false;
    for (let i = 0; i < 100; i++) {
      const r = simulateBusMovement(MOCK_BUS);
      if (
        r.coords.latitude  !== MOCK_BUS.coords.latitude ||
        r.coords.longitude !== MOCK_BUS.coords.longitude
      ) {
        diffFound = true;
        break;
      }
    }
    expect(diffFound).toBe(true);
  });

  it('updates lastUpdated to current time', () => {
    const before = Date.now();
    const result = simulateBusMovement(MOCK_BUS);
    expect(result.lastUpdated).toBeGreaterThanOrEqual(before);
  });

  it('preserves all non-coordinate fields', () => {
    const result = simulateBusMovement(MOCK_BUS);
    expect(result.busId).toBe(MOCK_BUS.busId);
    expect(result.busNumber).toBe(MOCK_BUS.busNumber);
    expect(result.driverName).toBe(MOCK_BUS.driverName);
    expect(result.status).toBe(MOCK_BUS.status);
    expect(result.etaMinutes).toBe(MOCK_BUS.etaMinutes);
  });
});
