/**
 * Webhook signature verification — verify incoming order event webhooks.
 *
 * UCP businesses sign webhook POST requests with a detached JWS in the
 * `Request-Signature` header (RFC 7797). The signing keys are published in
 * the UCP discovery profile under `signing_keys`.
 *
 * Usage:
 *   npx tsx examples/webhook-verification.ts
 *
 * Requires a running UCP-compliant server at GATEWAY_URL.
 */

import { createServer } from 'node:http';
import { UCPClient, verifyRequestSignature } from '../src/index.js';
import type { JWK } from '../src/index.js';

const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:3000';
const AGENT_PROFILE = process.env['AGENT_PROFILE'] ?? 'https://agent.example.com/.well-known/ucp';
const WEBHOOK_PORT = Number(process.env['WEBHOOK_PORT'] ?? '4000');

async function main() {
  // 1. Connect once at startup — signing keys come from the discovery profile
  const client = await UCPClient.connect({
    gatewayUrl: GATEWAY_URL,
    agentProfileUrl: AGENT_PROFILE,
  });

  const signingKeys: readonly JWK[] = client.signingKeys;
  console.log(`Loaded ${signingKeys.length} signing key(s) from discovery profile`);
  for (const key of signingKeys) {
    console.log(
      `  kid=${key.kid ?? '(none)'} alg=${key.alg ?? '(none)'} crv=${key.crv ?? '(none)'}`,
    );
  }

  // 2. HTTP server that accepts incoming webhook POSTs and verifies each one
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const signatureHeader = req.headers['request-signature'];

      void (async () => {
        if (typeof signatureHeader !== 'string') {
          console.warn('Rejected: missing Request-Signature header');
          res.writeHead(401).end('Missing Request-Signature');
          return;
        }

        const valid = await verifyRequestSignature(rawBody, signatureHeader, signingKeys);

        if (!valid) {
          console.warn('Rejected: invalid signature');
          res.writeHead(401).end('Invalid signature');
          return;
        }

        // Signature verified — safe to process the event
        const event = JSON.parse(rawBody) as Record<string, unknown>;
        console.log('Verified webhook event:', JSON.stringify(event, null, 2));

        res.writeHead(200).end('OK');
      })();
    });
  });

  server.listen(WEBHOOK_PORT, () => {
    console.log(`\nWebhook receiver listening on http://localhost:${WEBHOOK_PORT}`);
    console.log('POST a signed order event to this endpoint.\n');
  });
}

main().catch(console.error);
