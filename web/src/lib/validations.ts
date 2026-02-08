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
