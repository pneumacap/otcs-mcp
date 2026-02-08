import { describe, it, expect } from 'vitest';
import { computeCost } from './cost';

describe('computeCost', () => {
  it('computes cost with no caching', () => {
    const cost = computeCost(1000, 500, 0, 0);
    // 1000 * 3/1M + 500 * 15/1M = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it('computes cost with cache reads', () => {
    const cost = computeCost(1000, 500, 800, 0);
    // nonCached = max(0, 1000 - 800 - 0) = 200
    // 200 * 3/1M + 500 * 15/1M + 800 * 0.3/1M = 0.0006 + 0.0075 + 0.00024 = 0.00834
    expect(cost).toBeCloseTo(0.00834, 6);
  });

  it('computes cost with cache writes', () => {
    const cost = computeCost(1000, 500, 0, 600);
    // nonCached = max(0, 1000 - 0 - 600) = 400
    // 400 * 3/1M + 500 * 15/1M + 600 * 3.75/1M = 0.0012 + 0.0075 + 0.00225 = 0.01095
    expect(cost).toBeCloseTo(0.01095, 6);
  });

  it('returns zero for zero tokens', () => {
    expect(computeCost(0, 0, 0, 0)).toBe(0);
  });

  it('handles case where cache exceeds input', () => {
    const cost = computeCost(100, 200, 500, 0);
    // nonCached = max(0, 100 - 500 - 0) = 0
    // 0 + 200 * 15/1M + 500 * 0.3/1M = 0.003 + 0.00015 = 0.00315
    expect(cost).toBeCloseTo(0.00315, 6);
  });
});
