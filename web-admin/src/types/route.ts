export interface Route {
  id:          string;
  tenantId:    string;
  name:        string;
  description: string | null;
  isActive:    boolean;
  createdAt:   number;
  updatedAt:   number;
}

export interface CreateRouteInput {
  name:        string;
  description: string | null;
}
