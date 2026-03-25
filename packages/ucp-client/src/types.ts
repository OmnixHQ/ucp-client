export interface UCPClientConfig {
  readonly gatewayUrl: string;
  readonly agentProfileUrl: string;
  readonly ucpVersion?: string;
}

export interface SearchFilters {
  readonly max_price_cents?: number;
  readonly min_price_cents?: number;
  readonly in_stock?: boolean;
  readonly category?: string;
  readonly limit?: number;
  readonly page?: number;
}

export interface CreateCheckoutPayload {
  readonly line_items: ReadonlyArray<{
    readonly item: { readonly id: string };
    readonly quantity: number;
  }>;
  readonly currency?: string;
  readonly buyer?: {
    readonly first_name?: string;
    readonly last_name?: string;
    readonly email?: string;
    readonly phone_number?: string;
  };
  readonly payment?: {
    readonly instruments?: readonly unknown[];
    readonly handlers?: readonly unknown[];
  };
}

export interface UpdateCheckoutPayload {
  readonly buyer?: {
    readonly first_name?: string;
    readonly last_name?: string;
    readonly email?: string;
    readonly phone_number?: string;
  };
  readonly fulfillment?: {
    readonly destinations?: ReadonlyArray<{
      readonly id: string;
      readonly address: {
        readonly street_address?: string;
        readonly address_locality?: string;
        readonly address_region?: string;
        readonly postal_code?: string;
        readonly address_country?: string;
      };
    }>;
    readonly methods?: ReadonlyArray<{
      readonly id: string;
      readonly type: string;
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
  readonly context?: {
    readonly address_country?: string;
    readonly address_region?: string;
    readonly postal_code?: string;
  };
}

export interface CompleteCheckoutPayload {
  readonly payment: {
    readonly instruments: ReadonlyArray<{
      readonly id: string;
      readonly handler_id: string;
      readonly type: string;
      readonly selected?: boolean;
      readonly credential?: {
        readonly type: string;
        readonly token?: string;
      };
      readonly billing_address?: unknown;
    }>;
  };
}

export type CheckoutSessionStatus =
  | 'incomplete'
  | 'ready_for_complete'
  | 'complete_in_progress'
  | 'completed'
  | 'canceled'
  | 'expired'
  | 'requires_escalation';

export interface CheckoutSession {
  readonly id: string;
  readonly status: CheckoutSessionStatus;
  readonly line_items: readonly unknown[];
  readonly currency: string;
  readonly totals: ReadonlyArray<{
    readonly type: string;
    readonly amount: number;
    readonly display_text?: string;
  }>;
  readonly buyer: unknown | null;
  readonly fulfillment: unknown | null;
  readonly discounts: unknown | null;
  readonly continue_url: string | null;
  readonly messages: ReadonlyArray<{
    readonly type: string;
    readonly code: string;
    readonly content: string;
    readonly severity?: 'error' | 'warning' | 'info';
  }>;
  readonly expires_at: string;
  readonly created_at: string;
  readonly order: { readonly id: string; readonly permalink_url?: string } | null;
}

export interface UCPProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly price_cents: number;
  readonly currency: string;
  readonly in_stock: boolean;
  readonly stock_quantity: number;
  readonly images: readonly string[];
  readonly variants: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly price_cents: number;
    readonly in_stock: boolean;
    readonly attributes: Readonly<Record<string, string>>;
  }>;
}

export interface UCPOrder {
  readonly id: string;
  readonly status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  readonly total_cents: number;
  readonly currency: string;
  readonly created_at_iso: string;
}

export interface UCPProfile {
  readonly ucp: {
    readonly version: string;
    readonly services: Readonly<Record<string, unknown>>;
    readonly capabilities: ReadonlyArray<{
      readonly name: string;
      readonly version: string;
    }>;
  };
  readonly payment?: {
    readonly handlers?: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly version: string;
      readonly [k: string]: unknown;
    }>;
  };
}
