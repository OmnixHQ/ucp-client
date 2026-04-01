import type { HttpClient } from '../http.js';
import { UCPEscalationError } from '../errors.js';
import { CheckoutSessionSchema } from '../schemas.js';
import type {
  CheckoutSession,
  CheckoutExtensions,
  CreateCheckoutPayload,
  UpdateCheckoutPayload,
  CompleteCheckoutPayload,
  FulfillmentMethodCreatePayload,
  FulfillmentMethodUpdatePayload,
  FulfillmentGroupUpdatePayload,
} from '../types/checkout.js';

const DEFAULT_METHOD_ID = 'default';
const DEFAULT_GROUP_ID = 'default';

/** Internal payload shape for PUT /checkout-sessions/:id with fulfillment/discount fields. */
interface FulfillmentDiscountPatch {
  readonly fulfillment?: {
    readonly methods?: ReadonlyArray<{
      readonly id: string;
      readonly type?: string;
      readonly selected_destination_id?: string;
      readonly groups?: ReadonlyArray<{
        readonly id: string;
        readonly selected_option_id?: string;
      }>;
    }>;
  };
  readonly discounts?: {
    readonly codes?: readonly string[];
  };
}

/**
 * Checkout session operations. Available when the server declares `dev.ucp.shopping.checkout`.
 * Check `extensions` to see which optional features (fulfillment, discount, etc.) are supported.
 */
export class CheckoutCapability {
  /** Which checkout extensions the server supports. */
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
    const data = await this.http.request(
      'PUT',
      `/checkout-sessions/${encodeURIComponent(id)}`,
      patch,
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

  async setFulfillment(id: string, type: string): Promise<CheckoutSession> {
    return this.patchFulfillmentDiscount(id, {
      fulfillment: { methods: [{ id: DEFAULT_METHOD_ID, type }] },
    });
  }

  async selectDestination(
    id: string,
    destinationId: string,
    fulfillmentType = 'shipping',
  ): Promise<CheckoutSession> {
    return this.patchFulfillmentDiscount(id, {
      fulfillment: {
        methods: [
          { id: DEFAULT_METHOD_ID, type: fulfillmentType, selected_destination_id: destinationId },
        ],
      },
    });
  }

  async selectFulfillmentOption(
    id: string,
    optionId: string,
    destinationId?: string,
    fulfillmentType = 'shipping',
  ): Promise<CheckoutSession> {
    return this.patchFulfillmentDiscount(id, {
      fulfillment: {
        methods: [
          {
            id: DEFAULT_METHOD_ID,
            type: fulfillmentType,
            ...(destinationId !== undefined ? { selected_destination_id: destinationId } : {}),
            groups: [{ id: DEFAULT_GROUP_ID, selected_option_id: optionId }],
          },
        ],
      },
    });
  }

  async applyDiscountCodes(id: string, codes: readonly string[]): Promise<CheckoutSession> {
    return this.patchFulfillmentDiscount(id, { discounts: { codes: [...codes] } });
  }

  async createFulfillmentMethod(
    id: string,
    payload: FulfillmentMethodCreatePayload,
  ): Promise<CheckoutSession> {
    const data = await this.http.request(
      'POST',
      `/checkout-sessions/${encodeURIComponent(id)}/fulfillment/methods`,
      payload,
    );
    return this.validateSession(data);
  }

  async updateFulfillmentMethod(
    id: string,
    methodId: string,
    payload: FulfillmentMethodUpdatePayload,
  ): Promise<CheckoutSession> {
    const data = await this.http.request(
      'PUT',
      `/checkout-sessions/${encodeURIComponent(id)}/fulfillment/methods/${encodeURIComponent(methodId)}`,
      payload,
    );
    return this.validateSession(data);
  }

  async updateFulfillmentGroup(
    id: string,
    methodId: string,
    groupId: string,
    payload: FulfillmentGroupUpdatePayload,
  ): Promise<CheckoutSession> {
    const data = await this.http.request(
      'PUT',
      `/checkout-sessions/${encodeURIComponent(id)}/fulfillment/methods/${encodeURIComponent(methodId)}/groups/${encodeURIComponent(groupId)}`,
      payload,
    );
    return this.validateSession(data);
  }

  private async patchFulfillmentDiscount(
    id: string,
    patch: FulfillmentDiscountPatch,
  ): Promise<CheckoutSession> {
    const data = await this.http.request(
      'PUT',
      `/checkout-sessions/${encodeURIComponent(id)}`,
      patch,
    );
    return this.validateSession(data);
  }

  private validateSession(data: unknown): CheckoutSession {
    const session = this.http.validate(data, CheckoutSessionSchema);

    if (session.status === 'requires_escalation' && session.continue_url) {
      throw new UCPEscalationError(session.continue_url);
    }

    return session;
  }
}
