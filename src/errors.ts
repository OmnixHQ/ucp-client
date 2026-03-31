export type MessageType = 'error' | 'warning' | 'info';
export type MessageSeverity =
  | 'recoverable'
  | 'requires_buyer_input'
  | 'requires_buyer_review'
  | 'unrecoverable';
export type ContentType = 'plain' | 'markdown';

/** A single message from the gateway's `messages[]` array. */
export interface UCPMessage {
  readonly type: MessageType;
  readonly code?: string;
  readonly content: string;
  readonly severity?: MessageSeverity;
  /** JSONPath to the field that caused the error (e.g., `$.buyer.email`). */
  readonly path?: string;
  readonly content_type?: ContentType;
}

/** Thrown when the gateway returns an error response with `messages[]`. */
export class UCPError extends Error {
  readonly code: string;
  readonly type: MessageType;
  readonly statusCode: number;
  /** JSONPath to the field that caused the error, from the first message. */
  readonly path: string | undefined;
  readonly contentType: ContentType | undefined;
  /** All messages from the gateway response. */
  readonly messages: readonly UCPMessage[];

  constructor(
    code: string,
    message: string,
    type: MessageType = 'error',
    statusCode = 400,
    options: {
      readonly path?: string;
      readonly contentType?: ContentType;
      readonly messages?: readonly UCPMessage[];
    } = {},
  ) {
    super(message);
    this.name = 'UCPError';
    this.code = code;
    this.type = type;
    this.statusCode = statusCode;
    this.path = options.path;
    this.contentType = options.contentType;
    this.messages = options.messages ?? [];
  }
}

/** Thrown on HTTP 409 when no `messages[]` body is present (idempotency key collision). */
export class UCPIdempotencyConflictError extends UCPError {
  constructor(message = 'Idempotency key reused with different request body') {
    super('IDEMPOTENCY_CONFLICT', message, 'error', 409);
    this.name = 'UCPIdempotencyConflictError';
  }
}

/** Thrown when a checkout response has `status: 'requires_escalation'` with a `continue_url`. */
export class UCPEscalationError extends Error {
  /** The URL to redirect the buyer to for merchant-hosted checkout UI. */
  readonly continue_url: string;

  constructor(continue_url: string, message = 'Payment requires escalation') {
    super(message);
    this.name = 'UCPEscalationError';
    this.continue_url = continue_url;
  }
}

/** Thrown when an OAuth token exchange, refresh, or revocation fails. */
export class UCPOAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UCPOAuthError';
    this.statusCode = statusCode;
  }
}
