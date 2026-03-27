export interface UCPMessage {
  readonly type: 'error' | 'warning' | 'info';
  readonly code?: string;
  readonly content: string;
  readonly severity?: 'recoverable' | 'requires_buyer_input' | 'requires_buyer_review';
  readonly path?: string;
  readonly content_type?: 'plain' | 'markdown';
}

export class UCPError extends Error {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly statusCode: number;
  readonly type: 'error' | 'warning' | 'info';
  readonly path: string | undefined;
  readonly contentType: 'plain' | 'markdown' | undefined;
  readonly messages: readonly UCPMessage[];

  constructor(
    code: string,
    message: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    statusCode = 400,
    options: {
      readonly type?: 'error' | 'warning' | 'info';
      readonly path?: string;
      readonly contentType?: 'plain' | 'markdown';
      readonly messages?: readonly UCPMessage[];
    } = {},
  ) {
    super(message);
    this.name = 'UCPError';
    this.code = code;
    this.severity = severity;
    this.statusCode = statusCode;
    this.type = options.type ?? 'error';
    this.path = options.path;
    this.contentType = options.contentType;
    this.messages = options.messages ?? [];
  }
}

export class UCPIdempotencyConflictError extends UCPError {
  constructor(message = 'Idempotency key reused with different request body') {
    super('IDEMPOTENCY_CONFLICT', message, 'error', 409);
    this.name = 'UCPIdempotencyConflictError';
  }
}

export class UCPEscalationError extends Error {
  readonly continue_url: string;

  constructor(continue_url: string, message = 'Payment requires escalation') {
    super(message);
    this.name = 'UCPEscalationError';
    this.continue_url = continue_url;
  }
}
