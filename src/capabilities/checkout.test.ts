import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutCapability } from './checkout.js';
import { HttpClient } from '../http.js';
import { UCPError, UCPIdempotencyConflictError } from '../errors.js';

const MINIMAL_SESSION = {
  id: 'chk_123',
  ucp: { version: '2024-01-01' },
  status: 'open',
  line_items: [],
  totals: [],
  messages: [],
};

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, body: unknown = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockNetworkFailure() {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

let http: HttpClient;
let capability: CheckoutCapability;

beforeEach(() => {
  mockFetch.mockReset();
  http = new HttpClient({
    gatewayUrl: 'https://gateway.example.com',
    agentProfileUrl: 'https://agent.example.com/profile',
    ucpVersion: '2024-01-01',
  });
  capability = new CheckoutCapability(http, {
    fulfillment: true,
    discount: true,
    buyerConsent: false,
    ap2Mandate: false,
  });
});

describe('CheckoutCapability.createFulfillmentMethod', () => {
  it('sends POST /checkout-sessions/:id/fulfillment/methods and returns session', async () => {
    mockOk(MINIMAL_SESSION);
    const result = await capability.createFulfillmentMethod('chk_123', { type: 'shipping' });
    expect(result).toMatchObject({ id: 'chk_123' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/checkout-sessions/chk_123/fulfillment/methods')).toBe(true);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['type']).toBe('shipping');
  });

  it('includes optional line_item_ids in request body', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.createFulfillmentMethod('chk_123', {
      type: 'pickup',
      line_item_ids: ['li_1', 'li_2'],
    });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['line_item_ids']).toEqual(['li_1', 'li_2']);
  });

  it('sends idempotency-key header on POST', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.createFulfillmentMethod('chk_123', { type: 'shipping' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeDefined();
  });

  it('URL-encodes the session ID', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.createFulfillmentMethod('chk/123', { type: 'shipping' });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/checkout-sessions/chk%2F123/fulfillment/methods');
  });

  it('throws UCPError on 404', async () => {
    mockError(404);
    await expect(
      capability.createFulfillmentMethod('chk_missing', { type: 'shipping' }),
    ).rejects.toBeInstanceOf(UCPError);
  });

  it('throws UCPIdempotencyConflictError on 409', async () => {
    mockError(409);
    await expect(
      capability.createFulfillmentMethod('chk_123', { type: 'shipping' }),
    ).rejects.toBeInstanceOf(UCPIdempotencyConflictError);
  });

  it('propagates network errors', async () => {
    mockNetworkFailure();
    await expect(
      capability.createFulfillmentMethod('chk_123', { type: 'shipping' }),
    ).rejects.toThrow('Failed to fetch');
  });
});

describe('CheckoutCapability.updateFulfillmentMethod', () => {
  it('sends PUT /checkout-sessions/:id/fulfillment/methods/:methodId and returns session', async () => {
    mockOk(MINIMAL_SESSION);
    const result = await capability.updateFulfillmentMethod('chk_123', 'method_1', {
      line_item_ids: ['li_1'],
    });
    expect(result).toMatchObject({ id: 'chk_123' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/checkout-sessions/chk_123/fulfillment/methods/method_1')).toBe(true);
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['line_item_ids']).toEqual(['li_1']);
  });

  it('URL-encodes both session ID and method ID', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.updateFulfillmentMethod('chk/123', 'method/1', { line_item_ids: [] });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/checkout-sessions/chk%2F123/fulfillment/methods/method%2F1');
  });

  it('sends idempotency-key header on PUT', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.updateFulfillmentMethod('chk_123', 'method_1', { line_item_ids: [] });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeDefined();
  });

  it('throws UCPError on 404', async () => {
    mockError(404);
    await expect(
      capability.updateFulfillmentMethod('chk_123', 'method_missing', { line_item_ids: [] }),
    ).rejects.toBeInstanceOf(UCPError);
  });

  it('throws UCPIdempotencyConflictError on 409', async () => {
    mockError(409);
    await expect(
      capability.updateFulfillmentMethod('chk_123', 'method_1', { line_item_ids: [] }),
    ).rejects.toBeInstanceOf(UCPIdempotencyConflictError);
  });

  it('propagates network errors', async () => {
    mockNetworkFailure();
    await expect(
      capability.updateFulfillmentMethod('chk_123', 'method_1', { line_item_ids: [] }),
    ).rejects.toThrow('Failed to fetch');
  });
});

describe('CheckoutCapability.updateFulfillmentGroup', () => {
  it('sends PUT /checkout-sessions/:id/fulfillment/methods/:methodId/groups/:groupId', async () => {
    mockOk(MINIMAL_SESSION);
    const result = await capability.updateFulfillmentGroup('chk_123', 'method_1', 'group_1', {
      id: 'group_1',
    });
    expect(result).toMatchObject({ id: 'chk_123' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(
      url.endsWith('/checkout-sessions/chk_123/fulfillment/methods/method_1/groups/group_1'),
    ).toBe(true);
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['id']).toBe('group_1');
  });

  it('URL-encodes all ID segments', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.updateFulfillmentGroup('chk/1', 'method/1', 'group/1', { id: 'group/1' });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(
      '/checkout-sessions/chk%2F1/fulfillment/methods/method%2F1/groups/group%2F1',
    );
  });

  it('sends idempotency-key header on PUT', async () => {
    mockOk(MINIMAL_SESSION);
    await capability.updateFulfillmentGroup('chk_123', 'method_1', 'group_1', { id: 'group_1' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeDefined();
  });

  it('throws UCPError on 404', async () => {
    mockError(404);
    await expect(
      capability.updateFulfillmentGroup('chk_123', 'method_1', 'group_missing', {
        id: 'group_missing',
      }),
    ).rejects.toBeInstanceOf(UCPError);
  });

  it('throws UCPIdempotencyConflictError on 409', async () => {
    mockError(409);
    await expect(
      capability.updateFulfillmentGroup('chk_123', 'method_1', 'group_1', { id: 'group_1' }),
    ).rejects.toBeInstanceOf(UCPIdempotencyConflictError);
  });

  it('propagates network errors', async () => {
    mockNetworkFailure();
    await expect(
      capability.updateFulfillmentGroup('chk_123', 'method_1', 'group_1', { id: 'group_1' }),
    ).rejects.toThrow('Failed to fetch');
  });
});
