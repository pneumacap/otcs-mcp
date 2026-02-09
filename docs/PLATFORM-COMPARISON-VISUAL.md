# Platform Comparison Visual (Sales Deck Slide)

> One-page visual showing the complexity gap between OpenText's multi-platform approach and Altius's integrated platform.

---

## Slide Layout Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│  GETTING TO AGENTIC AI FOR CONTENT SERVER                           │
│                                                                      │
│  OpenText Path                         Altius Path                  │
│  ━━━━━━━━━━━━━                         ━━━━━━━━━━━━                 │
│                                                                      │
│  ┌─────────────────┐                   ┌────────────────────┐      │
│  │   Aviator       │                   │                    │      │
│  │ (Conversational)│                   │      Altius        │      │
│  └────────┬────────┘                   │                    │      │
│           │ +                           │  • Conversational  │      │
│  ┌────────┴────────┐                   │  • Agentic agents  │      │
│  │ Aviator Studio  │                   │  • Data extraction │      │
│  │ (Workflows)     │                   │  • Classification  │      │
│  └────────┬────────┘                   │  • Orchestration   │      │
│           │ +                           │                    │      │
│  ┌────────┴────────┐                   └────────────────────┘      │
│  │   Knowledge     │                                                │
│  │   Discovery     │                   Timeline: Days to weeks      │
│  │ (Extract/Class) │                   Cost: $12K-108K/year         │
│  └────────┬────────┘                   Integration: None needed    │
│           │ +                                                        │
│  ┌────────┴────────┐                                                │
│  │  AI Data Plat   │                                                │
│  │ (Orchestration) │                                                │
│  │ Ships EOY 2026  │                                                │
│  └─────────────────┘                                                │
│                                                                      │
│  Timeline: 12-18 months                                             │
│  Cost: $500K-2M+ (licenses + PS)                                    │
│  Integration: High complexity                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Talking Points for This Slide

### OpenText Path (Left Side):

**Platforms Required:**
1. **Aviator** — Base conversational AI (requires Business Workspaces)
2. **Aviator Studio** — Workflow automation layer (separate SKU, professional services)
3. **Knowledge Discovery** — Data extraction and classification (separate SKU, professional services)
4. **AI Data Platform** — AI orchestration (under development, ships ~EOY 2026)

**Total Package:**
- Timeline: 12-18 months from start to full deployment
- Cost: $500K-2M+ (4 platform licenses + integration services)
- Complexity: Multi-vendor coordination, separate upgrade cycles, integration dependencies
- Risk: Roadmap-dependent (AI Data Platform still in development)

### Altius Path (Right Side):

**Single Integrated Platform:**
- Conversational AI (like Aviator)
- Agentic automation (like Aviator Studio)
- Data extraction (like Knowledge Discovery)
- Classification rules (like Knowledge Discovery)
- AI orchestration (like AI Data Platform)

**Total Package:**
- Timeline: Days to weeks
- Cost: $12K-108K/year (no additional integration services)
- Complexity: None — single platform, single vendor
- Risk: Low — shipping today, proven with customers

### The Value Prop:

> "Same agentic capabilities, 10x faster deployment, 1/10th the cost. Start automating workflows next week instead of waiting 18 months."

---

## Additional Slides for Deep-Dive Conversations

### Slide 2: "Why OpenText Chose a Multi-Platform Strategy"

**Their rationale (speculated, but fair):**
- **Best-of-breed approach:** Each platform optimized for specific use cases
- **Enterprise-grade:** Separate platforms allow specialized teams and support
- **Upsell path:** Customers start with Aviator, expand to Studio/KD/AI Platform over time
- **Market segmentation:** Different products for different buyer personas

**Trade-offs:**
- Longer time-to-value (12-18 months vs. weeks)
- Higher total cost of ownership ($500K-2M vs. $12-108K/year)
- Integration complexity (4 platforms vs. 1)
- Roadmap dependency (AI Data Platform ships EOY 2026)

**This isn't wrong — it's a classic enterprise strategy. But it's slow and expensive.**

---

### Slide 3: "Altius Chose an Integrated Platform Strategy"

**Our rationale:**
- **Time to value:** Customers need AI today, not in 18 months
- **Simplicity:** One platform, one login, one support contact, one bill
- **Cost efficiency:** $12-108K/year vs. $500K-2M+ for comparable capabilities
- **Agility:** Faster iteration, tighter feedback loops, rapid feature development

**Trade-offs:**
- Not as deep in any one area as a specialized platform (yet)
- Smaller team (for now) supporting the entire stack
- Less established brand than OpenText

**But for most OTCS customers, 80% of the capability at 10% of the cost is the obvious choice.**

---

### Slide 4: "When Each Approach Makes Sense"

| Choose OpenText AI Stack If: | Choose Altius If: |
|---|---|
| You're already on latest OTCS (23.4+) | You're on OTCS 16.x-23.x |
| You use Business Workspaces extensively | You use classic/virtual folders |
| Budget > $1M for multi-year AI project | Budget < $150K for first-year AI deployment |
| Timeline: can wait 12-18 months | Timeline: need value in weeks |
| You want best-of-breed enterprise suite | You want integrated SaaS platform |
| You have dedicated AI platform team | You want turn-key solution |
| Multi-vendor relationships are fine | You prefer single-vendor simplicity |

**Most OTCS customers fall into the Altius column.**

---

## Marketing Taglines

**For website/landing page:**
> "One platform. One deployment. Agentic AI for Content Server — without the enterprise complexity."

**For sales conversations:**
> "OpenText's full AI stack is Aviator + Studio + Knowledge Discovery + AI Data Platform. That's 4 platforms, 12-18 months, $500K-2M+. Altius delivers comparable agentic capabilities in one platform, deployed in weeks, at $12-108K/year."

**For objection handling:**
> "Yes, OpenText will eventually integrate their AI platforms. That's 18-24 months away and costs $500K-2M. Every month you wait is another month of manual processing. Start with Altius today, and if OpenText's integrated suite becomes a better fit in 2027, migrate then. You'll have saved 18 months of productivity."

**For partner channel:**
> "Recommend Altius to customers who can't wait for the AI Data Platform, don't use Business Workspaces, or have budgets under $200K. You protect the OTCS maintenance base and expand your services revenue. Win-win."

---

## Competitive Grid (Simple 2x2)

```
                    High Integration Complexity
                              │
                              │
      OpenText AI Stack       │
         (4 platforms)        │      Custom Development
      • $500K-2M+             │      • $200K-500K+
      • 12-18 months          │      • 6-12 months
                              │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┼━━━━━━━━━━━━━━━━━━━━━━━━━━━ High Cost
                              │
                              │
         Altius               │     Generic AI
      • $12-108K/year         │     (ChatGPT/Copilot)
      • Days to weeks         │     • No OTCS integration
                              │
                    Low Integration Complexity
```

**Altius positioning:** Low complexity + reasonable cost = obvious choice for most customers

---

## Sales Deck Flow Recommendation

1. **Problem Slide:** "Manual OTCS tasks consume 40-60% of your team's time"
2. **Solution Slide:** "Agentic AI automates workflows — not just chat"
3. **Demo Slide:** "Watch an agent process 50 invoices in 5 minutes"
4. **Platform Comparison Slide:** (This document) "One platform vs. four"
5. **ROI Slide:** "How much could you save with Altius?"
6. **Timeline Slide:** "Start next week, see ROI in 30 days"
7. **Pricing Slide:** "$12K-108K/year — not $500K-2M"
8. **Next Steps Slide:** "90-day pilot, white-glove onboarding, no commitment"

---

**Last Updated:** February 8, 2026  
**Purpose:** Sales enablement — visual comparison for competitive differentiation
