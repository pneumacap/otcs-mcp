# Altius — Monetization Strategy

> Practical pricing framework for pre-revenue through scale.
> Start with free pilots, validate willingness to pay, then scale.

---

## Your Cost Structure (What It Actually Costs You)

Before pricing, understand your marginal cost per customer:

| Cost Component | Per Customer/Month | Notes |
|---|---|---|
| Anthropic API (Claude Sonnet 4.5) | $20-200 | ~$0.01-0.05 per interaction, depends on usage volume |
| Infrastructure (shared VPS) | $2-10 | Hetzner CX22 at $5.39/mo shared across all customers |
| PostgreSQL storage | $0.50-2 | Grows with usage records, audit logs |
| Stripe fees | 2.9% + $0.30/txn | Only on paid transactions |
| Support time (your time) | $0-500 | Biggest real cost early on |
| **Total marginal cost** | **$25-250/mo** | Varies heavily with usage |

**Key insight**: Your gross margin at any price above ~$300/mo is 75%+. The Anthropic API is the dominant variable cost, and prompt caching keeps it low.

---

## Phase 1: Free Pilots (Where You Are Now)

**Goal**: Get 2-3 customers using the product in production. Validate that it works, collect feedback, build case studies.

**What to offer**:
- Full platform access (all 44 tools, web UI, autonomous agent)
- You handle setup and onboarding (white-glove)
- 90-day pilot period
- No cost to them
- In exchange: weekly feedback calls, permission to use as case study (anonymized if needed), reference customer

**What to measure during pilots**:
- Which tools they actually use (usage tracking is already built)
- How many users per org
- Messages per user per day/week
- Which deployment mode (web UI vs MCP vs agent)
- Time savings on specific workflows (get them to quantify)
- What features they ask for

**Pilot exit criteria** (signals they'd pay):
- Daily active usage by multiple users
- They ask about pricing before you bring it up
- They integrate it into a real workflow (not just testing)
- They request features or customizations

---

## Phase 2: Early Pricing (First Paying Customers)

Once pilots validate product-market fit, introduce pricing. At this stage, keep it simple. One dimension only.

### Recommended: Per-Organization, Tiered by Usage

This is the simplest model that works for your product. Organizations are already your unit of multi-tenancy (orgs, connections, subscriptions are all per-org in your schema).

| | Starter | Professional | Business |
|---|---|---|---|
| **Price** | $299/mo | $799/mo | $1,999/mo |
| **Annual (20% discount)** | $239/mo ($2,868/yr) | $639/mo ($7,668/yr) | $1,599/mo ($19,188/yr) |
| **Users** | Up to 5 | Up to 25 | Up to 100 |
| **AI messages** | 500/mo | 2,500/mo | 10,000/mo |
| **OTCS connections** | 1 | 5 | 25 |
| **Autonomous agent** | -- | 1 agent, 1 folder | Unlimited agents/folders |
| **Tool access** | Core (22 tools) | Full (44 tools) | Full + custom tools |
| **Support** | Email (48hr) | Email (24hr) + onboarding call | Dedicated Slack channel |
| **Data retention** | 30 days | 90 days | 1 year |

---

### Starter — $299/mo

**Who it's for**: A single OTCS administrator, a small team, or a department head who wants to test AI-assisted content management without a big commitment. Typically 1-5 people who interact with Content Server daily.

**What they get and why it matters**:

- **Up to 5 users** — Enough for one department or a small project team. Everyone gets their own login with session-based access. No sharing credentials.

- **500 AI messages/month** — Roughly 25 messages per working day. Enough for an admin who uses Altius for their most repetitive tasks: searching for documents, checking workflow status, browsing folder structures, looking up user permissions. Each message can trigger multiple tool calls (a single "find all contracts expiring in Q1" might call search, browse, and metadata extraction), so 500 messages covers meaningful daily use without unlimited consumption.

- **1 OTCS connection** — Connects to one Content Server instance. Most small teams only have one. The connection is encrypted (AES-256-GCM) and stored per-org, so credentials never leave the platform.

- **Core tools (22 of 44)** — Covers the fundamentals that 80% of users need daily:
  - Navigation: browse folders, get node details, search
  - Documents: upload, download, view versions, extract text
  - Folders: create, organize
  - Workflows: view tasks, check status
  - Members: look up users, check group memberships
  - Sharing: share documents with colleagues

  What's excluded: advanced workflow automation (start/manage/reassign), business workspace operations, records management (classification, holds, cross-references), and permission management. These are power-user features that justify the upgrade.

- **Email support (48hr response)** — You answer their questions within two business days. At this tier, you're not providing hand-holding. The product should be self-service enough that most users don't need support.

- **30-day data retention** — Chat history, usage records, and audit logs are retained for 30 days. After that, they're purged. This is fine for casual use but creates a natural reason to upgrade if they want longer records for compliance or review.

**Value to customer**: An OTCS admin who spends 2 hours/day on repetitive tasks (searching, browsing, checking workflows) can reclaim 60-80% of that time. At a fully-loaded cost of $50-75/hr, that's $2,000-3,000/month in recovered productivity — a 7-10x return on a $299 investment. The department head who approves this sees immediate, measurable time savings on their team's most tedious work.

**Your margin**: ~$50-150/mo after Anthropic API costs. Thin, but the goal is adoption. Starter customers who see value become Professional customers within 3-6 months as usage grows and they hit limits.

---

### Professional — $799/mo

**Who it's for**: A business unit or department that has adopted Altius beyond the initial test. Multiple people rely on it daily. They've hit the Starter limits (5 users, 500 messages, 1 connection) and need more. This is also the right entry point for a mid-size company doing a serious evaluation.

**What they get and why it matters**:

- **Up to 25 users** — An entire department: the records team, the legal group, the contract management office. Broad access means Altius becomes the default way people interact with Content Server, not a tool that one person uses.

- **2,500 AI messages/month** — Roughly 125 per working day across all users. At 25 users, that's 5 messages per person per day — enough for regular use without rationing. Heavy users (power admins, paralegals doing discovery) can use more while casual users use less.

- **5 OTCS connections** — Connect to multiple Content Server instances. This matters for organizations that have separate OTCS environments for different departments, regions, or purposes (e.g., production vs. archive, legal vs. engineering). Each connection has its own credentials, independently encrypted.

- **Full tools (all 44)** — Everything in Core, plus the features that drive serious operational value:
  - **Workflow automation** (16 tools): Start workflows, approve/reject tasks, reassign work, check workflow maps, manage attachments. This turns Altius from a search tool into a workflow engine. Instead of logging into OTCS, navigating to the workflow manager, finding the right task, and clicking through forms, a user says "approve all invoices under $500 from the AP queue" and it's done.
  - **Business workspaces** (15 tools): Create workspaces from templates, manage workspace metadata, search across workspace types. Critical for organizations that use business workspaces as their organizing principle (project workspaces, case workspaces, deal rooms).
  - **Categories and metadata** (5 tools): Read and write category values, manage metadata templates. Enables bulk metadata operations that would take hours in the OTCS UI.
  - **Permissions** (8 tools): View and modify ACLs, check access rights. Essential for admins managing security.
  - **Records Management** (44 tools include RM classification, holds, cross-references, RSI): For organizations with compliance requirements — apply retention schedules, manage legal holds, classify records. This alone can replace a dedicated records management analyst.

- **1 autonomous agent, 1 folder** — The autonomous agent monitors one OTCS folder and processes new documents automatically. This is the first taste of "Altius works while you sleep." Example: monitor the incoming invoices folder, classify each invoice by vendor/amount/date, route high-value invoices to the manager's workflow queue. At ~$0.01-0.03 per document, processing 100 invoices/day costs $1-3/day.

- **Email support (24hr) + onboarding call** — Faster response time, plus a 1-hour onboarding call where you help them configure connections, set up the agent, and train key users. This call is the most valuable thing you offer at this tier — it's where you learn what they actually need and set them up for success.

- **90-day data retention** — Three months of chat history, usage data, and audit logs. Enough for quarterly reviews and short-term compliance needs.

**Value to customer**: A 25-person team using full workflow automation can eliminate 200-500 hours/month of manual OTCS interactions. At $50/hr, that's $10,000-25,000/month in labor value — a 12-31x return. The autonomous agent adds passive value: documents processed overnight, holds applied automatically, contracts classified without human intervention. The manager who buys this tier sees their team's OTCS-related workload drop by 40-60%, freeing people for higher-value work.

**Your margin**: ~$500-700/mo. This is the tier where the business model works. Most customers should land here. The jump from $299 to $799 is justified by 5x the users, 5x the messages, full tools, and the autonomous agent — each of which delivers measurable, additional value.

---

### Business — $1,999/mo

**Who it's for**: An organization deploying Altius across multiple departments. They have dozens of active users, multiple OTCS environments, and want to automate at scale. This is typically a company where Content Server is a core business system — not just a file share, but the system of record for contracts, cases, projects, or compliance.

**What they get and why it matters**:

- **Up to 100 users** — Organization-wide deployment. Legal, procurement, HR, engineering, compliance — everyone who touches Content Server. At this scale, Altius becomes infrastructure, not a tool. It changes how the organization interacts with its content.

- **10,000 AI messages/month** — 500 per working day. At 100 users, that's 5 per person per day on average, with headroom for power users. This volume supports not just interactive chat but also automated workflows, batch operations, and reporting queries.

- **25 OTCS connections** — Connect every Content Server instance in the organization. Development, staging, production, regional instances, archive servers. Each with independent credentials, encryption, and TLS configuration. This is essential for organizations with complex OTCS infrastructure.

- **Unlimited autonomous agents and folders** — This is the major unlock. Instead of one agent watching one folder, the customer can deploy dozens of agents across their entire content ecosystem:
  - Agent 1: Monitor incoming contracts folder, classify by type and risk, route to appropriate department
  - Agent 2: Watch litigation holds folder, ensure every flagged document has the correct hold applied
  - Agent 3: Scan the invoice inbox, extract vendor/amount/PO, match against purchase orders, flag discrepancies
  - Agent 4: Monitor the HR onboarding workspace, ensure all required documents are present and correctly categorized
  - Agent 5: Watch the compliance review queue, classify documents against retention schedules

  Each agent runs continuously at ~$0.01-0.03 per document. Processing 1,000 documents/day across all agents costs $10-30/day ($300-900/mo) — a fraction of the subscription price, and a fraction of the labor it replaces.

- **Full + custom tools** — All 44 standard tools, plus the ability to request custom tool profiles. If the customer has a unique OTCS customization (custom REST API endpoints, specific workflow maps, non-standard metadata schemas), you can build custom tools that integrate with their specific setup. This is a differentiation point and a services opportunity.

- **Dedicated Slack channel** — Direct access to you (and eventually your team) via a shared Slack channel. Questions answered in hours, not days. Issues escalated immediately. This builds the relationship and gives you real-time insight into how they use the product.

- **1-year data retention** — Twelve months of complete history: every chat, every tool call, every usage record, every audit event. Supports annual compliance reviews, trend analysis, and organizational reporting. The customer can see exactly how much value Altius has delivered over the past year when it's time to renew.

**Value to customer**: At 100 users with unlimited agents, this tier delivers organization-wide transformation. Manual OTCS work drops by 50-70% across all departments. Autonomous agents process thousands of documents daily without human intervention. Compliance gaps (missed holds, unclassified records, expired retention) are caught automatically instead of during audits. Conservative estimate: $150,000-400,000/year in labor savings and risk reduction — a 6-17x return on $24,000/year. The executive who approves this sees measurable headcount efficiency, reduced compliance risk, and a platform that makes their multi-million-dollar OTCS investment actually deliver on its original promise.

**Your margin**: ~$1,200-1,700/mo. Strong unit economics. At 20 Business-tier customers, you're at $480K ARR with ~$300K gross margin — enough to hire your first team members.

### Alternative: Per-User Pricing

| | Per User | Notes |
|---|---|---|
| **Price** | $49/user/mo | All features included |
| **Minimum** | 5 users ($245/mo) | |
| **Volume discount** | $39/user at 25+ | |
| **Volume discount** | $29/user at 100+ | |
| **Annual discount** | 20% off | |

**How it works**: Every person who uses Altius needs a named seat. All seats get the same features (all 44 tools, autonomous agent access, full functionality). Price decreases at volume tiers to encourage larger deployments.

**Value to customer**: Simple and predictable. The customer knows exactly what they'll pay. Every user gets full access — no feature gates, no message limits. A team of 10 pays $490/mo and gets everything. A department of 50 pays $1,950/mo ($39/user). An organization of 200 pays $5,800/mo ($29/user). The volume discounts reward growth and make organization-wide deployment attractive.

**When this model works best**: When your customers have clearly defined user groups who interact with OTCS daily and would each get distinct value from Altius. It's the standard model in enterprise SaaS (Salesforce, Microsoft 365, etc.), so procurement teams understand it immediately.

**Pros**: Easy to understand, scales linearly, standard enterprise model, predictable revenue per customer.

**Cons**: Customers limit seats to save money (5 people share 2 logins, reducing adoption). Light users feel overcharged ($49/mo for someone who uses Altius twice a week feels expensive). Creates internal friction ("do I really need an Altius license?"). Penalizes organizations that want broad, casual access.

**Recommendation**: Avoid per-user pricing in your early stage. You want maximum adoption, and seat-counting works against that. Per-org pricing lets the customer add users freely, which drives usage, which drives value, which drives retention. Consider per-user only if enterprise buyers demand it (some procurement processes require per-seat pricing for budget allocation).

---

### Alternative: Usage-Based (Consumption)

| Component | Price | Notes |
|---|---|---|
| Platform fee | $99/mo | Base access, includes 100 messages |
| AI messages | $0.25/message | After included 100 |
| Agent documents | $0.10/document | Per document processed by autonomous agent |
| API calls (MCP) | $0.05/call | For developer/MCP integrations |

**How it works**: Customers pay a low base fee for access, then pay per unit of consumption. Every AI chat message, every document processed by an agent, and every MCP tool call is metered and billed. Usage data is already captured in your `usageRecords` table — this model just turns that data into invoices.

**Value to customer**: Zero risk. They pay only for what they use. A light month costs $99 + a few dollars. A heavy month costs $99 + hundreds. This is attractive to customers who are nervous about committing to a subscription before they know how much they'll use the product. It also naturally aligns your revenue with their value: the more they use Altius, the more value they get, and the more they pay.

**Example customer months**:
- Light month: 100 messages (included) + 50 agent docs = $99 + $5 = **$104**
- Normal month: 500 messages + 200 agent docs = $99 + $100 + $20 = **$219**
- Heavy month: 2,000 messages + 1,000 agent docs + 500 MCP calls = $99 + $475 + $100 + $25 = **$699**
- Power month: 5,000 messages + 5,000 agent docs = $99 + $1,225 + $500 = **$1,824**

**When this model works best**: For developer-focused customers (MCP server users), for customers with highly variable workloads (a law firm that processes 5x normal volume during a litigation surge), and as a low-friction entry point where the customer isn't ready to commit to a subscription.

**Pros**: Lowest possible barrier to entry. Perfectly fair — pay for value received. Scales naturally. Customers never feel like they're overpaying. Great for customers with spiky usage patterns.

**Cons**: Unpredictable revenue makes forecasting hard. Customers may self-limit usage to control costs ("I'll search manually instead of using Altius to save $0.25"). You bear the burden of metering, invoicing, and explaining bills. Some enterprise buyers hate consumption pricing because they can't budget for it.

**Recommendation**: Offer usage-based as a secondary option alongside tiered subscriptions. It works well as a "pay as you go" tier below Starter — a way for small teams or individual developers to use Altius without a $299/mo commitment. It also works as an overage mechanism within tiers: "Professional includes 2,500 messages; additional messages are $0.15 each." This hybrid approach gives customers the predictability of a subscription with the flexibility of consumption.

---

## Phase 3: Enterprise (When You Have Traction)

Once you have 10-20 paying customers and proven ROI data, introduce enterprise pricing.

### Enterprise SaaS (Hosted) — $4,999-9,999/mo

| | Enterprise | Enterprise Plus |
|---|---|---|
| **Price** | $4,999/mo | $9,999/mo |
| **Annual contract** | Required | Required |
| **Users** | Unlimited | Unlimited |
| **AI messages** | 50,000/mo | Unlimited |
| **OTCS connections** | Unlimited | Unlimited |
| **Autonomous agents** | Unlimited | Unlimited |
| **SSO / SAML** | Yes | Yes |
| **Custom tool profiles** | Yes | Yes |
| **SLA** | 99.5% uptime | 99.9% uptime |
| **Support** | Dedicated CSM | Dedicated CSM + engineering escalation |
| **Audit log export** | Yes | Yes |
| **Implementation** | Included (40hrs) | Included (80hrs) |
| **Training** | 2 sessions | Unlimited |

**Who it's for**: Large enterprises (500+ OTCS users) where Content Server is a mission-critical system. These are organizations with dedicated OTCS teams, complex workflow configurations, multiple business workspace types, and compliance requirements (legal holds, records retention, audit trails). They've typically invested $5-40M in their OTCS ecosystem over 10+ years and need to extract more value from that investment without a costly migration or upgrade.

**What they get and why each item matters**:

- **Unlimited users** — No seat-counting. The customer deploys Altius to every person who touches Content Server. This eliminates the internal politics of "who gets a license" and maximizes adoption. When adoption is organization-wide, the value compounds: the legal team classifies documents that the compliance team monitors that the records team retains. Altius becomes connective tissue between departments that previously worked in silos within the same OTCS instance.

- **50,000-Unlimited AI messages** — Enterprise scale. 50,000 messages/month is ~2,500/day — enough for hundreds of active users plus automated workflows. Enterprise Plus removes the ceiling entirely, which matters for organizations that deploy heavy automation (thousands of agent-processed documents per day).

- **SSO / SAML** — Mandatory for enterprise procurement. Users sign in with their existing corporate identity (Azure AD, Okta, OneLogin, etc.). No separate passwords. Aligns with their security policies. Without SSO, most enterprise IT teams will block the purchase. With it, the security review becomes straightforward: "It uses our identity provider, sessions are JWT, passwords are never stored."

- **Custom tool profiles** — Not every department needs every tool. Legal needs holds and cross-references but not workspace creation. Finance needs workflow automation but not records management. Custom profiles let you tailor the tool set per department or role, reducing noise and improving the AI's accuracy (fewer irrelevant tools means Claude picks the right one more consistently).

- **SLA (99.5-99.9% uptime)** — A contractual commitment that the service will be available. 99.5% allows ~3.6 hours/month downtime. 99.9% allows ~43 minutes/month. For mission-critical deployments where people depend on Altius to do their jobs, the SLA is a procurement requirement. It also forces you to invest in monitoring and reliability, which benefits all customers.

- **Dedicated CSM (Customer Success Manager)** — A named person (initially you, later a hire) who knows their environment, checks in monthly, monitors their usage trends, and proactively identifies opportunities. The CSM is how you retain enterprise customers and grow accounts. They're also your early warning system: if usage drops, the CSM knows before the renewal conversation.

- **Audit log export** — The ability to export all audit events (who did what, when, with which documents) to their SIEM or compliance system. For regulated industries, this isn't a nice-to-have — it's a hard requirement. Your audit_logs table already captures this data; the export is a feature you'd build to pull it into CSV, JSON, or stream it to a webhook.

- **Included implementation (40-80 hours)** — You set up their environment: configure OTCS connections, build custom agent rules for their specific workflows, create tool profiles for different departments, train key users, and run a pilot within their organization. This isn't just onboarding — it's the engagement that turns a software purchase into an operational transformation. At $200/hr equivalent, this is $8,000-16,000 of value included in the subscription.

- **Training sessions** — Structured training for their teams. Not just "how to use the chat" but "how to think about what Altius can do for your specific workflows." Enterprise Plus gets unlimited sessions, which means you can train every department as they come online, run refresher courses, and train new hires.

**Value to customer**: At enterprise scale, Altius replaces or augments multiple categories of labor: document classification analysts, records management clerks, workflow administrators, search specialists, and compliance monitors. A large organization with 500+ OTCS users typically employs 5-15 people whose primary job is managing Content Server operations. Altius at $60K-120K/year replaces $500K-1.5M/year in operational labor — a 4-12x return. Beyond direct labor savings, the compliance value is significant: automated hold enforcement means zero missed holds during litigation, automated classification means no backlog of unclassified records, and complete audit trails mean faster, cheaper regulatory responses.

**Your margin**: ~$3,500-8,500/mo after API costs. At 10 enterprise customers, you're at $600K-1.2M ARR. This is the tier that makes the business investable.

---

### On-Premise / Self-Hosted License — $75,000-150,000/year

| | Standard License | Enterprise License |
|---|---|---|
| **License fee** | $75,000/year | $150,000/year |
| **Users** | Up to 100 | Unlimited |
| **Includes** | Web UI + MCP server | Web UI + MCP + Agent + Migration |
| **Maintenance (20%)** | $15,000/year | $30,000/year |
| **Updates** | Quarterly releases | Priority releases |
| **Support** | Email + phone (business hours) | 24/7 phone + dedicated engineer |
| **Implementation** | $25,000-50,000 (one-time) | $50,000-100,000 (one-time) |

**Who it's for**: Organizations that cannot use hosted SaaS for regulatory, security, or policy reasons. This includes:
- **Government agencies** with FedRAMP or data sovereignty requirements
- **Healthcare systems** where PHI (Protected Health Information) cannot leave the network
- **Financial institutions** with strict data residency and third-party risk policies
- **Defense and intelligence** with classified or controlled information
- **Any organization** whose security team says "no data can leave our infrastructure"

These buyers are accustomed to six-figure software purchases. They already pay $500K-5M/year for OpenText licenses and maintenance. A $75-150K add-on that makes their existing investment dramatically more productive is an easy approval compared to a $10M migration.

**What they get and why each item matters**:

- **Self-hosted deployment** — Altius runs entirely inside their infrastructure. Your Docker Compose setup (docker-compose.yml + docker-compose.prod.yml + Caddyfile) is the delivery mechanism. They provide a VM or Kubernetes cluster, you provide Docker images. The Altius web UI, PostgreSQL database, and autonomous agents all run on their hardware. Document content never leaves their network.

- **Anthropic API key management** — This is the one external dependency. The AI requires an Anthropic API endpoint. Two options:
  1. **Customer brings their own key**: They sign up for Anthropic directly, control their own usage and billing. You provide the platform, they provide the AI. Best for organizations that want full control.
  2. **You provide a key**: Included in the license. You manage the Anthropic relationship and absorb the API cost (factored into the license price). Simpler for the customer.

  For air-gapped environments (no internet), future support for local models (e.g., Claude on AWS Bedrock in their VPC) would be the path forward.

- **Web UI + MCP server (Standard)** — The full web application (chat, settings, billing disabled, connections, usage tracking) plus the MCP server for Claude Desktop and Cursor integration. This covers interactive use: people asking questions, searching documents, managing workflows through the conversational interface.

- **+ Agent + Migration (Enterprise)** — Adds the autonomous agent (continuous document monitoring, classification, rule-based workflow execution) and the migration toolkit (cross-system content transfer). These are the components that deliver value without human interaction — they run 24/7, processing documents and enforcing policies. The migration toolkit is particularly valuable for organizations consolidating multiple OTCS instances or migrating from legacy systems.

- **Maintenance (20% of license/year)** — Industry-standard maintenance fee. Covers:
  - Software updates (security patches, new features, new tools)
  - Compatibility updates when OTCS releases new versions
  - Bug fixes and performance improvements
  - Access to new AI models as Anthropic releases them

  Without maintenance, the customer runs their current version indefinitely but receives no updates. Most customers maintain because falling behind on updates creates technical debt and security risk.

- **Implementation ($25-100K one-time)** — On-premise deployment is more complex than SaaS. You (or a partner) install and configure the platform on their infrastructure, integrate with their identity provider, configure OTCS connections, set up agents for their specific workflows, run acceptance testing, and train their team. Scoped by complexity: a single OTCS instance with standard workflows is $25K; a multi-instance environment with custom integrations and complex agent rules is $100K.

- **Support** — Standard gets business-hours email and phone. Enterprise gets 24/7 phone with a dedicated engineer who knows their environment. For mission-critical deployments, the dedicated engineer is essential — when something breaks at 2am, they need someone who can diagnose whether the issue is Altius, OTCS, or infrastructure.

**Value to customer**: On-premise customers buy Altius because the alternative is unacceptable. They can't use SaaS (policy prohibits it), they can't build it themselves (would cost $500K-2M and take 12-18 months), and they can't keep doing things manually (compliance risk, operational cost, employee frustration). A $75-150K/year license that automates 50-70% of their Content Server operations, ensures compliance, and runs entirely inside their security perimeter is one of the easiest enterprise software purchases to justify. Compared to their existing OTCS investment ($1-10M), it's a 2-15% add-on that makes the other 85-98% dramatically more effective.

**Your margin**: License revenue is ~90% margin (no infrastructure costs on your side, minimal API costs if they bring their own key). At just 5 on-premise customers, you're at $375K-750K ARR with $330K-675K gross margin. The implementation fees cover your setup costs and then some.

**Delivery model**: Ship Docker images via a private container registry. The customer's ops team runs `docker compose up`. You provide documentation, a deployment guide, and remote support during initial setup. For ongoing updates, push new images to the registry; the customer pulls and restarts at their maintenance window.

---

## Phase 4: Services Revenue

Layer on professional services once you have repeatable delivery. Services are high-margin, deepen the relationship, and create switching costs. They're also how you learn what customers actually need — every implementation teaches you something that improves the product.

### Implementation — $10,000-50,000 (one-time)

**What it is**: End-to-end setup of Altius for a specific customer environment.

**What's included**:
- Environment setup (SaaS configuration or on-premise deployment)
- OTCS connection configuration and testing (including TLS, multi-instance)
- Identity provider integration (SSO/SAML for enterprise, or email/OTDS setup)
- Custom tool profile creation (tailored to their departments and use cases)
- Initial agent configuration (rules, folders, actions for their top 2-3 workflows)
- User training (2-4 sessions, department-specific)
- Go-live support (1-2 weeks of monitoring and troubleshooting)

**Value to customer**: They don't have to figure out how to configure an AI platform. You translate their business processes into Altius configurations. A 3-day implementation by you replaces 3-6 weeks of internal trial-and-error. More importantly, you configure it *correctly* — the right tool profiles, the right agent rules, the right workflows — so they see value immediately instead of abandoning it after a frustrating first week.

**Pricing logic**: $10K for a simple SaaS setup (1 OTCS instance, standard workflows, <25 users). $25K for a mid-size deployment (multiple instances, custom agents, 25-100 users). $50K for enterprise complexity (SSO, multiple departments, custom tools, on-premise).

### Custom Agent Development — $5,000-25,000 (one-time)

**What it is**: You build autonomous agent configurations tailored to their specific document workflows.

**What's included**:
- Discovery: understand their document types, folder structures, business rules, and approval workflows
- Rule design: translate their manual processes into `agent-config.json` declarations
- Testing: run the agent against sample documents, validate classification accuracy, confirm action correctness
- Deployment: install the agent in their environment, configure monitoring
- Documentation: written guide for their team on how the agent works and how to modify rules

**Value to customer**: This is where Altius goes from "useful tool" to "it does my job for me." A custom agent that automatically classifies incoming contracts, applies the correct retention schedule, routes high-value contracts to legal review, and flags risk indicators — that's not a software feature, that's a digital employee. Building it right requires understanding their specific business rules, document taxonomy, and OTCS configuration. They can't do this themselves (they're not AI engineers), and the ROI is immediate: documents that took 10-30 minutes of human attention each are processed in seconds.

**Pricing logic**: $5K for a single-workflow agent (one folder, one document type, 3-5 rules). $15K for a multi-workflow agent (multiple folders, multiple document types, complex conditional logic). $25K for an organization-wide agent suite (5+ agents covering their major document workflows).

### Migration Services — $15,000-75,000 (one-time)

**What it is**: Using the Altius migration toolkit to transfer content between OTCS instances or from other ECM platforms.

**What's included**:
- Discovery: scan source system, map folder structures, document types, metadata schemas, and permissions
- Migration planning: folder mapping, metadata transformation rules, conflict resolution strategy
- Execution: run the migration (documents, versions, metadata, folder structure)
- Verification: post-migration validation (document counts, metadata integrity, permission mapping)
- Reporting: chain-of-custody report documenting what was migrated, what was skipped, and any errors

**Value to customer**: Content migration is one of the most expensive and risky operations in ECM. Manually migrating 100K documents with metadata and permissions typically takes 3-6 months and $200K-500K with a consulting firm. The Altius migration toolkit automates discovery, transfer, and verification, reducing a 6-month project to 2-4 weeks. For organizations consolidating OTCS instances after a merger, upgrading to a new OTCS version, or migrating from a legacy ECM system, this service pays for itself many times over.

**Pricing logic**: $15K for a small migration (<50K documents, simple folder structure). $35K for a mid-size migration (50-500K documents, metadata mapping, permission preservation). $75K for a large or complex migration (500K+ documents, multiple source systems, custom metadata transformation, regulatory chain-of-custody requirements).

### Managed Service — $2,000-5,000/mo (recurring)

**What it is**: You operate and monitor their Altius deployment as a service. They use it; you keep it running.

**What's included**:
- 24/7 monitoring of platform health, agent status, and error rates
- Proactive maintenance (updates, patches, performance optimization)
- Agent rule tuning based on classification accuracy metrics
- Monthly usage reports and ROI analysis
- Incident response (you fix issues before the customer notices them)
- Quarterly business reviews (what's working, what to automate next)

**Value to customer**: Not every organization wants to (or can) manage another platform. Managed service means they get the value of Altius without allocating internal IT resources. This is especially attractive for mid-size companies without dedicated OTCS teams, and for organizations that want to "set it and forget it" — they configure their workflows once, and you ensure everything keeps running.

**Pricing logic**: $2K/mo for a simple SaaS deployment (monitoring, updates, basic support). $3.5K/mo for a deployment with active agents (agent monitoring, rule tuning, error resolution). $5K/mo for an on-premise deployment (remote infrastructure monitoring, update management, dedicated support hours).

**Strategic value to you**: Managed services create the stickiest revenue. Once you're operating their platform, switching costs are enormous. It's also recurring revenue with high margins (~70-80% once you have tooling and processes in place).

### Training — $2,500/session (one-time per session)

**What it is**: Half-day (4-hour) structured training for their teams.

**What's included**:
- Session 1 (typical): "Getting Started" — navigating the web UI, using chat effectively, understanding tool calls, managing connections, reading usage data
- Session 2 (typical): "Power User" — advanced search techniques, workflow automation, batch operations, using MCP with Claude Desktop/Cursor
- Session 3 (typical): "Agent Administration" — configuring autonomous agents, writing rules, monitoring agent output, troubleshooting classification errors
- Session 4 (typical): "Admin and Compliance" — permissions management, records management tools, audit log review, usage optimization

**Value to customer**: Training is the difference between "we bought Altius" and "we use Altius." Untrained users default to their old habits (logging into OTCS directly). Trained users discover workflows they didn't know were possible ("I can just say 'apply hold XYZ to all documents in this folder' and it does it?"). Each training session increases adoption, which increases value, which increases willingness to renew.

**Pricing logic**: $2,500 per half-day session, delivered remotely. On-site delivery: $3,500 (covers travel). Volume discount: 4-session package for $8,000 (save $2,000). Included in Enterprise tier (2 sessions) and Enterprise Plus (unlimited).

---

## The Overlooked Killer Feature: Instant Visual Analytics

One of Altius's most commercially valuable capabilities is barely mentioned in the tool list: **on-demand visual dashboards generated from live enterprise content.** This isn't a pre-built dashboard with fixed queries — it's a conversational BI engine that creates charts and analysis from whatever the user asks, in real time, against their actual Content Server data.

### What It Does

Altius has a built-in charting system (Recharts: bar, line, area, pie) that Claude generates inline during conversation. The AI queries OTCS, analyzes the results, and renders a chart — all in one conversational turn. No configuration. No dashboard builder. No SQL.

**Examples of what a user can say:**

- "Show me a breakdown of document types in the Legal folder" — pie chart of PDFs vs Word vs Excel vs other, generated from a live folder scan
- "Chart the number of contracts expiring each month this year" — bar chart built from metadata extraction across hundreds of contracts
- "What does our workflow backlog look like by department?" — stacked bar chart from live workflow status queries
- "Show invoice totals by vendor for Q4" — bar chart from document content extraction (the AI reads the invoices, extracts amounts, and charts them)
- "Compare document creation volume month over month for the past year" — line chart from search queries with date filters
- "Break down our active legal holds by matter" — pie chart from RM holds queries
- "How many documents were added to each workspace this quarter?" — bar chart from workspace browsing and counting

Each of these would traditionally require:
1. An analyst to write the query or report specification
2. A BI admin to build the visualization
3. A data pipeline to extract from OTCS into a reporting database
4. Review cycles, revisions, and maintenance

**With Altius, the user types a question and gets a chart in seconds.**

### Why This Is Commercially Significant

**It replaces traditional analytics platforms for OTCS reporting.** Most organizations that need content analytics either:
- Pay $70-150/user/month for analytics platforms, plus $100-300K for implementation and connectors to OTCS
- Build custom reports with OTCS's built-in reporting (limited, ugly, slow)
- Export data to Excel and build charts manually (common, painful, error-prone)
- Hire a reporting analyst or BI team ($80-150K/year per person)

Altius eliminates all of these for OTCS-related reporting. A compliance officer who needs a hold coverage report doesn't submit a ticket to IT and wait two weeks — they ask Altius and get it now. A department head who wants to know how many contracts their team processed this quarter doesn't schedule a meeting with the BI team — they ask Altius during their morning coffee.

**The analysis is the real value, not just the chart.** Claude doesn't just plot data — it interprets it. "Chart contracts expiring this quarter" returns the chart PLUS commentary: "You have 47 contracts expiring in Q1. 12 are high-value (>$100K) and 3 have auto-renewal clauses that trigger in the next 14 days. Here are the 3 that need immediate attention." That analysis would take a paralegal half a day. Altius does it in 10 seconds.

### How to Position This in Sales

**For department heads and managers**: "Ask any question about your content and get a visual answer instantly. No tickets, no waiting, no BI licensing fees."

**For compliance and legal**: "Generate hold coverage reports, retention compliance dashboards, and classification status charts on demand. Every report is built from live data, not a stale extract."

**For executives**: "Your content management system has been a black box for years. Altius gives you instant visibility into what's in there, who's using it, and where the gaps are — in a chart you can screenshot and paste into a board deck."

**For IT/procurement (justifying the purchase)**: "This replaces the $50K/year analytics platform connector plus the reporting analyst who maintains it. Altius does it conversationally, from live data, with zero maintenance."

### Pricing Implications

The analytics capability significantly strengthens the value proposition at every tier:

| Tier | Analytics Value |
|---|---|
| **Starter** ($299/mo) | Replaces manual Excel reporting. A records clerk who spends 4 hours/week building reports from OTCS exports saves $10K/year. |
| **Professional** ($799/mo) | Replaces a part-time reporting analyst. Department-level dashboards on demand. Saves $30-50K/year vs. BI tooling + labor. |
| **Business** ($1,999/mo) | Replaces org-wide BI infrastructure for content reporting. Autonomous agents can generate and email daily/weekly reports automatically. Saves $75-200K/year vs. analytics platforms + connectors + analysts. |
| **Enterprise** ($4,999+/mo) | Board-ready analytics from live enterprise content. Compliance dashboards, audit-ready reports, cross-department visibility. The kind of capability that was previously a $200K consulting engagement to build. |

This is arguably the single strongest argument for upgrading from Starter to Professional: at $299/mo, you get basic search and retrieval. At $799/mo, you get full analytical capability across all 44 tools — including the ability to read document content, extract structured data, cross-reference across folders, and visualize the results. That jump from "search tool" to "analytical platform" is worth far more than the $500/mo price difference.

---

## Pricing Scenarios: What a Real Customer Looks Like

### Scenario A: Mid-Size Law Firm (50 OTCS users)

**Pain**: Legal discovery takes 3-5 days per matter. 200 matters/year.

| Item | Value |
|---|---|
| Plan | Professional ($799/mo) |
| Users | 15 lawyers + paralegals |
| Primary use | Search, document retrieval, hold management |
| Agent | Monitor litigation folders, auto-classify, apply holds |
| **Annual cost to them** | $9,588 |
| **Time saved** | ~600 days/year (200 matters x 3 days saved) |
| **Labor cost saved** | ~$300,000/year (at $500/day fully loaded) |
| **ROI** | 31x |

### Scenario B: Manufacturing Company (200 OTCS users)

**Pain**: Contract management is manual. 2,000 contracts/year across 8 departments.

| Item | Value |
|---|---|
| Plan | Business ($1,999/mo) |
| Users | 40 across procurement, legal, finance |
| Primary use | Contract search, metadata extraction, workflow automation |
| Agent | Classify new contracts, extract key terms, route for approval |
| **Annual cost to them** | $23,976 |
| **Time saved** | ~4,000 hours/year |
| **Labor cost saved** | ~$200,000/year |
| **ROI** | 8x |

### Scenario C: Government Agency (On-Premise)

**Pain**: Records management compliance. 500K documents, mandatory holds and retention.

| Item | Value |
|---|---|
| License | Enterprise ($150,000/year) |
| Implementation | $75,000 (one-time) |
| Maintenance | $30,000/year |
| Users | 300 |
| Primary use | RM classification, holds, cross-references, compliance reporting |
| Agent | Continuous classification and retention schedule enforcement |
| **Year 1 cost** | $255,000 |
| **Ongoing annual** | $180,000 |
| **Manual equivalent** | 6 FTEs ($600,000/year) |
| **ROI** | 2.3x Year 1, 3.3x ongoing |

### Scenario D: Solo OTCS Admin (Individual)

**Pain**: Spends 60% of time on repetitive OTCS tasks.

| Item | Value |
|---|---|
| Plan | Starter ($299/mo) |
| Users | 1 |
| Primary use | MCP server in Cursor/Claude Desktop for daily admin tasks |
| **Annual cost** | $3,588 |
| **Time saved** | ~15 hours/week |
| **Value of time** | ~$39,000/year (at $50/hr) |
| **ROI** | 11x |

---

## Recommended Go-to-Market Sequence

```
NOW         Free pilots (2-3 customers, 90 days)
            |
            v
MONTH 4     Introduce Starter ($299) + Professional ($799)
            Convert pilots to paid or get referrals
            |
            v
MONTH 8     Add Business tier ($1,999)
            Add autonomous agent as paid feature
            First services engagement
            |
            v
MONTH 12    Enterprise tier ($4,999+)
            On-premise licensing for regulated industries
            Hire first support/CSM
            |
            v
MONTH 18+   Partner channel (OpenText SIs)
            Managed services
            Scale
```

---

## What to Build Next for Monetization

These are the features that unlock pricing tiers and willingness to pay:

| Feature | Unlocks | Priority |
|---|---|---|
| Usage dashboard (per-org) | Metered billing, quota enforcement | Already built |
| SSO / SAML | Enterprise sales requirement | High |
| License key system | On-premise gating | Medium |
| Admin panel (multi-org) | Managed service offering | Medium |
| White-labeling | Partner channel, OEM deals | Low (later) |
| API key management | Developer tier, MCP-as-a-service | Already built (schema exists) |

---

## Competitive Pricing Context

| Competitor/Alternative | Price | What They Offer |
|---|---|---|
| OpenText Aviator | Bundled (est. $50-100/user/mo) | Native AI features, limited, locked to latest version |
| Generic AI assistants (ChatGPT, Copilot) | $20-30/user/mo | No OTCS integration, can't access Content Server |
| Custom development | $200-500K+ one-time | Build from scratch, 6-12 months, ongoing maintenance |
| RPA (UiPath, Automation Anywhere) | $5,000-15,000/robot/yr | Brittle, 30-50% project failure rate, no AI reasoning |
| Altius | $299-9,999/mo | Purpose-built, 44 tools, works today, 75%+ gross margin |

**Your positioning**: More capable than generic AI (deep OTCS integration), cheaper than custom development (ready today), more reliable than RPA (AI reasoning, not brittle scripts), and available now unlike Aviator (which requires OTCS upgrades).

---

## Key Pricing Principles

1. **Price on value, not cost.** Your API costs are $25-250/mo. Your value is $50K-600K/year in labor savings. Price somewhere in between.

2. **Per-org, not per-user (early on).** Removes friction. Let them add users freely. You want adoption, not seat-counting.

3. **Annual contracts with monthly option.** Annual = better retention + cash flow. Monthly = lower barrier to start.

4. **Free tier is a funnel, not a product.** 100 messages/mo is enough to demo, not enough to depend on. Forces upgrade conversation.

5. **Don't discount. Add value.** Instead of cutting price, add implementation hours, training, or extended trial. Protects your pricing integrity.

6. **Pilot-to-paid is the most important conversion.** The 90-day free pilot should end with a clear "here's what you used, here's what it saved you, here's the plan that fits." Have the data ready (your usage tracking already captures this).
