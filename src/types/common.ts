import type { z } from 'zod';
import type {
  PostalAddressSchema,
  BuyerConsentConsentSchema,
  ContextSchema,
  UcpSigningKeySchema,
} from '../schemas.js';

export type PostalAddress = z.output<typeof PostalAddressSchema>;
export type BuyerConsent = z.output<typeof BuyerConsentConsentSchema>;
export type LocalizationContext = z.output<typeof ContextSchema>;

/** A UCP signing key as defined by the SDK spec. */
export type JWK = z.output<typeof UcpSigningKeySchema>;
