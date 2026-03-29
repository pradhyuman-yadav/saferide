export interface GpsTelemetry {
  id:          string;
  tenantId:    string;
  tripId:      string;
  driverId:    string;
  busId:       string;
  lat:         number;
  lon:         number;
  speed?:      number;
  heading?:    number;
  accuracy?:   number;
  recordedAt:  number;
  createdAt:   number;
}
