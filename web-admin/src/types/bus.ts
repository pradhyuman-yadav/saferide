export type BusStatus = 'active' | 'inactive' | 'maintenance';

export interface Bus {
  id:                 string;
  tenantId:           string;
  registrationNumber: string;
  make:               string;
  model:              string;
  year:               number;
  capacity:           number;
  driverId:           string | null;
  routeId:            string | null;
  status:             BusStatus;
  createdAt:          number;
  updatedAt:          number;
}

export interface CreateBusInput {
  registrationNumber: string;
  make:               string;
  model:              string;
  year:               number;
  capacity:           number;
}
