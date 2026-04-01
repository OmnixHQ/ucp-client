import type { z } from 'zod';
import type { CheckoutResponseStatus } from '@omnixhq/ucp-js-sdk';
import type {
  CheckoutSessionSchema,
  CheckoutCreateRequestSchema,
  CheckoutUpdateRequestSchema,
  CheckoutCompleteRequestSchema,
  FulfillmentMethodCreateRequestSchema,
  FulfillmentMethodUpdateRequestSchema,
  FulfillmentGroupUpdateRequestSchema,
} from '../schemas.js';

export type CheckoutSession = z.output<typeof CheckoutSessionSchema>;
export type CheckoutSessionStatus = CheckoutResponseStatus;

export interface CheckoutExtensions {
  readonly fulfillment: boolean;
  readonly discount: boolean;
  readonly buyerConsent: boolean;
  readonly ap2Mandate: boolean;
}

export type CreateCheckoutPayload = z.output<typeof CheckoutCreateRequestSchema>;
export type UpdateCheckoutPayload = z.output<typeof CheckoutUpdateRequestSchema>;
export type CompleteCheckoutPayload = z.output<typeof CheckoutCompleteRequestSchema>;

export type FulfillmentMethodCreatePayload = z.output<typeof FulfillmentMethodCreateRequestSchema>;
export type FulfillmentMethodUpdatePayload = z.output<typeof FulfillmentMethodUpdateRequestSchema>;
export type FulfillmentGroupUpdatePayload = z.output<typeof FulfillmentGroupUpdateRequestSchema>;
