export class UCPError extends Error {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    statusCode = 400,
  ) {
    super(message);
    this.name = 'UCPError';
    this.code = code;
    this.severity = severity;
    this.statusCode = statusCode;
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
