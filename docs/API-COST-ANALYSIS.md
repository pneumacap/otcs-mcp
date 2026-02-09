# Altius — Anthropic API Cost Analysis & Forecasting

> Token economics for every tier, model, and deployment scenario.
> Assumes Altius absorbs all API costs and passes through as part of subscription pricing.

---

## Executive Summary

Altius's dominant variable cost is the Anthropic API. This document models what it actually costs to serve each pricing tier, compares Sonnet vs Opus economics, applies enterprise volume discounts, and identifies a **critical margin risk at the 5,000-user enterprise scale** that requires model-routing optimization to remain viable.

**Key findings:**

| Tier | Monthly Msgs | API Cost (Retail) | API Cost (Enterprise -20%) | Subscription | Gross Margin |
|---|---|---|---|---|---|
| Starter | 1,000 | $40 | $32 | $499 | 92-94% |
| Professional | 5,000 + agent | $233 | $186 | $1,499 | 84-88% |
| Business | 15,000 + agents | $930 | $744 | $2,999 | 69-75% |
| Enterprise | 50,000 + agents | $4,640 | $3,248 | $8,999 | 48-64% |
| Enterprise (5K users) | 380,000 + agents | $31,700 | $22,190 | $8,999 | **-150%** |

The 5,000-user scenario is **unprofitable at flat-rate pricing** without model routing. With Haiku/Sonnet routing, the blended cost drops to ~$12,300/mo, making it viable at $25,000+/mo enterprise pricing.

---

## 1. Current Anthropic API Pricing (Retail)

Source: [Anthropic Official Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (February 2026)

### Per Million Tokens (MTok)

| Model | Input | Output | Cache Write (5m) | Cache Read | Batch Input | Batch Output |
|---|---|---|---|---|---|---|
| **Claude Opus 4.6** | $5.00 | $25.00 | $6.25 | $0.50 | $2.50 | $12.50 |
| **Claude Opus 4.5** | $5.00 | $25.00 | $6.25 | $0.50 | $2.50 | $12.50 |
| Claude Opus 4.1 | $15.00 | $75.00 | $18.75 | $1.50 | $7.50 | $37.50 |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | $3.75 | $0.30 | $1.50 | $7.50 |
| Claude Sonnet 4 | $3.00 | $15.00 | $3.75 | $0.30 | $1.50 | $7.50 |
| **Claude Haiku 4.5** | $1.00 | $5.00 | $1.25 | $0.10 | $0.50 | $2.50 |
| Claude Haiku 3.5 | $0.80 | $4.00 | $1.00 | $0.08 | $0.40 | $2.00 |

### Pricing Multipliers

- **Prompt caching** (5-min TTL): Write = 1.25x input; Read = 0.10x input (90% savings)
- **Prompt caching** (1-hr TTL): Write = 2.0x input; Read = 0.10x input
- **Batch API**: 50% discount on both input and output (async, not real-time)
- **Long context** (>200K input): 2x input, 1.5x output for Sonnet/Opus 4.5+
- **Data residency** (US-only): 1.1x all token categories
- **Tool use overhead**: +346 tokens per request (system prompt for tool use)

### Enterprise Volume Discounts (Estimated)

Anthropic does not publish enterprise rates. Based on industry intelligence:

| Annual Commitment | Estimated Discount | Notes |
|---|---|---|
| < $50K/year | 0% (retail) | Standard API pricing |
| $50-100K/year | 10-15% | Tier 3-4 rate limits, dedicated support |
| $100-250K/year | 15-20% | Named account manager |
| $250K-1M/year | 20-25% | Custom rate limits, priority access |
| $1M+/year | 25-30% | Custom terms, committed use discount |

> Source: [Enterprise pricing is negotiated per contract](https://www.nops.io/blog/anthropic-api-pricing/). These estimates are based on industry patterns for comparable AI API providers.

---

## 2. How Altius Consumes Tokens

### Fixed Overhead Per Request

Every API call includes:

| Component | Tokens | Notes |
|---|---|---|
| System prompt | ~2,054 | Navigation strategy, tool reference, chart support |
| Tool schemas (42 tools) | ~9,400 | JSON Schema definitions for all OTCS tools |
| Tool use system prompt | 346 | Anthropic's internal tool-use instructions |
| **Total fixed overhead** | **~11,800** | Cached after first request in session |

With ephemeral prompt caching enabled (5-min TTL):
- **First request**: 11,800 tokens as cache write ($0.04425 at Sonnet rates)
- **Subsequent requests** (within 5 min): 11,800 tokens as cache read ($0.00354 at Sonnet rates)
- **Savings**: 92% reduction on fixed overhead after first request

### Caching Implementation (Already Built)

Altius uses ephemeral caching on two components:
1. **System prompt** — `cache_control: { type: 'ephemeral' }` on the system message
2. **Last tool definition** — `cache_control: { type: 'ephemeral' }` on the final tool in the array

This means the ~11,800 token overhead is paid once per 5-minute window, then read at 10% cost for all subsequent calls in that window.

### Variable Tokens Per Message

Beyond the fixed overhead, each message adds:

| Component | Typical Range | Notes |
|---|---|---|
| User message | 50-500 tokens | The actual question |
| Conversation history | 500-15,000 tokens | Grows each turn |
| Tool call requests (output) | 100-800 per call | Model generates JSON for each tool |
| Tool results (input) | 200-2,000 per result | OTCS API responses, compacted |
| Final response (output) | 100-1,000 tokens | Text + optional chart |

### Tool Call Patterns

| Query Type | Tool Calls | API Rounds | Example |
|---|---|---|---|
| No tools | 0 | 1 | "What can you do?" |
| Simple | 1-2 | 2 | "Show me folder 12345" |
| Medium | 3-4 | 2-3 | "Find all contracts expiring in Q1" |
| Complex | 5-8 | 3-5 | "Compare invoices across 3 vendors and chart them" |
| Maximum | 10 | 5-6 | "Classify all documents in this folder and apply holds" |

Parallel execution: Up to 6 concurrent tool calls per round (reduces round count).

---

## 3. Cost Per Message Calculation

### Sonnet 4.5 — Per Message (Cache Warm)

**Simple 2-round message (1-2 tool calls):**

| Round | Cache Read | Non-Cached Input | Output | Cost |
|---|---|---|---|---|
| Round 1 | 11,800 | 550 | 400 | $0.01018 |
| Round 2 | 11,800 | 1,750 | 300 | $0.01279 |
| **Total** | 23,600 | 2,300 | 700 | **$0.024** |

**Medium 3-round message (3-4 tool calls):**

| Round | Cache Read | Non-Cached Input | Output | Cost |
|---|---|---|---|---|
| Round 1 | 11,800 | 550 | 600 | $0.01318 |
| Round 2 | 11,800 | 2,500 | 500 | $0.01854 |
| Round 3 | 11,800 | 4,000 | 400 | $0.02154 |
| **Total** | 35,400 | 7,050 | 1,500 | **$0.054** |

**Complex 5-round message (6-8 tool calls):**

| Total | Cache Read | Non-Cached Input | Output | Cost |
|---|---|---|---|---|
| 5 rounds | 59,000 | 18,000 | 3,000 | **$0.12** |

### Weighted Average Cost Per Message

Assuming typical usage distribution:

| Query Type | % of Messages | Cost/Msg | Weighted |
|---|---|---|---|
| No tools (conversational) | 15% | $0.008 | $0.0012 |
| Simple (1-2 tools) | 45% | $0.024 | $0.0108 |
| Medium (3-4 tools) | 25% | $0.054 | $0.0135 |
| Complex (5-8 tools) | 12% | $0.090 | $0.0108 |
| Maximum (10 tools) | 3% | $0.150 | $0.0045 |
| **Weighted average** | | | **$0.041** |

Add conversation history growth (average 3-4 turns per session): **+$0.007/msg**

### Effective Cost Per Message

| Model | Retail | Enterprise -20% | Enterprise -30% | Batch API |
|---|---|---|---|---|
| **Sonnet 4.5** | **$0.048** | **$0.038** | **$0.034** | $0.024 |
| **Opus 4.6** | **$0.080** | **$0.064** | **$0.056** | $0.040 |
| **Haiku 4.5** | **$0.016** | **$0.013** | **$0.011** | $0.008 |

> These are blended averages including caching. Actual cost varies with query complexity and conversation length.

---

## 4. Agent Processing Costs

The autonomous agent uses a filtered 13-tool set (~3,100 token schemas vs 9,400 for full set), reducing overhead by 67%.

### Per-Document Agent Cost

| Component | Tokens | Notes |
|---|---|---|
| Cached overhead (system + 13 tools) | ~5,500 | Cache read after first doc |
| Rule context + document metadata | ~300-500 | Varies by rule complexity |
| Tool results (3 rounds avg) | ~2,500 | Search, classify, action |
| Output (3 rounds) | ~1,200 | Extraction + actions |

| Model | Per Document (Retail) | Per Document (Ent -20%) | Per Document (Batch) |
|---|---|---|---|
| **Sonnet 4.5** | **$0.035** | **$0.028** | **$0.018** |
| **Opus 4.6** | **$0.058** | **$0.047** | **$0.029** |
| **Haiku 4.5** | **$0.012** | **$0.009** | **$0.006** |

### Monthly Agent Costs by Volume

| Docs/Day | Docs/Month (22 days) | Sonnet Retail | Sonnet Ent -20% | Haiku Retail |
|---|---|---|---|---|
| 50 | 1,100 | $39 | $31 | $13 |
| 100 | 2,200 | $77 | $62 | $26 |
| 200 | 4,400 | $154 | $123 | $53 |
| 500 | 11,000 | $385 | $308 | $132 |
| 1,000 | 22,000 | $770 | $616 | $264 |
| 5,000 | 110,000 | $3,850 | $3,080 | $1,320 |

> Agent processing is a strong candidate for Haiku — classification and routing tasks don't require Sonnet-level reasoning for most document types.

---

## 5. Cost Per Pricing Tier

### Starter — $499/mo (1,000 messages, no agents)

| Scenario | Model | API Cost | Margin | Gross % |
|---|---|---|---|---|
| Retail | Sonnet 4.5 | $48 | $451 | **90%** |
| Enterprise -20% | Sonnet 4.5 | $38 | $461 | **92%** |
| Premium option | Opus 4.6 | $80 | $419 | **84%** |

**Starter is extremely profitable.** Even at retail Opus pricing, margin exceeds 84%.

---

### Professional — $1,499/mo (5,000 messages + 1 agent)

Agent assumption: 1 agent processing 50 docs/day = 1,100 docs/month

| Scenario | Chat Cost | Agent Cost | Total API | Margin | Gross % |
|---|---|---|---|---|---|
| Retail Sonnet | $240 | $39 | **$279** | $1,220 | **81%** |
| Enterprise -20% Sonnet | $190 | $31 | **$221** | $1,278 | **85%** |
| Retail Opus | $400 | $64 | **$464** | $1,035 | **69%** |
| Hybrid (Haiku agent) | $240 | $13 | **$253** | $1,246 | **83%** |

**Professional has strong margins.** Even with Opus for chat, margin stays above 69%.

---

### Business — $2,999/mo (15,000 messages + unlimited agents)

Agent assumption: 5 agents, avg 100 docs/day each = 11,000 docs/month

| Scenario | Chat Cost | Agent Cost | Total API | Margin | Gross % |
|---|---|---|---|---|---|
| Retail Sonnet | $720 | $385 | **$1,105** | $1,894 | **63%** |
| Enterprise -20% Sonnet | $570 | $308 | **$878** | $2,121 | **71%** |
| Enterprise -30% Sonnet | $510 | $270 | **$780** | $2,219 | **74%** |
| Hybrid (Haiku agents) | $720 | $132 | **$852** | $2,147 | **72%** |
| Ent -20% + Haiku agents | $570 | $106 | **$676** | $2,323 | **77%** |

**Business margin depends on agent volume.** Haiku for agents is the biggest cost lever here.

---

### Enterprise SaaS — $5,999-8,999/mo (50,000 messages + heavy agents)

Agent assumption: 20 agents, avg 200 docs/day = 88,000 docs/month

**At $8,999/mo subscription:**

| Scenario | Chat Cost | Agent Cost | Total API | Margin | Gross % |
|---|---|---|---|---|---|
| Retail Sonnet | $2,400 | $3,080 | **$5,480** | $3,519 | **39%** |
| Enterprise -20% Sonnet | $1,900 | $2,464 | **$4,364** | $4,635 | **52%** |
| Enterprise -30% Sonnet | $1,680 | $2,156 | **$3,836** | $5,163 | **57%** |
| Ent -20% + Haiku agents | $1,900 | $792 | **$2,692** | $6,307 | **70%** |
| Ent -30% + Haiku agents | $1,680 | $693 | **$2,373** | $6,626 | **74%** |

**Enterprise margin is healthy with Haiku agents.** Without model routing, agent-heavy deployments eat into margin.

---

## 6. The 5,000-User Enterprise Scenario (Critical Analysis)

This is the scenario from the pricing deck where a large enterprise deploys Altius organization-wide.

### Usage Model

| User Segment | Users | Msgs/Day | Daily Total |
|---|---|---|---|
| Power users (10%) | 500 | 15 | 7,500 |
| Regular users (25%) | 1,250 | 5 | 6,250 |
| Light users (30%) | 1,500 | 2 | 3,000 |
| Occasional (35%) | 1,750 | 0.3 | 525 |
| **Total** | **5,000** | | **17,275/day** |

**Monthly volume**: 17,275 x 22 working days = **380,050 messages/month**

Agent assumption: 50 agents processing 500 docs/day = 550,000 docs/month

### Cost Breakdown

| Component | Sonnet Retail | Sonnet Ent -20% | Sonnet Ent -30% |
|---|---|---|---|
| Chat (380K msgs) | $18,242 | $14,442 | $12,922 |
| Agents (550K docs) | $19,250 | $15,400 | $13,475 |
| **Total API cost** | **$37,492** | **$29,842** | **$26,397** |

**At $8,999/mo subscription: massive loss.** Even at 30% enterprise discount, the API cost alone is 3x the subscription price.

### What Pricing Makes This Work?

| Optimization | Monthly API Cost | Break-Even Subscription |
|---|---|---|
| Sonnet only (retail) | $37,492 | ~$50,000/mo |
| Sonnet only (ent -30%) | $26,397 | ~$35,000/mo |
| Haiku agents, Sonnet chat (ent -20%) | $14,442 + $4,950 = $19,392 | ~$26,000/mo |
| Haiku agents, model routing chat (ent -20%) | $9,122 + $4,950 = $14,072 | ~$19,000/mo |
| Full Haiku (simple) + Sonnet (complex) (ent -20%) | $12,286 | ~$16,500/mo |

### Model Routing: The Critical Optimization

If Altius routes queries intelligently:
- **60% to Haiku** (simple searches, browsing, status checks) at $0.013/msg
- **35% to Sonnet** (analysis, workflow, extraction) at $0.038/msg
- **5% to Opus** (complex multi-step, analytics deep dive) at $0.064/msg

**Blended cost per message**: (0.60 x $0.013) + (0.35 x $0.038) + (0.05 x $0.064) = **$0.024/msg**

5,000-user scenario with routing: 380,050 x $0.024 = **$9,121/mo** for chat

Plus Haiku agents: 550,000 x $0.009 = **$4,950/mo**

**Total with routing + Haiku agents + enterprise -20%: $14,071/mo**

At $25,000/mo enterprise pricing ($5/user/mo): **44% gross margin** — viable.
At $35,000/mo enterprise pricing ($7/user/mo): **60% gross margin** — strong.

---

## 7. Opus vs Sonnet: When Is Opus Worth It?

### Price Comparison (Per Message)

| | Sonnet 4.5 | Opus 4.6 | Opus Premium |
|---|---|---|---|
| Per message (retail) | $0.048 | $0.080 | 1.67x Sonnet |
| Per message (ent -20%) | $0.038 | $0.064 | 1.67x Sonnet |
| Monthly cost @ 1K msgs | $48 | $80 | +$32/mo |
| Monthly cost @ 5K msgs | $240 | $400 | +$160/mo |
| Monthly cost @ 50K msgs | $2,400 | $4,000 | +$1,600/mo |

### When Opus Adds Value

| Use Case | Sonnet | Opus | Recommendation |
|---|---|---|---|
| Document search & browsing | Excellent | Overkill | **Sonnet** |
| Metadata extraction | Good | Better accuracy | Sonnet (cost efficiency) |
| Complex workflow automation | Good | Significantly better | **Opus for high-value** |
| Multi-step analytics | Good | Better reasoning | **Opus if margin allows** |
| Contract risk analysis | Adequate | Superior | **Opus — liability reduction** |
| Simple classification (agent) | Overkill | Way overkill | **Haiku** |

### Opus as a Premium Tier Add-On

If Altius offered "Opus Mode" as a premium feature:

| Tier | Sonnet Base Cost | Opus Upgrade Cost | Premium Charge | Viable? |
|---|---|---|---|---|
| Starter | $48 | +$32 | +$100/mo | Yes (margin $68) |
| Professional | $240 | +$160 | +$300/mo | Yes (margin $140) |
| Business | $720 | +$480 | +$750/mo | Yes (margin $270) |
| Enterprise | $2,400 | +$1,600 | Included | Absorb in enterprise price |

---

## 8. Cost Optimization Strategies

### Already Implemented

| Optimization | Savings | Status |
|---|---|---|
| Ephemeral prompt caching (system + tools) | ~90% on 11,800 tokens/request | Built |
| Tool result compaction | ~40% reduction on tool outputs | Built |
| Parallel tool execution (batch 6) | Fewer rounds = fewer API calls | Built |
| Agent filtered toolset (13 vs 42) | 67% schema overhead reduction | Built |

### Recommended — High Impact

| Optimization | Estimated Savings | Effort | Priority |
|---|---|---|---|
| **Model routing (Haiku/Sonnet/Opus)** | 40-60% on chat costs | Medium | **Critical** |
| **Haiku for agent processing** | 65-70% on agent costs | Low | **Critical** |
| **1-hour cache TTL** | 5-15% (fewer cache writes) | Low | High |
| **Batch API for non-urgent agents** | 50% on agent costs | Medium | High |
| **Conversation summarization** | 30-50% on long conversations | Medium | Medium |

### Model Routing Architecture

```
User message arrives
    |
    v
[Classifier — Haiku 4.5, ~$0.001 per classification]
    |
    ├── Simple query (search, browse, status)  → Haiku 4.5    ($0.016/msg)
    ├── Standard query (workflow, extraction)   → Sonnet 4.5   ($0.048/msg)
    └── Complex query (analysis, multi-step)   → Opus 4.6     ($0.080/msg)
```

Cost of the classifier itself: ~200 tokens input + 20 tokens output = $0.0003/msg (negligible)

**Projected distribution**: 55% Haiku, 35% Sonnet, 10% Opus
**Blended cost**: $0.0088 + $0.0168 + $0.008 = **$0.034/msg** (vs $0.048 all-Sonnet)
**Savings**: 29% reduction in chat costs

### Conversation Summarization

For conversations exceeding 10 turns, summarize older turns to reduce history tokens:

| Conversation Length | Without Summary | With Summary | Savings |
|---|---|---|---|
| 5 turns | 3,500 history tokens | 3,500 (no change) | 0% |
| 10 turns | 12,000 history tokens | 5,000 (summarized) | 58% |
| 20 turns | 30,000 history tokens | 6,000 (summarized) | 80% |
| 30 turns | 50,000+ history tokens | 7,000 (summarized) | 86% |

At 30 turns, history alone costs $0.15/request at Sonnet rates. Summarization brings it to $0.02.

---

## 9. Margin Summary by Tier

### Current Model (Sonnet 4.5 Only)

| Tier | Subscription | API Cost (Ent -20%) | Infra + Other | Net Margin | Gross % |
|---|---|---|---|---|---|
| **Starter** | $499 | $38 | $10 | $451 | **90%** |
| **Professional** | $1,499 | $221 | $15 | $1,263 | **84%** |
| **Business** | $2,999 | $878 | $25 | $2,096 | **70%** |
| **Enterprise** (moderate) | $8,999 | $4,364 | $50 | $4,585 | **51%** |
| **Enterprise** (5K users) | $8,999 | $29,842 | $100 | **-$20,943** | **-233%** |

### Optimized Model (Routing + Haiku Agents)

| Tier | Subscription | API Cost (Ent -20%) | Infra + Other | Net Margin | Gross % |
|---|---|---|---|---|---|
| **Starter** | $499 | $32 | $10 | $457 | **92%** |
| **Professional** | $1,499 | $181 | $15 | $1,303 | **87%** |
| **Business** | $2,999 | $576 | $25 | $2,398 | **80%** |
| **Enterprise** (moderate) | $8,999 | $2,373 | $50 | $6,576 | **73%** |
| **Enterprise** (5K users) | $25,000 | $14,071 | $100 | $10,829 | **43%** |

---

## 10. Enterprise Pricing Recommendations

### Per-User Pricing for Large Deployments

For organizations over 500 users, flat-rate pricing breaks down. Recommended approach:

| User Count | Per-User/Month | Base Platform Fee | Monthly Total |
|---|---|---|---|
| 500-1,000 | $8.00 | $2,000 | $6,000-10,000 |
| 1,000-2,500 | $6.50 | $2,000 | $8,500-18,250 |
| 2,500-5,000 | $5.00 | $2,000 | $14,500-27,000 |
| 5,000-10,000 | $4.00 | $2,000 | $22,000-42,000 |
| 10,000+ | $3.00 | $2,000 | $32,000+ |

This ensures API costs scale with usage while maintaining 40-60% margins.

### The 5,000-User Deal Structure

| Component | Monthly Cost to Altius | Monthly Revenue | Notes |
|---|---|---|---|
| Chat API (routed) | $9,121 | | 60% Haiku / 35% Sonnet / 5% Opus |
| Agent API (Haiku) | $4,950 | | 50 agents, 500 docs/day each |
| Infrastructure | $200 | | Dedicated instance |
| Support (CSM) | $2,000 | | 0.25 FTE |
| **Total cost** | **$16,271** | | |
| **Subscription** | | **$27,000** | $5/user + $2K platform |
| **Implementation** | | **$75,000** (one-time) | 80-hour setup |
| **Margin** | | **$10,729/mo** | **40% gross** |
| **Year 1 total revenue** | | **$399,000** | Subscription + implementation |

---

## 11. On-Premise License: API Cost Pass-Through

For on-premise deployments, two models:

### Option A: Customer Brings Their Own Key (BYOK)

- Customer gets their own Anthropic API key
- Customer pays Anthropic directly
- Altius charges license fee only
- **Zero API cost to Altius** = ~90% license margin

### Option B: Altius Provides API Access

- Altius manages the Anthropic relationship
- API cost is embedded in license fee
- Must size the license to cover expected usage

| License Tier | Annual License | Estimated API Cost/Year | Total Cost to Altius | Margin |
|---|---|---|---|---|
| Standard (100 users) | $75,000 | $15,000-25,000 | $15K-25K | 67-80% |
| Enterprise (unlimited) | $150,000 | $50,000-150,000 | $50K-150K | 0-67% |

**Recommendation**: BYOK for on-premise. It simplifies billing, eliminates API margin risk, and large enterprises prefer controlling their own vendor relationships.

---

## 12. Annual API Spend Forecast (Altius Portfolio)

Assuming growth trajectory from monetization strategy:

### Year 1 (50 customers)

| Tier | Customers | Avg API/Mo Each | Monthly API Total |
|---|---|---|---|
| Starter | 25 | $38 | $950 |
| Professional | 15 | $221 | $3,315 |
| Business | 8 | $878 | $7,024 |
| Enterprise | 2 | $4,364 | $8,728 |
| **Total** | **50** | | **$20,017/mo** |

**Annual API spend: ~$240K** → qualifies for 15-20% enterprise discount
**Annual subscription revenue: ~$1.8M** → overall 87% gross margin

### Year 2 (170 customers)

| Tier | Customers | Avg API/Mo Each | Monthly API Total |
|---|---|---|---|
| Starter | 60 | $32 | $1,920 |
| Professional | 55 | $181 | $9,955 |
| Business | 35 | $576 | $20,160 |
| Enterprise | 20 | $2,373 | $47,460 |
| **Total** | **170** | | **$79,495/mo** |

**Annual API spend: ~$954K** → qualifies for 25-30% enterprise discount
**Annual subscription revenue: ~$5.7M** → overall 83% gross margin

### Year 3 (367 customers)

| Tier | Customers | Avg API/Mo Each | Monthly API Total |
|---|---|---|---|
| Starter | 100 | $28 | $2,800 |
| Professional | 120 | $155 | $18,600 |
| Business | 90 | $490 | $44,100 |
| Enterprise | 57 | $2,020 | $115,140 |
| **Total** | **367** | | **$180,640/mo** |

**Annual API spend: ~$2.17M** → negotiating 30%+ discount
**Annual subscription revenue: ~$13.2M** → overall 80% gross margin

---

## 13. Key Takeaways

1. **Starter and Professional tiers are extremely profitable** (84-92% margin). These are the volume backbone of the business.

2. **Business tier is healthy** at 70-80% margin but sensitive to agent volume. Haiku for agents is critical.

3. **Enterprise flat-rate pricing breaks above ~500 users.** Must use per-user pricing component for large deployments.

4. **The 5,000-user scenario requires $25K+/mo** to be viable, not $8,999. Structure as $5/user/mo + platform fee.

5. **Model routing is the single most impactful optimization** — reduces chat costs by 29-40% and unlocks profitable large-enterprise deals.

6. **Haiku for agents is non-negotiable** at scale. Classification and routing tasks don't need Sonnet reasoning. Saves 65-70% on agent processing.

7. **Enterprise Anthropic discount is essential by Year 2.** At ~$1M/year API spend, negotiate 25-30% discount proactively.

8. **On-premise: always BYOK.** Eliminates API margin risk entirely. License revenue is nearly pure margin.

9. **Batch API for non-time-critical agents** (overnight processing, scheduled reports) provides an additional 50% savings layer.

10. **Opus should be a premium add-on**, not the default. Sonnet handles 90%+ of use cases. Offer Opus as "Enhanced Analysis Mode" for enterprise customers willing to pay the premium.

---

## Sources

- [Anthropic Official Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic API Pricing — The 2026 Guide (nops.io)](https://www.nops.io/blog/anthropic-api-pricing/)
- [MetaCTO — Complete Cost Breakdown](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration/)
- [Anthropic Enterprise Sales](https://claude.com/contact-sales)
- Altius codebase: `packages/core/src/llm/cost.ts`, `web/src/lib/ai-orchestrator.ts`, `packages/core/src/tools/definitions.ts`
