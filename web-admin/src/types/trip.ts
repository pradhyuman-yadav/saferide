export type TripStatus = 'active' | 'ended';

export interface Trip {
  id:                 string;
  tenantId:           string;
  driverId:           string;
  busId:              string;
  routeId:            string;
  status:             TripStatus;
  startedAt:          number;
  endedAt?:           number;
  latestLat?:         number;
  latestLon?:         number;
  latestSpeed?:       number;
  latestHeading?:     number;
  latestRecordedAt?:  number;
  sosActive?:         boolean;
  sosTriggeredAt?:    number;
  createdAt:          number;
  updatedAt:          number;
}
