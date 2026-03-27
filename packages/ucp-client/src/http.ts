import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import { UCPError, UCPEscalationError, UCPIdempotencyConflictError } from './errors.js';
import type { UCPMessage } from './errors.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpClientConfig {
  readonly gatewayUrl: string;
  readonly agentProfileUrl: string;
  readonly ucpVersion: string;
  readonly requestSignature?: string;
  readonly accessToken?: string;
}

export class HttpClient {
  private readonly gatewayUrl: string;
  private readonly agentProfileUrl: string;
  private readonly ucpVersion: string;
  private readonly requestSignature: string | undefined;
  private readonly accessToken: string | undefined;

  constructor(config: HttpClientConfig) {
    this.gatewayUrl = config.gatewayUrl;
    this.agentProfileUrl = config.agentProfileUrl;
    this.ucpVersion = config.ucpVersion;
    this.requestSignature = config.requestSignature;
    this.accessToken = config.accessToken;
  }

  withAccessToken(token: string): HttpClient {
    const config: HttpClientConfig = {
      gatewayUrl: this.gatewayUrl,
      agentProfileUrl: this.agentProfileUrl,
      ucpVersion: this.ucpVersion,
      accessToken: token,
    };
    if (this.requestSignature !== undefined) {
      (config as { requestSignature: string }).requestSignature = this.requestSignature;
    }
    return new HttpClient(config);
  }

  async request(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
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

    if (this.accessToken !== undefined) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
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

  validate(data: unknown, schema: ZodType): unknown {
    const result = schema.safeParse(data);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.warn('[UCPClient] Response validation failed:', result.error.message);
      return data;
    }
    return result.data;
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
      const allMessages = this.parseMessages(rawMessages);
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

  private parseMessages(rawMessages: unknown[]): UCPMessage[] {
    return rawMessages.map((m: unknown) => {
      const record = m as Record<string, unknown>;
      const rawType = String(record['type'] ?? 'error');
      const messageType = (['error', 'warning', 'info'].includes(rawType) ? rawType : 'error') as
        | 'error'
        | 'warning'
        | 'info';

      const msg: UCPMessage = {
        type: messageType,
        content: String(record['content'] ?? 'Unknown error'),
      };

      if (record['code'] !== undefined) (msg as { code: string }).code = String(record['code']);
      if (record['severity'] !== undefined)
        (msg as { severity: string }).severity = String(record['severity']);
      if (record['path'] !== undefined) (msg as { path: string }).path = String(record['path']);
      if (record['content_type'] !== undefined)
        (msg as { content_type: string }).content_type = String(record['content_type']);

      return msg;
    });
  }
}

export function validateCheckoutSession(http: HttpClient, data: unknown, schema: ZodType): unknown {
  const session = http.validate(data, schema) as Record<string, unknown>;

  if (session['status'] === 'requires_escalation' && session['continue_url']) {
    throw new UCPEscalationError(String(session['continue_url']));
  }

  return session;
}
