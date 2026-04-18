export interface CreateInviteInput {
  email:     string;
  name:      string;
  role:      'super_admin' | 'school_admin' | 'manager';
  tenantId?: string;
}

export interface InviteCreated {
  email:       string;
  name?:       string;
  role:        string;
  tenantId:    string | null;
  createdAt:   number;
}
