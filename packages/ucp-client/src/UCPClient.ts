import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import type {
  UCPClientConfig,
  SearchFilters,
  CreateCheckoutPayload,
  UpdateCheckoutPayload,
  CompleteCheckoutPayload,
  CheckoutSession,
  UCPProduct,
  UCPSpecOrder,
  UCPProfile,
} from './types.js';
import { UCPError, UCPEscalationError, UCPIdempotencyConflictError } from './errors.js';
import type { UCPMessage } from './errors.js';
import {
  CheckoutSessionSchema,
  UCPProfileSchema,
  UCPProductSchema,
  UCPSpecOrderSchema,
} from './schemas.js';

const DEFAULT_UCP_VERSION = '2026-01-23';

type HttpMethod = 'GET' | 'POST' | 'PUT';

export class UCPClient {
  private readonly gatewayUrl: string;
  private readonly agentProfileUrl: string;
  private readonly ucpVersion: string;
  private readonly requestSignature: string | undefined;

  constructor(config: UCPClientConfig) {
    new URL(config.gatewayUrl);
    if (config.agentProfileUrl.includes('"') || config.agentProfileUrl.includes('\n')) {
      throw new Error('agentProfileUrl must not contain double quotes or newlines');
    }
    new URL(config.agentProfileUrl);

    this.gatewayUrl = config.gatewayUrl.replace(/\/+$/, '');
    this.agentProfileUrl = config.agentProfileUrl;
    this.ucpVersion = config.ucpVersion ?? DEFAULT_UCP_VERSION;
    this.requestSignature = config.requestSignature;
  }

  async discover(): Promise<UCPProfile> {
    const data = await this.request('GET', '/.well-known/ucp');
    return this.validate(data, UCPProfileSchema) as UCPProfile;
  }

  async searchProducts(query: string, filters: SearchFilters = {}): Promise<UCPProduct[]> {
    const params = new URLSearchParams({ q: query });

    if (filters.max_price_cents != null) {
      params.set('max_price_cents', String(filters.max_price_cents));
    }
    if (filters.min_price_cents != null) {
      params.set('min_price_cents', String(filters.min_price_cents));
    }
    if (filters.in_stock != null) {
      params.set('in_stock', String(filters.in_stock));
    }
    if (filters.category != null) {
      params.set('category', filters.category);
    }
    if (filters.limit != null) {
      params.set('limit', String(filters.limit));
    }
    if (filters.page != null) {
      params.set('page', String(filters.page));
    }

    const res = await this.request('GET', `/ucp/products?${params.toString()}`);
    const data = res as { products?: UCPProduct[] } | UCPProduct[];
    const products = Array.isArray(data) ? data : (data.products ?? []);
    return products.map((p) => this.validate(p, UCPProductSchema) as UCPProduct);
  }

  async getProduct(id: string): Promise<UCPProduct> {
    const data = await this.request('GET', `/ucp/products/${encodeURIComponent(id)}`);
    return this.validate(data, UCPProductSchema) as UCPProduct;
  }

  async createCheckout(payload: CreateCheckoutPayload): Promise<CheckoutSession> {
    const data = await this.request('POST', '/checkout-sessions', payload);
    return this.validateCheckout(data);
  }

  async getCheckout(id: string): Promise<CheckoutSession> {
    const data = await this.request('GET', `/checkout-sessions/${encodeURIComponent(id)}`);
    return this.validateCheckout(data);
  }

  async updateCheckout(id: string, patch: UpdateCheckoutPayload): Promise<CheckoutSession> {
    const body = { ...patch, id };
    const data = await this.request('PUT', `/checkout-sessions/${encodeURIComponent(id)}`, body);
    return this.validateCheckout(data);
  }

  async completeCheckout(id: string, payload: CompleteCheckoutPayload): Promise<CheckoutSession> {
    const data = await this.request(
      'POST',
      `/checkout-sessions/${encodeURIComponent(id)}/complete`,
      payload,
    );
    return this.validateCheckout(data);
  }

  async cancelCheckout(id: string): Promise<CheckoutSession> {
    const data = await this.request('POST', `/checkout-sessions/${encodeURIComponent(id)}/cancel`);
    return this.validateCheckout(data);
  }

  // ── Fulfillment convenience methods ──────────────────────────────────────
  // These wrap updateCheckout with the correct fulfillment payload shape,
  // matching the multi-step flow from the official UCP sample client.

  async setFulfillment(
    id: string,
    type: string,
    patch?: UpdateCheckoutPayload,
  ): Promise<CheckoutSession> {
    return this.updateCheckout(id, {
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
    return this.updateCheckout(id, {
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
    return this.updateCheckout(id, {
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
    return this.updateCheckout(id, {
      ...patch,
      discounts: { codes: [...codes] },
    });
  }

  // ── Orders ─────────────────────────────────────────────────────────────

  async getOrder(id: string): Promise<UCPSpecOrder> {
    const data = await this.request('GET', `/orders/${encodeURIComponent(id)}`);
    return this.validate(data, UCPSpecOrderSchema) as UCPSpecOrder;
  }

  private validateCheckout(data: unknown): CheckoutSession {
    const session = this.validate(data, CheckoutSessionSchema) as CheckoutSession;

    if (session.status === 'requires_escalation' && session.continue_url) {
      throw new UCPEscalationError(session.continue_url);
    }

    return session;
  }

  private validate(data: unknown, schema: ZodType): unknown {
    const result = schema.safeParse(data);
    if (!result.success) {
      // Graceful degradation: warn but return unvalidated data
      // eslint-disable-next-line no-console
      console.warn('[UCPClient] Response validation failed:', result.error.message);
      return data;
    }
    return result.data;
  }

  private async request(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.gatewayUrl}${path}`;
    const requestId = randomUUID();

    const headers: Record<string, string> = {
      'UCP-Agent': `profile="${this.agentProfileUrl}", version="${this.ucpVersion}"`,
      'request-id': requestId,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.requestSignature !== undefined) {
      headers['request-signature'] = this.requestSignature;
    }

    if (method === 'POST' || method === 'PUT') {
      headers['idempotency-key'] = randomUUID();
    }

    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      this.throwFromResponse(data, res.status);
    }

    return data;
  }

  private throwFromResponse(data: unknown, statusCode: number): never {
    if (statusCode === 409) {
      throw new UCPIdempotencyConflictError();
    }

    if (typeof data !== 'object' || data === null) {
      throw new UCPError('HTTP_ERROR', `Gateway returned ${statusCode}`, 'error', statusCode);
    }

    const body = data as Record<string, unknown>;
    const rawMessages = body['messages'];

    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      const allMessages: UCPMessage[] = rawMessages.map((m: Record<string, unknown>) => {
        const rawType = String(m['type'] ?? 'error');
        const messageType = (['error', 'warning', 'info'].includes(rawType) ? rawType : 'error') as
          | 'error'
          | 'warning'
          | 'info';
        const msg: UCPMessage = {
          type: messageType,
          content: String(m['content'] ?? 'Unknown error'),
        };
        if (m['code'] !== undefined) (msg as { code: string }).code = String(m['code']);
        if (m['severity'] !== undefined)
          (msg as { severity: string }).severity = String(m['severity']);
        if (m['path'] !== undefined) (msg as { path: string }).path = String(m['path']);
        if (m['content_type'] !== undefined)
          (msg as { content_type: string }).content_type = String(m['content_type']);
        return msg;
      });

      const first = allMessages[0]!;
      const code = first.code ?? 'UNKNOWN';

      const options: {
        readonly type: 'error' | 'warning' | 'info';
        readonly path?: string;
        readonly contentType?: 'plain' | 'markdown';
        readonly messages: readonly UCPMessage[];
      } = { type: first.type, messages: allMessages };
      if (first.path !== undefined) (options as { path: string }).path = first.path;
      if (first.content_type !== undefined)
        (options as { contentType: string }).contentType = first.content_type;

      throw new UCPError(code, first.content, first.type, statusCode, options);
    }

    throw new UCPError('HTTP_ERROR', `Gateway returned ${statusCode}`, 'error', statusCode);
  }
}
