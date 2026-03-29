export interface Stop {
  id:                     string;
  tenantId:               string;
  routeId:                string;
  name:                   string;
  sequence:               number;
  lat:                    number;
  lon:                    number;
  estimatedOffsetMinutes: number;
  createdAt:              number;
  updatedAt:              number;
}

export interface CreateStopInput {
  name:                   string;
  sequence:               number;
  lat:                    number;
  lon:                    number;
  estimatedOffsetMinutes: number;
}
