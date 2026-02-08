/**
 * Environment variable validation for the Altius web app.
 *
 * Checks required and optional vars at startup, logs warnings for missing
 * optional vars, and exports typed constants for use throughout the app.
 */

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'ANTHROPIC_API_KEY',
  'ENCRYPTION_KEY',
] as const;

const OPTIONAL_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

/**
 * Validate that all required environment variables are present
 * and warn about missing optional ones.
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  for (const key of OPTIONAL_VARS) {
    if (!process.env[key]) {
      warnings.push(`Missing optional environment variable: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Typed env constants ──

export const env = {
  // Required
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',

  // Optional
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
} as const;

// ── Run validation at module load ──

const result = validateEnv();

if (result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn(`[env] ${warning}`);
  }
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[env] ${error}`);
  }
  console.error(
    '[env] App started with missing required environment variables. Some features will not work.',
  );
}
