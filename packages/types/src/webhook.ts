import { z } from 'zod';

export const WEBHOOK_EVENTS = [
  'trip.started',
  'trip.ended',
  'sos.triggered',
  'sos.cancelled',
  // Geofencing
  'bus.approaching_stop',
  // Safety alerts
  'bus.speeding',
  'bus.rash_driving',
  // Attendance
  'student.boarded',
  'student.deboarded',
] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export const WebhookSchema = z.object({
  id:        z.string(),
  tenantId:  z.string(),
  url:       z.string().url().max(500),
  events:    z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive:  z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  // secret is stored in Firestore but NEVER returned to API clients
});
export type Webhook = z.infer<typeof WebhookSchema>;

export const CreateWebhookSchema = z.object({
  url:    z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
});
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'success', 'failed'] as const;
export type WebhookDeliveryStatus = typeof WEBHOOK_DELIVERY_STATUSES[number];

export const WebhookDeliverySchema = z.object({
  id:            z.string(),
  tenantId:      z.string(),
  webhookId:     z.string(),
  event:         z.enum(WEBHOOK_EVENTS),
  status:        z.enum(WEBHOOK_DELIVERY_STATUSES),
  statusCode:    z.number().nullable(),
  attempts:      z.number(),
  lastAttemptAt: z.number().nullable(),
  createdAt:     z.number(),
});
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;
