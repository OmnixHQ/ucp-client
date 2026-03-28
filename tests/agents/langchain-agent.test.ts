/**
 * LangChain adapter — full agent shopping flow.
 *
 * Simulates what a LangChain agent does: looks up tools by name, calls
 * tool.call(), and parses the JSON string responses.
 *
 * Run:
 *   npm run mock-server          # terminal 1
 *   INTEGRATION=true GATEWAY_URL=http://localhost:3002 \
 *     npx vitest run tests/agents/langchain-agent.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { AgentTool } from '../../src/agent-tools.js';
import { UCPClient } from '../../src/UCPClient.js';
import { UCPError } from '../../src/errors.js';
import { toLangChainTools, type LangChainTool } from '../../src/adapters/langchain.js';

const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:3002';
const AGENT_PROFILE = 'https://agent.test/profile';

const errorTool: AgentTool = {
  name: 'failing_tool',
  description: 'Always fails',
  parameters: { type: 'object' },
  execute: () => Promise.reject(new UCPError('OUT_OF_STOCK', 'No stock')),
};

function findTool(tools: readonly LangChainTool[], name: string): LangChainTool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

describe.skipIf(process.env['INTEGRATION'] !== 'true')(
  'LangChain adapter — agent shopping flow',
  () => {
    let agentTools: readonly AgentTool[];
    let tools: readonly LangChainTool[];
    let toolsWithError: readonly LangChainTool[];

    beforeAll(async () => {
      const client = await UCPClient.connect({
        gatewayUrl: GATEWAY_URL,
        agentProfileUrl: AGENT_PROFILE,
      });
      agentTools = client.getAgentTools();
      tools = toLangChainTools(agentTools, { catchErrors: true });
      toolsWithError = toLangChainTools([...agentTools, errorTool], { catchErrors: true });
    });

    it('tool array has correct LangChain shape', () => {
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.schema).toBeDefined();
        expect(typeof tool.call).toBe('function');
      }
    });

    it('completes full shopping flow: search → checkout → update → cancel', async () => {
      // Step 1: search products — call returns JSON string
      const products = JSON.parse(
        await findTool(tools, 'search_products').call({ query: 'roses' }),
      ) as Array<{ id: string }>;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);

      // Step 2: create checkout
      const session = JSON.parse(
        await findTool(tools, 'create_checkout').call({
          line_items: [{ item: { id: products[0]!.id }, quantity: 1 }],
        }),
      ) as { id: string; status: string };
      expect(typeof session.id).toBe('string');
      expect(session.status).toBe('incomplete');

      // Step 3: update with buyer info
      const updated = JSON.parse(
        await findTool(tools, 'update_checkout').call({
          id: session.id,
          buyer: { first_name: 'Test', last_name: 'Agent', email: 'agent@test.com' },
        }),
      ) as { id: string };
      expect(updated.id).toBe(session.id);

      // Step 4: cancel checkout
      const cancelled = JSON.parse(
        await findTool(tools, 'cancel_checkout').call({ id: session.id }),
      ) as { status: string };
      expect(cancelled.status).toBe('canceled');
    });

    it('returns JSON { error } for a failing tool instead of throwing', async () => {
      const result = JSON.parse(await findTool(toolsWithError, 'failing_tool').call({}));
      expect(result).toEqual({ error: 'OUT_OF_STOCK: No stock' });
    });

    it('throws when catchErrors is false', async () => {
      const throwingTools = toLangChainTools([...agentTools, errorTool]);
      await expect(findTool(throwingTools, 'failing_tool').call({})).rejects.toBeInstanceOf(UCPError);
    });
  },
);
