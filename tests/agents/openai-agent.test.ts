/**
 * OpenAI adapter — full agent shopping flow.
 *
 * Simulates what an LLM agent does: calls tools in sequence through the
 * OpenAI adapter and verifies the results at each step.
 *
 * Run:
 *   npm run mock-server          # terminal 1
 *   INTEGRATION=true GATEWAY_URL=http://localhost:3002 \
 *     npx vitest run tests/agents/openai-agent.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { AgentTool } from '../../src/agent-tools.js';
import { UCPClient } from '../../src/UCPClient.js';
import { UCPError } from '../../src/errors.js';
import { toOpenAITools, executeOpenAIToolCall } from '../../src/adapters/openai.js';

const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:3002';
const AGENT_PROFILE = 'https://agent.test/profile';

const errorTool: AgentTool = {
  name: 'failing_tool',
  description: 'Always fails',
  parameters: { type: 'object' },
  execute: () => Promise.reject(new UCPError('OUT_OF_STOCK', 'No stock')),
};

describe.skipIf(process.env['INTEGRATION'] !== 'true')(
  'OpenAI adapter — agent shopping flow',
  () => {
    let agentTools: readonly AgentTool[];

    beforeAll(async () => {
      const client = await UCPClient.connect({
        gatewayUrl: GATEWAY_URL,
        agentProfileUrl: AGENT_PROFILE,
      });
      agentTools = client.getAgentTools();
    });

    it('tool definitions have correct OpenAI shape', () => {
      const tools = toOpenAITools(agentTools, { catchErrors: true });
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.type).toBe('function');
        expect(typeof tool.function.name).toBe('string');
        expect(typeof tool.function.description).toBe('string');
        expect(tool.function.parameters).toBeDefined();
      }
    });

    it('completes full shopping flow: search → checkout → update → cancel', async () => {
      // Step 1: search products
      const products = (await executeOpenAIToolCall(agentTools, 'search_products', { query: 'roses' }, {
        catchErrors: true,
      })) as Array<{ id: string }>;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);

      // Step 2: create checkout
      const session = (await executeOpenAIToolCall(
        agentTools,
        'create_checkout',
        { line_items: [{ item: { id: products[0]!.id }, quantity: 1 }] },
        { catchErrors: true },
      )) as { id: string; status: string };
      expect(typeof session.id).toBe('string');
      expect(session.status).toBe('incomplete');

      // Step 3: update with buyer info
      const updated = (await executeOpenAIToolCall(
        agentTools,
        'update_checkout',
        {
          id: session.id,
          buyer: { first_name: 'Test', last_name: 'Agent', email: 'agent@test.com' },
        },
        { catchErrors: true },
      )) as { id: string };
      expect(updated.id).toBe(session.id);

      // Step 4: cancel checkout
      const cancelled = (await executeOpenAIToolCall(
        agentTools,
        'cancel_checkout',
        { id: session.id },
        { catchErrors: true },
      )) as { status: string };
      expect(cancelled.status).toBe('canceled');
    });

    it('returns { error } for a failing tool instead of throwing', async () => {
      const result = await executeOpenAIToolCall(
        [...agentTools, errorTool],
        'failing_tool',
        {},
        { catchErrors: true },
      );
      expect(result).toEqual({ error: 'OUT_OF_STOCK: No stock' });
    });

    it('throws when catchErrors is false', async () => {
      await expect(
        executeOpenAIToolCall([...agentTools, errorTool], 'failing_tool', {}),
      ).rejects.toBeInstanceOf(UCPError);
    });
  },
);
