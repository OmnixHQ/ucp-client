import type {
  OAuthServerMetadata,
  AuthorizationParams,
  TokenResponse,
  TokenExchangeParams,
  TokenRefreshParams,
  TokenRevokeParams,
} from '../types/identity-linking.js';

export class IdentityLinkingCapability {
  constructor(private readonly metadata: OAuthServerMetadata) {}

  getAuthorizationUrl(params: AuthorizationParams): string {
    const url = new URL(this.metadata.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.client_id);
    url.searchParams.set('redirect_uri', params.redirect_uri);
    url.searchParams.set('scope', params.scope ?? 'ucp:scopes:checkout_session');
    if (params.state !== undefined) {
      url.searchParams.set('state', params.state);
    }
    return url.toString();
  }

  async exchangeCode(params: TokenExchangeParams): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirect_uri,
    });

    return this.tokenRequest(params.client_id, params.client_secret, body);
  }

  async refreshToken(params: TokenRefreshParams): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refresh_token,
    });

    return this.tokenRequest(params.client_id, params.client_secret, body);
  }

  async revokeToken(params: TokenRevokeParams): Promise<void> {
    const body = new URLSearchParams({ token: params.token });
    if (params.token_type_hint !== undefined) {
      body.set('token_type_hint', params.token_type_hint);
    }

    const basicAuth = btoa(`${params.client_id}:${params.client_secret}`);

    const res = await fetch(this.metadata.revocation_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Token revocation failed: ${res.status}`);
    }
  }

  getMetadata(): OAuthServerMetadata {
    return this.metadata;
  }

  private async tokenRequest(
    clientId: string,
    clientSecret: string,
    body: URLSearchParams,
  ): Promise<TokenResponse> {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const res = await fetch(this.metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`Token exchange failed: ${res.status} ${errorBody}`);
    }

    return (await res.json()) as TokenResponse;
  }
}
