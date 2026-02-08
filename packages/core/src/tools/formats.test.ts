import { describe, it, expect } from 'vitest';
import { toMCPTools, toAnthropicTools } from './formats';

const sampleSchemas = [
  {
    name: 'test_tool',
    description: 'A test tool',
    schema: {
      properties: { id: { type: 'number', description: 'Node ID' } },
      required: ['id'],
    },
  },
  {
    name: 'test_tool_2',
    description: 'Another test tool',
    schema: {
      properties: { query: { type: 'string' } },
    },
  },
];

describe('toMCPTools', () => {
  it('converts schemas to MCP format', () => {
    const tools = toMCPTools(sampleSchemas as any);
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('test_tool');
    expect(tools[0].inputSchema.type).toBe('object');
    expect(tools[0].inputSchema.required).toEqual(['id']);
  });

  it('omits required when not present', () => {
    const tools = toMCPTools(sampleSchemas as any);
    expect(tools[1].inputSchema.required).toBeUndefined();
  });
});

describe('toAnthropicTools', () => {
  it('converts schemas to Anthropic format', () => {
    const tools = toAnthropicTools(sampleSchemas as any);
    expect(tools).toHaveLength(2);
    expect(tools[0].input_schema.type).toBe('object');
  });

  it('adds cache_control to last tool', () => {
    const tools = toAnthropicTools(sampleSchemas as any);
    expect(tools[0].cache_control).toBeUndefined();
    expect(tools[1].cache_control).toEqual({ type: 'ephemeral' });
  });
});
