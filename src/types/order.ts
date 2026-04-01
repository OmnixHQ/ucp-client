import type { z } from 'zod';
import type { UCPSpecOrderSchema, LineItemUpdateRequestSchema } from '../schemas.js';

export type UCPSpecOrder = z.output<typeof UCPSpecOrderSchema>;

export type LineItemUpdatePayload = z.output<typeof LineItemUpdateRequestSchema>;

export interface WebhookEvent {
  readonly event_id: string;
  readonly created_time: string;
  readonly order: UCPSpecOrder;
  readonly [key: string]: unknown;
}
