/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request counts per identifier within a rolling time window.
 * Stale entries are automatically purged every 60 seconds.
 */

interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup stale entries every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries where all timestamps have expired
      // Use a generous 5-minute max window to decide staleness
      const newest = entry.timestamps[entry.timestamps.length - 1];
      if (!newest || now - newest > 5 * 60_000) {
        store.delete(key);
      }
    }
    // If store is empty, stop the timer to avoid leaks
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, 60_000);
  // Allow Node.js to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check and consume one request from the rate limit budget.
 *
 * @param identifier - Unique key for the requester (e.g. `chat:userId` or `auth:ip`)
 * @param limit      - Maximum number of requests allowed within the window
 * @param windowMs   - Size of the sliding window in milliseconds
 * @returns Whether the request is allowed, remaining budget, and when the window resets
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetAt: number } {
  ensureCleanup();

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Slide the window: remove timestamps older than windowStart
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const resetAt = entry.timestamps.length > 0
    ? entry.timestamps[0] + windowMs
    : now + windowMs;

  if (entry.timestamps.length >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt,
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    success: true,
    remaining: limit - entry.timestamps.length,
    resetAt,
  };
}
