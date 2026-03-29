export interface Driver {
  id:            string;
  tenantId:      string;
  email:         string;
  name:          string;
  phone:         string;
  licenseNumber: string;
  busId:         string | null;
  isActive:      boolean;
  createdAt:     number;
  updatedAt:     number;
}

export interface CreateDriverInput {
  email:         string;
  name:          string;
  phone:         string;
  licenseNumber: string;
  busId?:        string | null;
}
