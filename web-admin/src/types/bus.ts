export type BusStatus   = 'active' | 'inactive' | 'maintenance';
export type VehicleType = 'bus' | 'minibus' | 'van' | 'suv';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  bus:     'Bus',
  minibus: 'Minibus',
  van:     'Van',
  suv:     'SUV / MPV',
};

export interface Bus {
  id:                 string;
  tenantId:           string;
  registrationNumber: string;
  make:               string;
  model:              string;
  year:               number;
  capacity:           number;
  vehicleType:        VehicleType;
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
  vehicleType:        VehicleType;
}
