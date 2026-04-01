import type {
  TokenCredential as SdkTokenCredential,
  CardCredential as SdkCardCredential,
} from '@omnixhq/ucp-js-sdk';

export type TokenCredential = SdkTokenCredential;
export type CardCredential = SdkCardCredential;

export type PaymentCredential = TokenCredential | CardCredential;

import type { z } from 'zod';
import type { PaymentHandlerBaseSchema } from '../schemas.js';
import type { PostalAddress } from './common.js';

export interface PaymentInstrument {
  readonly id: string;
  readonly handler_id: string;
  readonly type: string;
  readonly brand?: string;
  readonly last_digits?: string;
  readonly handler_name?: string;
  readonly selected?: boolean;
  readonly display?: Readonly<Record<string, unknown>>;
  readonly credential?: PaymentCredential;
  readonly billing_address?: PostalAddress;
}

export type PaymentHandlerInstance = z.output<typeof PaymentHandlerBaseSchema>;

export interface PaymentHandlerMap {
  readonly [namespace: string]: readonly PaymentHandlerInstance[];
}
