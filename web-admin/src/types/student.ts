export interface Student {
  id:          string;
  tenantId:    string;
  name:        string;
  parentName:  string;
  parentPhone: string;
  parentEmail: string;
  busId:       string | null;
  stopId:      string | null;
  isActive:    boolean;
  createdAt:   number;
  updatedAt:   number;
}

export interface CreateStudentInput {
  name:        string;
  parentName:  string;
  parentPhone: string;
  parentEmail: string;
  busId?:      string | null;
  stopId?:     string | null;
}
