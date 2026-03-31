import type { z } from 'zod';
import type { UCPSpecOrderSchema } from '../schemas.js';

export type UCPSpecOrder = z.output<typeof UCPSpecOrderSchema>;

export interface WebhookEvent {
  readonly event_id: string;
  readonly created_time: string;
  readonly order: UCPSpecOrder;
  readonly [key: string]: unknown;
}
