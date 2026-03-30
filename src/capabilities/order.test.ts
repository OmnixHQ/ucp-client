import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderCapability } from './order.js';
import { HttpClient } from '../http.js';

const MINIMAL_ORDER = {
  id: 'ord_123',
  checkout_id: 'chk_456',
  permalink_url: 'https://store.example.com/orders/ord_123',
  ucp: { version: '2024-01-01' },
  line_items: [],
  fulfillment: {},
  totals: [],
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

let http: HttpClient;
let capability: OrderCapability;

beforeEach(() => {
  mockFetch.mockReset();
  http = new HttpClient({
    gatewayUrl: 'https://gateway.example.com',
    agentProfileUrl: 'https://agent.example.com/profile',
    ucpVersion: '2024-01-01',
  });
  capability = new OrderCapability(http);
});

describe('OrderCapability.get', () => {
  it('sends GET /orders/:id and returns validated order', async () => {
    mockOk(MINIMAL_ORDER);
    const order = await capability.get('ord_123');
    expect(order.id).toBe('ord_123');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/orders/ord_123')).toBe(true);
    expect(init.method).toBe('GET');
  });

  it('URL-encodes the order ID', async () => {
    mockOk({ ...MINIMAL_ORDER, id: 'ord/with/slashes' });
    await capability.get('ord/with/slashes');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/orders/ord%2Fwith%2Fslashes');
  });

  it('throws on 404', async () => {
    mockError(404);
    await expect(capability.get('ord_missing')).rejects.toThrow();
  });
});

describe('OrderCapability.update', () => {
  it('sends PUT /orders/:id with payload and returns validated order', async () => {
    mockOk(MINIMAL_ORDER);
    const order = await capability.update('ord_123', { fulfillment: { status: 'shipped' } });
    expect(order.id).toBe('ord_123');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/orders/ord_123')).toBe(true);
    expect(init.method).toBe('PUT');
    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody['fulfillment']).toEqual({ status: 'shipped' });
  });

  it('URL-encodes the order ID on update', async () => {
    mockOk({ ...MINIMAL_ORDER, id: 'ord/123' });
    await capability.update('ord/123', {});
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/orders/ord%2F123');
  });

  it('sends empty payload when no fields provided', async () => {
    mockOk(MINIMAL_ORDER);
    await capability.update('ord_123', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it('throws on gateway error', async () => {
    mockError(422, {
      messages: [{ type: 'error', code: 'INVALID_UPDATE', content: 'Cannot update order' }],
    });
    await expect(capability.update('ord_123', {})).rejects.toThrow('Cannot update order');
  });
});
