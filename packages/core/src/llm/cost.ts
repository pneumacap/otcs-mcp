/**
 * Shared LLM cost computation — single source of truth.
 * Anthropic Claude pricing (Sonnet 3.5/4).
 */

export function computeCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
  const nonCachedInput = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
  return (
    nonCachedInput * (3 / 1_000_000) +
    outputTokens * (15 / 1_000_000) +
    cacheReadTokens * (0.3 / 1_000_000) +
    cacheWriteTokens * (3.75 / 1_000_000)
  );
}
