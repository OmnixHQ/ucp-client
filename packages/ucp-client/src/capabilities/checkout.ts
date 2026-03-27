import type { HttpClient } from '../http.js';
import { validateCheckoutSession } from '../http.js';
import { CheckoutSessionSchema } from '../schemas.js';
import type {
  CheckoutSession,
  CheckoutExtensions,
  CreateCheckoutPayload,
  UpdateCheckoutPayload,
  CompleteCheckoutPayload,
} from '../types/checkout.js';

export class CheckoutCapability {
  readonly extensions: CheckoutExtensions;

  constructor(
    private readonly http: HttpClient,
    extensions: CheckoutExtensions,
  ) {
    this.extensions = extensions;
  }

  async create(payload: CreateCheckoutPayload): Promise<CheckoutSession> {
    const data = await this.http.request('POST', '/checkout-sessions', payload);
    return this.validateSession(data);
  }

  async get(id: string): Promise<CheckoutSession> {
    const data = await this.http.request('GET', `/checkout-sessions/${encodeURIComponent(id)}`);
    return this.validateSession(data);
  }

  async update(id: string, patch: UpdateCheckoutPayload): Promise<CheckoutSession> {
    const body = { ...patch, id };
    const data = await this.http.request(
      'PUT',
      `/checkout-sessions/${encodeURIComponent(id)}`,
      body,
    );
    return this.validateSession(data);
  }

  async complete(id: string, payload: CompleteCheckoutPayload): Promise<CheckoutSession> {
    const data = await this.http.request(
      'POST',
      `/checkout-sessions/${encodeURIComponent(id)}/complete`,
      payload,
    );
    return this.validateSession(data);
  }

  async cancel(id: string): Promise<CheckoutSession> {
    const data = await this.http.request(
      'POST',
      `/checkout-sessions/${encodeURIComponent(id)}/cancel`,
    );
    return this.validateSession(data);
  }

  async setFulfillment(
    id: string,
    type: string,
    patch?: UpdateCheckoutPayload,
  ): Promise<CheckoutSession> {
    return this.update(id, {
      ...patch,
      fulfillment: { methods: [{ id: 'default', type }] },
    });
  }

  async selectDestination(
    id: string,
    destinationId: string,
    fulfillmentType = 'shipping',
    patch?: UpdateCheckoutPayload,
  ): Promise<CheckoutSession> {
    return this.update(id, {
      ...patch,
      fulfillment: {
        methods: [{ id: 'default', type: fulfillmentType, selected_destination_id: destinationId }],
      },
    });
  }

  async selectFulfillmentOption(
    id: string,
    optionId: string,
    destinationId?: string,
    fulfillmentType = 'shipping',
    patch?: UpdateCheckoutPayload,
  ): Promise<CheckoutSession> {
    return this.update(id, {
      ...patch,
      fulfillment: {
        methods: [
          {
            id: 'default',
            type: fulfillmentType,
            ...(destinationId !== undefined ? { selected_destination_id: destinationId } : {}),
            groups: [{ id: 'default', selected_option_id: optionId }],
          },
        ],
      },
    });
  }

  async applyDiscountCodes(
    id: string,
    codes: readonly string[],
    patch?: UpdateCheckoutPayload,
  ): Promise<CheckoutSession> {
    return this.update(id, {
      ...patch,
      discounts: { codes: [...codes] },
    });
  }

  private validateSession(data: unknown): CheckoutSession {
    return validateCheckoutSession(this.http, data, CheckoutSessionSchema) as CheckoutSession;
  }
}
