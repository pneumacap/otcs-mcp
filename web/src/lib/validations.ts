import { z } from 'zod';

// ── Chat Message Validation ──
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message cannot be empty').max(32000, 'Message too long'),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message required')
    .max(100, 'Too many messages'),
});

// ── Registration Validation ──
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

// ── Sign-in Validation ──
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── OTCS Connection Validation ──
export const otcsConnectionSchema = z.object({
  baseUrl: z.string().url('Invalid URL').max(500),
  username: z.string().min(1, 'Username is required').max(255),
  password: z.string().min(1, 'Password is required').max(255),
  domain: z.string().max(255).optional(),
  tlsSkipVerify: z.boolean().optional().default(false),
});

// ── Agent Validation ──
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().max(2000, 'Description too long').default(''),
  enabled: z.boolean().default(true),
  match: z.record(z.string(), z.unknown()).default({}),
  instructions: z.string().max(10000).default(''),
  extractFields: z.record(z.string(), z.string()).default({}),
  actions: z.array(z.record(z.string(), z.unknown())).default([]),
  watchFolders: z.array(z.number()).default([]),
  tools: z.array(z.string()).default([]),
  systemPrompt: z.string().max(5000).default(''),
  model: z.string().max(100).default('claude-sonnet-4-5-20250929'),
  maxRounds: z.number().int().min(1).max(50).default(15),
  pollIntervalMs: z.number().int().min(5000).max(600000).default(30000),
});

export const updateAgentSchema = createAgentSchema.partial();

export const generateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
});

// ── Stripe Checkout Validation ──
export const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
});

// ── Utility: parse and return typed errors ──
export function parseOrError<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => i.message).join('; ');
  return { success: false, error: messages };
}
