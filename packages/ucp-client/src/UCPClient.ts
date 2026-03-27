import type { UcpDiscoveryProfile } from '@ucp-js/sdk';
import { HttpClient } from './http.js';
import { UCPProfileSchema } from './schemas.js';
import { CheckoutCapability } from './capabilities/checkout.js';
import { OrderCapability } from './capabilities/order.js';
import { IdentityLinkingCapability } from './capabilities/identity-linking.js';
import { ProductsCapability } from './capabilities/products.js';
import type { UCPClientConfig } from './types/config.js';
import { DEFAULT_UCP_VERSION, UCP_CAPABILITIES } from './types/config.js';
import type { CheckoutExtensions } from './types/checkout.js';
import type { OAuthServerMetadata } from './types/identity-linking.js';
import type { PaymentHandlerMap } from './types/payment.js';

export type UCPProfile = UcpDiscoveryProfile;

export interface ToolDescriptor {
  readonly name: string;
  readonly capability: string;
  readonly description: string;
}

export interface ConnectedClient {
  readonly profile: UCPProfile;
  readonly checkout: CheckoutCapability | null;
  readonly order: OrderCapability | null;
  readonly identityLinking: IdentityLinkingCapability | null;
  readonly products: ProductsCapability;
  readonly paymentHandlers: PaymentHandlerMap;
  describeTools(): readonly ToolDescriptor[];
}

export class UCPClient {
  private constructor() {
    /* use UCPClient.connect() */
  }

  static async connect(config: UCPClientConfig): Promise<ConnectedClient> {
    validateConfig(config);

    const httpConfig: ConstructorParameters<typeof HttpClient>[0] = {
      gatewayUrl: config.gatewayUrl.replace(/\/+$/, ''),
      agentProfileUrl: config.agentProfileUrl,
      ucpVersion: config.ucpVersion ?? DEFAULT_UCP_VERSION,
    };
    if (config.requestSignature !== undefined) {
      (httpConfig as { requestSignature: string }).requestSignature = config.requestSignature;
    }
    const http = new HttpClient(httpConfig);

    const rawProfile = await http.request('GET', '/.well-known/ucp');
    const profile = http.validate(rawProfile, UCPProfileSchema) as UCPProfile;
    const capabilityNames = extractCapabilityNames(profile);

    const checkout = buildCheckoutCapability(http, capabilityNames);
    const order = capabilityNames.has(UCP_CAPABILITIES.ORDER) ? new OrderCapability(http) : null;

    const identityLinking = await buildIdentityLinking(http, config, capabilityNames);

    const products = new ProductsCapability(http);
    const paymentHandlers = extractPaymentHandlers(profile);

    return Object.freeze({
      profile,
      checkout,
      order,
      identityLinking,
      products,
      paymentHandlers,
      describeTools: () => buildToolDescriptors(checkout, order, identityLinking),
    });
  }
}

function validateConfig(config: UCPClientConfig): void {
  new URL(config.gatewayUrl);
  if (config.agentProfileUrl.includes('"') || config.agentProfileUrl.includes('\n')) {
    throw new Error('agentProfileUrl must not contain double quotes or newlines');
  }
  new URL(config.agentProfileUrl);
}

function extractCapabilityNames(profile: UCPProfile): Set<string> {
  const capabilities = profile.ucp?.capabilities;
  if (!Array.isArray(capabilities)) return new Set();
  return new Set(
    capabilities.map((c: { name?: string }) => c.name).filter((n): n is string => n !== undefined),
  );
}

function extractPaymentHandlers(profile: UCPProfile): PaymentHandlerMap {
  const raw = (profile as Record<string, unknown>)['payment_handlers'];
  if (typeof raw !== 'object' || raw === null) return {};
  return raw as PaymentHandlerMap;
}

function buildCheckoutCapability(
  http: HttpClient,
  capabilityNames: Set<string>,
): CheckoutCapability | null {
  if (!capabilityNames.has(UCP_CAPABILITIES.CHECKOUT)) return null;

  const extensions: CheckoutExtensions = {
    fulfillment: capabilityNames.has(UCP_CAPABILITIES.FULFILLMENT),
    discount: capabilityNames.has(UCP_CAPABILITIES.DISCOUNT),
    buyerConsent: capabilityNames.has(UCP_CAPABILITIES.BUYER_CONSENT),
    ap2Mandate: capabilityNames.has(UCP_CAPABILITIES.AP2_MANDATE),
  };

  return new CheckoutCapability(http, extensions);
}

async function buildIdentityLinking(
  http: HttpClient,
  config: UCPClientConfig,
  capabilityNames: Set<string>,
): Promise<IdentityLinkingCapability | null> {
  if (!capabilityNames.has(UCP_CAPABILITIES.IDENTITY_LINKING)) return null;

  try {
    const gatewayUrl = config.gatewayUrl.replace(/\/+$/, '');
    const metadataUrl = `${gatewayUrl}/.well-known/oauth-authorization-server`;
    const res = await fetch(metadataUrl);
    if (!res.ok) return null;
    const metadata = (await res.json()) as OAuthServerMetadata;
    return new IdentityLinkingCapability(metadata);
  } catch {
    return null;
  }
}

function buildToolDescriptors(
  checkout: CheckoutCapability | null,
  order: OrderCapability | null,
  identityLinking: IdentityLinkingCapability | null,
): readonly ToolDescriptor[] {
  const tools: ToolDescriptor[] = [
    { name: 'search_products', capability: 'products', description: 'Search product catalog' },
    { name: 'get_product', capability: 'products', description: 'Get product by ID' },
  ];

  if (checkout) {
    tools.push(
      { name: 'create_checkout', capability: 'checkout', description: 'Create a checkout session' },
      { name: 'get_checkout', capability: 'checkout', description: 'Get checkout session by ID' },
      { name: 'update_checkout', capability: 'checkout', description: 'Update a checkout session' },
      {
        name: 'complete_checkout',
        capability: 'checkout',
        description: 'Complete checkout with payment',
      },
      { name: 'cancel_checkout', capability: 'checkout', description: 'Cancel a checkout session' },
    );

    if (checkout.extensions.fulfillment) {
      tools.push(
        {
          name: 'set_fulfillment',
          capability: 'checkout.fulfillment',
          description: 'Set fulfillment method (shipping/pickup)',
        },
        {
          name: 'select_destination',
          capability: 'checkout.fulfillment',
          description: 'Select shipping destination',
        },
        {
          name: 'select_fulfillment_option',
          capability: 'checkout.fulfillment',
          description: 'Select fulfillment option (e.g., express shipping)',
        },
      );
    }

    if (checkout.extensions.discount) {
      tools.push({
        name: 'apply_discount_codes',
        capability: 'checkout.discount',
        description: 'Apply discount codes to checkout',
      });
    }
  }

  if (order) {
    tools.push({
      name: 'get_order',
      capability: 'order',
      description: 'Get order by ID',
    });
  }

  if (identityLinking) {
    tools.push(
      {
        name: 'get_authorization_url',
        capability: 'identity_linking',
        description: 'Get OAuth authorization URL for account linking',
      },
      {
        name: 'exchange_auth_code',
        capability: 'identity_linking',
        description: 'Exchange authorization code for access token',
      },
      {
        name: 'refresh_access_token',
        capability: 'identity_linking',
        description: 'Refresh an expired access token',
      },
      {
        name: 'revoke_token',
        capability: 'identity_linking',
        description: 'Revoke an access or refresh token',
      },
    );
  }

  return tools;
}
