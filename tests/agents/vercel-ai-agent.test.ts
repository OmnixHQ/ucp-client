/**
 * Vercel AI adapter — full agent shopping flow.
 *
 * Simulates what the Vercel AI SDK does: looks up tools by name, calls
 * execute(), and parses the JSON string responses.
 *
 * Run:
 *   npm run mock-server          # terminal 1
 *   INTEGRATION=true GATEWAY_URL=http://localhost:3002 \
 *     npx vitest run tests/agents/vercel-ai-agent.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { AgentTool } from '../../src/agent-tools.js';
import { UCPClient } from '../../src/UCPClient.js';
import { UCPError } from '../../src/errors.js';
import { toVercelAITools, type VercelAIToolMap } from '../../src/adapters/vercel-ai.js';

const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:3002';
const AGENT_PROFILE = 'https://agent.test/profile';

const errorTool: AgentTool = {
  name: 'failing_tool',
  description: 'Always fails',
  parameters: { type: 'object' },
  execute: () => Promise.reject(new UCPError('OUT_OF_STOCK', 'No stock')),
};

describe.skipIf(process.env['INTEGRATION'] !== 'true')(
  'Vercel AI adapter — agent shopping flow',
  () => {
    let agentTools: readonly AgentTool[];
    let tools: VercelAIToolMap;
    let toolsWithError: VercelAIToolMap;

    beforeAll(async () => {
      const client = await UCPClient.connect({
        gatewayUrl: GATEWAY_URL,
        agentProfileUrl: AGENT_PROFILE,
      });
      agentTools = client.getAgentTools();
      tools = toVercelAITools(agentTools, { catchErrors: true });
      toolsWithError = toVercelAITools([...agentTools, errorTool], { catchErrors: true });
    });

    it('tool map has correct Vercel AI shape', () => {
      expect(Object.keys(tools).length).toBeGreaterThan(0);
      for (const tool of Object.values(tools)) {
        expect(typeof tool.description).toBe('string');
        expect(tool.parameters).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('completes full shopping flow: search → checkout → update → cancel', async () => {
      // Step 1: search products — execute returns JSON string
      const products = JSON.parse(await tools['search_products']!.execute({ query: 'roses' })) as Array<{
        id: string;
      }>;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);

      // Step 2: create checkout
      const session = JSON.parse(
        await tools['create_checkout']!.execute({
          line_items: [{ item: { id: products[0]!.id }, quantity: 1 }],
        }),
      ) as { id: string; status: string };
      expect(typeof session.id).toBe('string');
      expect(session.status).toBe('incomplete');

      // Step 3: update with buyer info
      const updated = JSON.parse(
        await tools['update_checkout']!.execute({
          id: session.id,
          buyer: { first_name: 'Test', last_name: 'Agent', email: 'agent@test.com' },
        }),
      ) as { id: string };
      expect(updated.id).toBe(session.id);

      // Step 4: cancel checkout
      const cancelled = JSON.parse(
        await tools['cancel_checkout']!.execute({ id: session.id }),
      ) as { status: string };
      expect(cancelled.status).toBe('canceled');
    });

    it('returns JSON { error } for a failing tool instead of throwing', async () => {
      const result = JSON.parse(await toolsWithError['failing_tool']!.execute({}));
      expect(result).toEqual({ error: 'OUT_OF_STOCK: No stock' });
    });

    it('throws when catchErrors is false', async () => {
      const throwingTools = toVercelAITools([...agentTools, errorTool]);
      await expect(throwingTools['failing_tool']!.execute({})).rejects.toBeInstanceOf(UCPError);
    });
  },
);
