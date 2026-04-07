export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'trip.started':   'Trip started',
  'trip.ended':     'Trip ended',
  'sos.triggered':  'SOS triggered',
  'sos.cancelled':  'SOS cancelled',
};

export type WebhookEvent = 'trip.started' | 'trip.ended' | 'sos.triggered' | 'sos.cancelled';

export interface Webhook {
  id:        string;
  tenantId:  string;
  url:       string;
  events:    WebhookEvent[];
  isActive:  boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookDelivery {
  id:            string;
  tenantId:      string;
  webhookId:     string;
  event:         WebhookEvent;
  status:        'pending' | 'success' | 'failed';
  statusCode:    number | null;
  attempts:      number;
  lastAttemptAt: number | null;
  createdAt:     number;
}

export interface CreateWebhookInput {
  url:    string;
  events: WebhookEvent[];
}
