import type { AgentTool, JsonSchema } from '../agent-tools.js';
import { type AdapterOptions, safeExecute } from './catch-errors.js';

export type { AgentTool, JsonSchema };

// Minimal Standard Schema v1 interface (https://standardschema.dev) — no external deps.
// Vercel AI SDK detects { '~standard' } to recognise a schema, and reads { jsonSchema }
// to extract the raw JSON schema it sends to the LLM.
interface StandardSchemaV1 {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => { readonly value: unknown };
  };
}

export interface VercelAISchema extends StandardSchemaV1 {
  readonly jsonSchema: JsonSchema;
}

export interface VercelAIToolDefinition {
  readonly description: string;
  readonly inputSchema: VercelAISchema;
  readonly execute: (args: Record<string, unknown>) => Promise<string>;
}

export type VercelAIToolMap = Record<string, VercelAIToolDefinition>;

function wrapSchema(schema: JsonSchema): VercelAISchema {
  return {
    '~standard': {
      version: 1,
      vendor: 'ucp-client',
      // pass-through — AI SDK validates via its own tool call parsing
      validate: (value) => ({ value }),
    },
    jsonSchema: schema,
  };
}

export function toVercelAITools(
  agentTools: readonly AgentTool[],
  options?: AdapterOptions,
): VercelAIToolMap {
  return Object.fromEntries(
    agentTools.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: wrapSchema(tool.parameters),
        execute: async (args: Record<string, unknown>): Promise<string> => {
          const result = await safeExecute(() => tool.execute(args), options?.catchErrors ?? false);
          return JSON.stringify(result);
        },
      },
    ]),
  );
}
