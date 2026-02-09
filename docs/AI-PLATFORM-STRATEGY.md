# Altius — AI Platform & Model Diversification Strategy

> Assessment of alternative AI platforms, multi-model routing, RAG architecture,
> embedding models, and vector databases to reduce cost and vendor risk.

---

## Executive Summary

Altius currently runs exclusively on Anthropic's Claude API. This is the right choice for product quality — Claude's tool-use capabilities are best-in-class for the agentic workflows Altius performs. However, single-vendor dependency creates two strategic risks:

1. **Cost exposure**: Anthropic controls 100% of Altius's variable cost structure (API spend is 85-95% of COGS)
2. **Vendor risk**: Rate limit changes, pricing increases, or service disruptions have no fallback

This document assesses how to introduce multi-model support, RAG capabilities, and embedding/vector infrastructure to make Altius commercially more efficient while maintaining product quality.

**Key findings:**

| Strategy | Annual Savings (at 170 customers) | Implementation Effort | Priority |
|---|---|---|---|
| Multi-model routing (Haiku/Sonnet/Opus) | $230K-380K | Already planned | **Critical** |
| Cross-provider routing (OpenAI/Gemini for simple tasks) | $80K-150K | 2-3 weeks | High |
| RAG for document context (reduce token usage) | $50K-120K | 3-4 weeks | High |
| Open-source models for agents | $100K-200K | 4-6 weeks | Medium |
| Self-hosted models for on-premise | Enables BYOK alternative | 6-8 weeks | Medium |

**Total potential savings: $460K-850K/year at Year 2 scale** — improving gross margin from 83% to 88-91%.

---

## 1. Current State: Anthropic-Only Architecture

### How Altius Uses the LLM

```
User message → ai-orchestrator.ts → Anthropic SDK → Claude API
                     ↓
              System prompt (2,054 tokens)
              Tool schemas (9,400 tokens)
              Conversation history
                     ↓
              Streaming response + tool calls
                     ↓
              Tool execution (OTCS client) → Results fed back
                     ↓
              Final response to user
```

### Current Coupling Assessment

| Component | Coupling Level | Notes |
|---|---|---|
| Tool definitions | **Low** (portable) | Protocol-neutral JSON Schema, already has `toAnthropicTools()` and `toMCPTools()` converters |
| Tool handlers | **None** (provider-agnostic) | Pure OTCS client calls, no LLM dependency |
| System prompt | **Low** (just a string) | Works with any model that supports system instructions |
| Orchestrator | **High** (Anthropic-specific) | Direct `Anthropic.messages.stream()`, hardcoded message types |
| Cost tracking | **High** (hardcoded pricing) | `packages/core/src/llm/cost.ts` has Anthropic-only rates |
| Streaming | **High** (Anthropic events) | SSE format tied to Anthropic's `content_block_start/delta/end` |

**Bottom line**: The tool layer is already portable. The orchestration layer needs an abstraction to support multiple providers.

### Current API Spend Profile (Year 2 projection)

| Component | Monthly Cost | Annual Cost |
|---|---|---|
| Chat messages (Sonnet 4.5) | $45,000 | $540,000 |
| Agent processing (Sonnet 4.5) | $34,000 | $408,000 |
| **Total Anthropic API** | **$79,000** | **$948,000** |

At this scale, even small percentage improvements in cost efficiency translate to significant dollar savings.

---

## 2. Alternative LLM Providers: Pricing Comparison

### Tier 1: Premium Models (Complex Reasoning, Multi-Step Agentic Tasks)

These are the models capable of handling Altius's full agentic workflow: tool use, multi-turn reasoning, structured output.

| Provider | Model | Input/MTok | Output/MTok | Tool Use | Streaming | Cache |
|---|---|---|---|---|---|---|
| **Anthropic** | Claude Opus 4.6 | $5.00 | $25.00 | Excellent | Yes | Ephemeral |
| **Anthropic** | Claude Sonnet 4.5 | $3.00 | $15.00 | Excellent | Yes | Ephemeral |
| **OpenAI** | GPT-4.1 | $2.00 | $8.00 | Good | Yes | Yes |
| **Google** | Gemini 2.5 Pro | $1.25 | $10.00 | Good | Yes | Context |
| **DeepSeek** | R1 | $0.40 | $1.75 | Limited | Yes | No |

**Analysis**: GPT-4.1 is 33% cheaper on input and 47% cheaper on output than Sonnet 4.5. Gemini 2.5 Pro is 58% cheaper on input but 33% cheaper on output. However, Claude's tool-use reliability and instruction-following remain superior for complex OTCS workflows.

### Tier 2: Mid-Range Models (Standard Queries, Single-Tool Tasks)

| Provider | Model | Input/MTok | Output/MTok | Tool Use | Best For |
|---|---|---|---|---|---|
| **Anthropic** | Claude Haiku 4.5 | $1.00 | $5.00 | Good | Classification, simple search |
| **OpenAI** | GPT-4.1 mini | $0.40 | $1.60 | Good | Simple queries, routing |
| **Google** | Gemini 2.0 Flash | $0.10 | $0.40 | Good | High-volume, simple tasks |
| **DeepSeek** | V3.1 | $0.15 | $0.75 | Basic | Bulk processing |

**Analysis**: GPT-4.1 mini is 60% cheaper than Haiku on input and 68% cheaper on output. Gemini 2.0 Flash is 90% cheaper than Haiku. For simple queries (search, browse, status checks), these models are adequate and dramatically cheaper.

### Tier 3: Economy Models (Agent Processing, Classification)

| Provider | Model | Input/MTok | Output/MTok | Tool Use | Best For |
|---|---|---|---|---|---|
| **OpenAI** | GPT-4.1 nano | $0.10 | $0.40 | Basic | Classification, tagging |
| **Google** | Gemini 2.0 Flash Lite | $0.04 | $0.15 | Basic | Bulk classification |
| **Open-source** | Llama 3.3 70B (hosted) | $0.20 | $0.80 | Basic | Self-hosted agents |
| **Open-source** | Mistral Large (hosted) | $0.20 | $0.60 | Good | Self-hosted alternative |

**Analysis**: For agent processing tasks (classify document, extract metadata, apply hold), GPT-4.1 nano at $0.10/$0.40 is **10x cheaper on input** than Haiku at $1.00/$5.00. Even accounting for potentially lower accuracy on complex classification, the cost savings are extraordinary for routine document processing.

### Cloud Platform Providers (AWS Bedrock, Azure OpenAI, Google Vertex)

| Platform | Markup vs Direct | Benefits | Drawbacks |
|---|---|---|---|
| **AWS Bedrock** | ~10% regional premium | VPC deployment, IAM, CloudWatch | Higher cost, slower model updates |
| **Azure OpenAI** | Same as OpenAI direct | Enterprise compliance, AD integration | Azure lock-in |
| **Google Vertex AI** | ~10% regional premium | GCP integration, Gemini native | Google ecosystem required |

**Recommendation**: Use direct APIs for SaaS (lower cost). Use Bedrock/Azure/Vertex only for on-premise customers who require cloud provider compliance certifications.

---

## 3. Multi-Provider Routing Architecture

### Proposed Architecture

```
User message arrives
         │
         ▼
┌─────────────────────────────┐
│    LLM Provider Abstraction │    ← New: packages/core/src/llm/provider.ts
│    (LLMClient interface)    │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│    Query Classifier          │    ← Haiku or GPT-4.1 nano (~$0.001/call)
│    (complexity + intent)     │
└─────────┬───────────────────┘
          │
    ┌─────┼─────────┐
    │     │         │
    ▼     ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐
│Simple│ │Medium│ │Complex│
│ 60%  │ │ 30%  │ │  10%  │
└──┬───┘ └──┬───┘ └──┬────┘
   │        │        │
   ▼        ▼        ▼
 Gemini   Sonnet    Opus
 Flash    4.5 or    4.6
 or Mini  GPT-4.1
```

### Implementation: LLMClient Interface

```typescript
// packages/core/src/llm/provider.ts
interface LLMClient {
  stream(params: {
    model: string;
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
    maxTokens: number;
  }): AsyncIterable<StreamEvent>;

  classify(message: string): Promise<'simple' | 'medium' | 'complex'>;
}

// Provider implementations
class AnthropicProvider implements LLMClient { ... }
class OpenAIProvider implements LLMClient { ... }
class GeminiProvider implements LLMClient { ... }
class DeepSeekProvider implements LLMClient { ... }
```

### Routing Cost Impact

**Current (all Sonnet 4.5):**

| Component | Cost/Message | Monthly (170 customers) |
|---|---|---|
| All chat messages | $0.048 | $45,000 |
| All agent docs | $0.035 | $34,000 |
| **Total** | | **$79,000/mo** |

**Optimized (multi-provider routing):**

| Tier | % Traffic | Provider | Cost/Msg | Monthly Cost |
|---|---|---|---|---|
| Simple chat (60%) | 562,500 msgs | Gemini Flash or GPT-4.1 mini | $0.005 | $2,813 |
| Medium chat (30%) | 281,250 msgs | Sonnet 4.5 or GPT-4.1 | $0.038 | $10,688 |
| Complex chat (10%) | 93,750 msgs | Opus 4.6 | $0.064 | $6,000 |
| Agent classification | 660,000 docs | GPT-4.1 nano | $0.005 | $3,300 |
| Agent complex | 110,000 docs | Haiku 4.5 | $0.009 | $990 |
| **Total** | | | | **$23,791/mo** |

**Savings: $55,209/mo = $663K/year (70% reduction)**

Even a conservative implementation (Anthropic-only routing with Haiku/Sonnet/Opus) saves $380K/year. Adding cross-provider routing pushes savings to $500K+.

---

## 4. RAG Architecture: When and Why

### What RAG Solves for Altius

Currently, every OTCS query goes through the full LLM pipeline: system prompt + tool schemas + conversation history + tool execution + response. RAG (Retrieval-Augmented Generation) can reduce this cost by:

1. **Caching OTCS query results** — If a user frequently searches the same folders or asks about the same documents, RAG serves cached results without a full API round-trip
2. **Pre-indexing document content** — Instead of calling `otcs_extract_text` every time, pre-extracted text is stored in a vector database and retrieved instantly
3. **Reducing conversation context** — Instead of carrying 15,000+ tokens of conversation history, RAG retrieves only the relevant prior context
4. **Enabling semantic search** — Users can ask natural language questions that map to document content, not just OTCS metadata

### RAG Architecture for Altius

```
┌─────────────────────────────────────────────────────┐
│                    User Query                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Embedding Model                         │
│   (OpenAI text-embedding-3-small or Voyage-3)       │
│              $0.02-0.06 / MTok                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│            Vector Database (pgvector)                 │
│   Pre-indexed: document text, metadata, folder       │
│   structure, workflow definitions, user queries       │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
        Cache Hit        Cache Miss
     (serve from DB)   (call OTCS + LLM)
              │               │
              ▼               ▼
┌─────────────────────────────────────────────────────┐
│           LLM with Augmented Context                 │
│   Context = retrieved docs + user query              │
│   (Fewer tokens than full tool execution)            │
└─────────────────────────────────────────────────────┘
```

### What to Index in the Vector Database

| Content Type | Source | Update Frequency | Value |
|---|---|---|---|
| Document text extracts | `otcs_extract_text` results | On document upload/update | Enables semantic search without API calls |
| Folder structures | `otcs_browse` results | Daily sync | Instant folder navigation |
| Document metadata | Node properties | On change | Fast metadata queries |
| Workflow definitions | Workflow maps | Weekly sync | Workflow context without tool calls |
| Previous query results | Chat history | Per session | Deduplication, faster follow-ups |
| Agent classification results | Agent output | Per agent run | Avoid re-classifying known documents |

### RAG Cost Savings Model

**Without RAG (current):**

| Query Type | Tool Calls | API Rounds | Cost/Query |
|---|---|---|---|
| "Find all contracts from Vendor X" | 2-3 | 2-3 | $0.054 |
| "What's in the Legal folder?" | 1-2 | 2 | $0.024 |
| "Show me document 12345 details" | 1 | 2 | $0.024 |

**With RAG (cache hit):**

| Query Type | Vector Lookup | LLM Call | Cost/Query |
|---|---|---|---|
| "Find all contracts from Vendor X" | $0.0001 | $0.008 (summary only) | $0.008 |
| "What's in the Legal folder?" | $0.0001 | $0.005 (from cache) | $0.005 |
| "Show me document 12345 details" | $0.0001 | $0.000 (direct serve) | $0.000 |

Estimated cache hit rate for active organizations: **30-50%** of queries are repeat or similar patterns.

**Monthly savings at 170 customers (937,500 chat messages/mo):**
- 35% cache hit rate x 937,500 = 328,125 queries served from RAG
- Average savings per cached query: $0.035
- **Monthly savings: ~$11,500/mo = $138K/year**

---

## 5. Embedding Model Comparison

### Pricing & Capabilities

| Model | Provider | Price/MTok | Dimensions | Max Input | Notes |
|---|---|---|---|---|---|
| **text-embedding-3-small** | OpenAI | $0.02 | 1,536 | 8,191 | Best price/performance ratio |
| **text-embedding-3-large** | OpenAI | $0.13 | 3,072 | 8,191 | Highest accuracy, 6.5x cost |
| **gemini-embedding-001** | Google | $0.15 | 3,072 | 2,048 | Matryoshka (scalable dims) |
| **embed-v4** | Cohere | $0.10 | 1,024 | 512 | Good for short text |
| **voyage-3** | Voyage AI | $0.06 | 1,024 | 32,000 | Long document support |
| **voyage-3-large** | Voyage AI | $0.18 | 2,048 | 32,000 | Premium accuracy |
| **BGE-large-en-v1.5** | BAAI | Free (self-host) | 1,024 | 512 | Open-source, GPU required |
| **nomic-embed-text** | Nomic | Free (self-host) | 768 | 8,192 | Open-source, long context |

### Recommendation for Altius

**Primary: OpenAI `text-embedding-3-small`** ($0.02/MTok)
- Best cost-efficiency for the volume Altius needs
- 1,536 dimensions is sufficient for document similarity and semantic search
- 8K token input handles most OTCS document extracts
- Battle-tested, excellent SDK support

**Secondary (for on-premise): `nomic-embed-text`** (free, self-hosted)
- Runs on modest GPU (4GB VRAM) or CPU
- 8K context window matches OpenAI's small model
- No API dependency — critical for air-gapped deployments

### Embedding Cost at Scale

| Scenario | Documents | Avg Tokens/Doc | Embedding Cost |
|---|---|---|---|
| Small org (1,000 docs) | 1,000 | 2,000 | $0.04 |
| Medium org (50,000 docs) | 50,000 | 2,000 | $2.00 |
| Large org (500,000 docs) | 500,000 | 2,000 | $20.00 |
| Enterprise (2M docs) | 2,000,000 | 2,000 | $80.00 |

**Embedding cost is negligible** — even 2M documents costs $80 to embed (one-time), plus incremental costs for new documents. This is a rounding error compared to LLM API costs.

---

## 6. Vector Database Comparison

### Options Analysis

| Database | Type | Free Tier | Paid Starting | Strengths | Weaknesses |
|---|---|---|---|---|---|
| **pgvector** | Extension | Free (self-host) | N/A | Already using PostgreSQL, zero new infra | Limited at >1M vectors, no HNSW tuning |
| **Pinecone** | Managed | 100K vectors | $70/mo | Fastest managed, serverless | Expensive at scale, vendor lock-in |
| **Qdrant** | Managed/Self | 1GB free | $25/mo | Fast, good filtering, self-hostable | Smaller ecosystem |
| **Weaviate** | Managed/Self | Free tier | $25/mo | Hybrid search (vector + keyword) | Complex configuration |
| **ChromaDB** | Self-hosted | Free | N/A | Simple API, Python-native | No managed option, limited scale |
| **Milvus/Zilliz** | Managed/Self | Free tier | $65/mo | Enterprise scale, GPU acceleration | Complex, over-engineered for small scale |

### Recommendation for Altius

**Phase 1 (Now): pgvector**
- Altius already runs PostgreSQL — pgvector is a single `CREATE EXTENSION`
- Zero new infrastructure, zero new vendor, zero new cost
- Handles up to ~500K vectors per table efficiently (covers 99% of customers)
- HNSW index for fast approximate nearest-neighbor search
- Already supported by Drizzle ORM

**Phase 2 (When needed): Qdrant Cloud or Pinecone**
- When a customer exceeds 1M documents or needs sub-10ms vector search
- Qdrant is self-hostable (important for on-premise customers)
- Pinecone for managed simplicity if budget allows

### pgvector Implementation

```sql
-- Enable the extension (one-time)
CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings table
CREATE TABLE document_embeddings (
  id          SERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES organizations(id),
  node_id     BIGINT NOT NULL,          -- OTCS node ID
  chunk_index INT NOT NULL DEFAULT 0,   -- For long documents split into chunks
  content     TEXT NOT NULL,             -- Original text chunk
  embedding   vector(1536) NOT NULL,    -- OpenAI small dimensionality
  metadata    JSONB DEFAULT '{}',       -- Node type, parent folder, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, node_id, chunk_index)
);

-- HNSW index for fast similarity search
CREATE INDEX ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Filter by org for multi-tenant isolation
CREATE INDEX ON document_embeddings (org_id);
```

**Storage estimate**: 1,536-dim float32 vector = ~6KB per vector. 500K documents = ~3GB. Well within PostgreSQL's comfort zone.

---

## 7. Implementation Roadmap

### Phase 1: LLM Abstraction Layer (Week 1-2)

**Goal**: Decouple from Anthropic SDK without changing behavior.

1. Create `LLMClient` interface in `packages/core/src/llm/provider.ts`
2. Implement `AnthropicProvider` that wraps current `ai-orchestrator.ts` logic
3. Update `ai-orchestrator.ts` to use the abstraction
4. Update `cost.ts` to support per-provider pricing
5. Add provider config to environment variables

**Deliverable**: Same functionality, but the orchestrator is provider-agnostic.

### Phase 2: Anthropic Model Routing (Week 2-3)

**Goal**: Route queries across Haiku/Sonnet/Opus based on complexity.

1. Build query classifier (Haiku-based, ~$0.001/call)
2. Implement routing rules (simple → Haiku, standard → Sonnet, complex → Opus)
3. Add model selection to usage tracking
4. Test accuracy across query types

**Deliverable**: 29-40% chat cost reduction, Anthropic-only.

### Phase 3: OpenAI Provider (Week 3-4)

**Goal**: Add GPT-4.1 family as an alternative provider.

1. Implement `OpenAIProvider` against `LLMClient` interface
2. Map tool definitions to OpenAI function calling format (already similar to JSON Schema)
3. Adapt streaming to OpenAI's SSE format
4. A/B test quality: run same queries through Claude and GPT-4.1, compare tool-call accuracy
5. Add cross-provider routing for simple queries

**Deliverable**: Simple queries can route to GPT-4.1 mini (60-68% cheaper than Haiku).

### Phase 4: RAG + pgvector (Week 4-6)

**Goal**: Add vector search for document content and query caching.

1. Add pgvector extension to PostgreSQL
2. Create `document_embeddings` table and Drizzle schema
3. Build embedding pipeline: on document access, embed and store extracted text
4. Build retrieval layer: before LLM call, check vector DB for relevant cached content
5. Integrate RAG context into LLM prompt (reduce tool calls for cached content)
6. Add incremental sync: re-embed on document update

**Deliverable**: 30-50% of queries served partially from cache, reducing API costs.

### Phase 5: Agent Optimization (Week 6-8)

**Goal**: Move agent processing to cheapest capable models.

1. Benchmark agent classification accuracy across models (Haiku, GPT-4.1 mini, GPT-4.1 nano, Gemini Flash)
2. Implement per-agent model selection (configurable in agent rules)
3. Use GPT-4.1 nano for simple classification, Haiku for complex
4. Add batch API support for non-time-critical agent processing

**Deliverable**: Agent processing cost drops 70-85%.

### Phase 6: Customer Model Choice (Week 8-10)

**Goal**: Let customers (especially enterprise/on-premise) choose their preferred model.

1. Add model preference to org settings
2. Support BYOK for OpenAI, Google, and Anthropic keys
3. For on-premise: add support for local model endpoints (Ollama, vLLM)
4. Build model comparison dashboard in admin panel

**Deliverable**: Enterprise customers can bring their own API key for any supported provider.

---

## 8. On-Premise & Self-Hosted Model Support

### Why This Matters

On-premise customers ($75K-150K/year license) often cannot send data to external AI APIs. Current options:

1. **AWS Bedrock in their VPC** — Claude via Bedrock, data stays in AWS
2. **Azure OpenAI in their tenant** — GPT-4.1 via Azure, data stays in Azure
3. **Self-hosted open-source models** — Llama 3.3 70B, Mistral Large via vLLM or Ollama

### Self-Hosted Model Requirements

For Altius's agentic workflow (tool use, multi-turn, structured output), the minimum viable self-hosted model is:

| Requirement | Minimum | Recommended |
|---|---|---|
| Parameters | 70B | 70B+ |
| Tool/Function calling | Required | Required |
| Context window | 32K | 128K |
| GPU VRAM | 40GB (quantized) | 80GB (full precision) |
| Hardware | 1x A100 40GB | 2x A100 80GB or 1x H100 |
| Monthly cost (cloud GPU) | ~$1,500/mo | ~$3,000/mo |

### Recommended Self-Hosted Stack

```
┌─────────────────────────────────────────┐
│           Customer Infrastructure        │
│                                          │
│  ┌──────────────┐   ┌────────────────┐  │
│  │   Altius      │   │  vLLM / Ollama │  │
│  │  (Docker)     │──▶│  Llama 3.3 70B │  │
│  │              │   │  (GPU server)   │  │
│  └──────┬───────┘   └────────────────┘  │
│         │                                │
│  ┌──────┴───────┐   ┌────────────────┐  │
│  │  PostgreSQL   │   │  pgvector      │  │
│  │  + pgvector   │   │  embeddings    │  │
│  └──────────────┘   └────────────────┘  │
│                                          │
│  Embedding: nomic-embed-text (CPU)       │
│  No external API calls required          │
└─────────────────────────────────────────┘
```

**Trade-off**: Self-hosted models are 20-30% less accurate on complex agentic tasks compared to Claude Sonnet 4.5. For on-premise customers, this trade-off is acceptable because the alternative is no AI at all (data can't leave the network).

---

## 9. Commercial Impact Analysis

### Scenario: Year 2 (170 Customers) — Before vs After

**Before (Anthropic-only, all Sonnet):**

| Metric | Value |
|---|---|
| Monthly API spend | $79,495 |
| Annual API spend | $953,940 |
| Annual subscription revenue | $5,700,000 |
| Gross margin (API only) | 83.3% |

**After (Multi-provider + RAG + agent optimization):**

| Optimization | Monthly Savings | Annual Savings |
|---|---|---|
| Anthropic model routing (Haiku/Sonnet/Opus) | $20,000 | $240,000 |
| Cross-provider routing (GPT-4.1 mini for simple) | $8,000 | $96,000 |
| RAG cache hits (35% of queries) | $11,500 | $138,000 |
| Agent model optimization (nano/Haiku mix) | $10,500 | $126,000 |
| **Total savings** | **$50,000** | **$600,000** |

| Metric | Before | After | Delta |
|---|---|---|---|
| Monthly API spend | $79,495 | $29,495 | -63% |
| Annual API spend | $953,940 | $353,940 | -$600,000 |
| Gross margin (API only) | 83.3% | 93.8% | +10.5pp |
| Margin dollars gained | — | $600,000/yr | — |

### Scenario: 5,000-User Enterprise Deal — Before vs After

| Component | Sonnet Only | Multi-Provider + RAG |
|---|---|---|
| Chat API (380K msgs/mo) | $14,442 | $4,800 |
| Agent API (550K docs/mo) | $15,400 | $3,300 |
| RAG infrastructure | $0 | $50 |
| **Total monthly cost** | **$29,842** | **$8,150** |
| Break-even subscription | $40,000/mo | $11,000/mo |
| At $27K/mo sub: margin | -10.5% | **69.8%** |

**Multi-provider routing makes the 5,000-user enterprise deal profitable at the $10,000/mo price point** — which is impossible with Anthropic-only at retail rates.

---

## 10. Vendor Risk Mitigation

### Current Risk Profile

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Anthropic price increase (>20%) | Low | Critical | Multi-provider: instant failover |
| Anthropic rate limit reduction | Medium | High | Bedrock/Vertex as backup endpoints |
| Anthropic service outage (>1hr) | Low | High | Failover to OpenAI within seconds |
| Model quality regression | Low | Medium | Pin model versions, A/B test updates |
| API deprecation (model EOL) | Medium | Medium | Abstraction layer: swap model, not code |

### Multi-Provider Failover Strategy

```
Primary:    Anthropic Direct API
Fallback 1: OpenAI Direct API        (auto-failover on 5xx or timeout)
Fallback 2: AWS Bedrock (Claude)      (auto-failover if direct API is down)
Fallback 3: Google Vertex (Gemini)    (last resort)
```

With the LLM abstraction layer, failover is automatic: if the primary provider returns errors, the orchestrator retries with the next provider. The tool definitions and system prompt are already portable.

---

## 11. Customer-Facing Model Choice

### Why Offer Model Choice

1. **Enterprise customers want control** — "We're an OpenAI shop" or "We're a Google Cloud shop"
2. **On-premise needs vary** — Some have Bedrock, some have Azure, some have on-prem GPU
3. **Cost sensitivity varies** — Starter customers want cheap; Enterprise wants best quality
4. **Regulatory requirements** — Some industries require specific cloud providers

### Proposed Model Configuration

| Setting | Default | Options |
|---|---|---|
| Chat model (complex) | Claude Sonnet 4.5 | Opus 4.6, GPT-4.1, Gemini 2.5 Pro |
| Chat model (simple) | Claude Haiku 4.5 | GPT-4.1 mini, Gemini 2.0 Flash |
| Agent model | Claude Haiku 4.5 | GPT-4.1 nano, Gemini Flash, self-hosted |
| Embedding model | OpenAI small | Voyage-3, Gemini, Nomic (self-hosted) |
| Auto-routing | On | Off (force single model) |

### BYOK (Bring Your Own Key)

Enterprise and on-premise customers provide their own API keys:

| Provider | Customer Provides | Altius Responsibility |
|---|---|---|
| Anthropic | API key | Prompt optimization, tool execution |
| OpenAI | API key | Same |
| Google | Service account JSON | Same |
| AWS Bedrock | IAM role ARN | Same |
| Azure OpenAI | Endpoint + key | Same |
| Self-hosted | Model endpoint URL | Same + model compatibility testing |

**BYOK eliminates API cost from Altius's P&L entirely** — the customer pays their provider directly. License revenue becomes near-pure margin.

---

## 12. Key Takeaways

1. **The LLM abstraction layer is the foundation** — everything else depends on decoupling from the Anthropic SDK. This is a 1-2 week investment that enables all subsequent optimizations.

2. **Anthropic remains the primary provider** — Claude's tool-use quality is best-in-class for agentic workflows. Multi-provider is about cost optimization and risk mitigation, not replacement.

3. **Agent processing is the biggest cost lever** — moving from Sonnet ($0.035/doc) to GPT-4.1 nano ($0.005/doc) is an 86% reduction. For classification-heavy workloads, this is transformative.

4. **RAG with pgvector is free infrastructure** — Altius already runs PostgreSQL. Adding vector search is a schema migration, not a new service. The cost savings ($138K/year at Year 2 scale) justify the 3-4 week investment.

5. **Multi-provider routing saves $600K/year at Year 2 scale** — improving gross margin from 83% to 94%. This is the difference between a good SaaS business and an exceptional one.

6. **The 5,000-user enterprise deal becomes profitable** — multi-provider routing drops the cost from $29,842/mo to $8,150/mo, making the deal viable at $10,000/mo instead of requiring $40,000/mo.

7. **BYOK unlocks near-100% margin on license revenue** — enterprise and on-premise customers who bring their own API keys make the license fee pure profit.

8. **Self-hosted models enable air-gapped deployments** — Llama 3.3 70B via vLLM gives on-premise customers AI capability without any external API dependency, opening government and defense markets.

9. **Start with Phases 1-3 (abstraction + routing + OpenAI)** — these deliver 80% of the value in 4 weeks. RAG and agent optimization in Phases 4-5 capture the remaining 20%.

10. **Vendor risk drops from critical to manageable** — with 3+ providers, no single vendor's pricing or availability decisions can threaten Altius's business model.

---

## Sources

- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — February 2026
- [OpenAI API Pricing](https://openai.com/api/pricing/) — GPT-4.1 family
- [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Pro/Flash
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing) — V3.1 and R1
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — Cloud provider markup
- [pgvector Documentation](https://github.com/pgvector/pgvector) — Vector extension for PostgreSQL
- [Pinecone Pricing](https://www.pinecone.io/pricing/) — Managed vector database
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings) — text-embedding-3 models
- Altius codebase: `web/src/lib/ai-orchestrator.ts`, `packages/core/src/llm/cost.ts`, `packages/core/src/tools/definitions.ts`, `packages/core/src/tools/formats.ts`

---

**Last Updated:** February 8, 2026
**Purpose:** Strategic assessment — AI platform diversification for commercial efficiency
