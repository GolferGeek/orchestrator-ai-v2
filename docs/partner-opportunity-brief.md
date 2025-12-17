# Orchestrator AI — Partner Opportunity Brief (V2 → V3)

**Status:** Working codebase, **not yet security-audited**. Hardening is the first priority as additional engineering capacity comes online.

**Audience:** Leaders and technical leaders who can help us fund, harden, and scale Orchestrator AI (finance/investor relations, program leadership, marketing leadership, security/reliability/platform engineering leadership).

---

## High-level summary (for leader/technical leader conversations)

Orchestrator AI is a self-hostable agent platform: a web UI + API that runs agent workflows, streams progress back to users, and provides governance features (authentication, org context, observability, and safety controls). The goal is a **turnkey, inside-the-firewall** deployment model.

**What’s live today (V2 focus):** one initial vertical—**Marketing**—with a “Marketing Swarm” workflow that coordinates **writers, editors, and evaluators** to produce and rank content outputs.

**Key architectural principle:** the **API is the governed execution layer** (A2A-compatible transport patterns, PII handling, observability, auth/org context). Customers can build agents/workflows in **whatever framework they prefer** and expose them behind stable contracts using **runners/adapters** (today: **n8n** workflows and **LangGraph** services).

**Local model support (inside the firewall):** the platform is designed to support **local LLM execution** so organizations can run workflows against proprietary/internal materials without sending data to a third-party SaaS by default. Where appropriate, workflows can also call out to external providers—but it’s a deliberate choice, not a requirement.

**Where we’re going (V3):** an “orchestrator agent” that can discover available agents/tools and compose them ad hoc, plus internal “engineering agents” dedicated to **finding, reporting, logging, and fixing** system issues as part of hardening and ongoing reliability work.

**Why this is a partner opportunity (plainly):**
- Help shape a platform that treats multi-agent workflows as a governed, observable system—not a pile of scripts.
- V2 is intentionally narrow (Marketing) so leaders can validate value quickly and influence direction.
- Leaders can participate in both **workflow validation** (does it help teams) and **hardening** (does it hold up under real use).

**Why talk now:** we’re looking for leadership help to turn a working codebase into an operationally solid product: hardening first, then scaling delivery and go-to-market.

---

## Detailed breakdown (for leaders)

### What we are looking for right now (company-building needs)

We’re separating **sales opportunities** from **leadership help**. This brief is primarily aimed at the latter.

**Sales opportunities (go-to-market focus):**
1) **SMB / mid-market buyers**: inside-the-firewall, turnkey deployments for teams with sensitive data and clear workflow needs.
2) **Consultancies/MSPs**: deliver Orchestrator AI as an offering to their clients (implementation + support).

**Leadership help (what we want to recruit/partner with right now):**
3) **Scale leaders (people + capital)**: finance/investor relations, program leadership, marketing leadership, and technical leadership.

**Current capability coverage:** we already have infrastructure/hardware support for inside-the-firewall deployments.

**Gaps we need to fill:**
- **Finance / investor relations**: fundraising strategy, investor outreach, diligence materials, term negotiation
- **Program management**: hardening plan execution, roadmap coordination, delivery discipline
- **Marketing leadership**: positioning, narrative, go-to-market, early pipeline
- **Engineering hires**: security + reliability hardening, plus workflow expansion

### Funding and hiring intent (what investment is for)

We are seeking funding primarily to:
- **Harden the codebase** (security review + remediation, reliability, testing, and operational readiness)
- **Hire quickly**: technical developers (security/reliability + product), and a high-level marketing lead
- **Recover initial founder investment** (to make continued execution sustainable)

### What exists and is working today

- **Two applications in a monorepo**
  - **API**: NestJS (TypeScript)
  - **Web UI**: Vue 3 + Ionic
- **A2A-style execution flow**
  - Agent runs are initiated through a consistent “task” execution pattern (conversation/task tracking, streaming progress, deliverables).
- **Framework-agnostic agent/workflow execution**
  - The API wraps external workflows/agents (e.g., **n8n**, **LangGraph services**) as runnable “agents” via API runner/adapters.
  - This keeps the platform from forcing one agent framework while still enforcing centralized governance (PII, observability, auth/org boundaries).
- **Governance and visibility primitives**
  - Authenticated access, organization context, and system observability are first-class concerns.
  - PII handling is built into the platform directionally (redaction/pseudonymization capabilities exist in the codebase).

### What has been important in the last couple of weeks (signals of current focus)

- Improving **observability** and event history retrieval
- Expanding **evaluation / review** mechanics and human-in-the-loop (HITL) UX patterns
- Strengthening **org + RBAC** administration flows
- Adding/expanding **provider support** (including local/edge-oriented execution paths)
- Integrating the initial **MarketingModule** and the Marketing Swarm configuration surface

### V2: marketing as the first vertical

V2 is intentionally focused on **one vertical** to prove end-to-end value and iterate quickly.

**Marketing Swarm** (currently being built out):
- **Configurable content types** (e.g., blog post, social post) with a “system context” to guide generation.
- **Agent roles**:
  - **Writers** generate drafts
  - **Editors** iterate on drafts (multiple edit cycles)
  - **Evaluators** score outputs and support ranking
- **Structured execution model** with a persistent audit trail:
  - Tasks, queue steps, outputs, evaluations, and progress tracking are stored in Postgres.

### What’s next in the marketing vertical (near-term roadmap)

These are the next workflow capabilities we’re actively aiming for in V2 (not all are complete today):
- **More content types** (blog posts, LinkedIn/X variants, etc.)
- **Asset generation workflows**
  - Google Images, Google video, infographic builder
  - OpenAI images and video
- **Workflow idea generator** (user inputs their vertical; system proposes workflow automations)
- **Research → downstream workflows**
  - Research agent
  - Research-to-voice
  - Research-to-email
  - Prompt-to-X and prompt-to-LinkedIn pipelines

### V3: orchestrator agent + codebase hardening

- **Orchestrator agent**: discovery + dynamic composition of agents/tools.
- **Engineering agents**: dedicated workflows that continuously:
  - find issues (behavioral, reliability, security)
  - produce structured reports
  - log and track them
  - assist in remediation and verification

### Reality check: the code works, but it is not “enterprise-hardened” yet

We want leaders to understand the current maturity level clearly:
- The platform is functional and already supports meaningful workflows.
- It has **not** undergone a full security review or sustained production hardening cycle.
- The immediate priority with partner support is a structured hardening program (security + operational reliability).

### What we’re looking for help with (leaders and technical leaders)

- **Finance / fundraising leadership**
  - People who can help with investor outreach, fundraising process, and packaging the story in a credible way.
- **Program leadership**
  - People who can run a hardening + delivery program across engineering, infrastructure, and early customers.
- **Marketing leadership**
  - People who can own positioning and initial go-to-market execution.
- **Technical leadership (security/reliability/platform)**
  - People who can lead hardening work: security review/remediation, reliability, testing, deployment/runbooks, and operational readiness.

### What “success” looks like (near-term)

- A clear, funded plan for a hardening-first cycle:
  - repeatable deployment/runbook
  - a prioritized hardening backlog with owners and timelines
  - measurable improvements in reliability/security posture and workflow outcomes

---

## Technical breakdown (for technical evaluators)

### Current architecture (as implemented)

**Web UI (Vue/Ionic)**
- Provides an agent catalog experience and specialized UIs where needed.
- The Marketing Swarm has a dedicated page and flow that:
  - fetches configuration from the API
  - creates/uses a conversation context
  - starts a swarm run through the same A2A task mechanism used by other agent runs

**API (NestJS)**
- Hosts authenticated endpoints and platform services.
- Provides the governed layer for:
  - A2A-compatible task execution and transport patterns
  - PII safety controls (redaction/pseudonymization directionally)
  - Observability and progress streaming for long-running workflows
  - Organization context and access boundaries
- Marketing module provides **read-only configuration endpoints** for the swarm UI:
  - `GET /marketing/config`
  - `GET /marketing/content-types`
  - `GET /marketing/agents` (with role filtering and optional embedded LLM configs)
  - `GET /marketing/llm-configs`

**Runners / adapters (framework-agnostic)**
- Workflows and agents may live outside the API (tangential services) and are treated as callable remote capabilities.
- Today, that includes:
  - **n8n** workflows (automation/workflow engine)
  - **LangGraph** services (multi-step agentic workflows, including the Marketing Swarm backend)
- The API “wraps” these behind consistent execution + observability patterns so the UI and governance model stay stable even as underlying frameworks change.

**Marketing data model (Postgres / Supabase)**
- Implemented as a dedicated `marketing` schema with tables for:
  - `content_types`: content templates and system context
  - `agents`: writer/editor/evaluator personalities
  - `agent_llm_configs`: many-to-many “personality × model” combinations
  - `swarm_tasks`: one execution record per swarm run
  - `execution_queue`: step-by-step planned execution and audit trail
  - `outputs`: drafts and revisions (writer/editor attribution)
  - `evaluations`: evaluator scores and reasoning

This supports:
- **repeatable runs**
- **side-by-side comparison** of personality/model combinations
- **reconnection** (rebuild UI state from DB)

### How Marketing Swarm execution is wired today

- The swarm is registered as an **API agent** (`marketing-swarm`) with a configured HTTP endpoint.
- The UI initiates runs through the platform’s task execution flow, passing a structured request payload containing:
  - `contentTypeSlug`
  - `promptData` (interview answers)
  - `config` (selected agents + LLM config IDs per role)
- Status/state endpoints for the underlying swarm workflow are expected on a dedicated service endpoint (LangGraph service) and are used for:
  - `status/{taskId}` polling
  - `state/{taskId}` reconnection/state hydration

### Observability and traceability

- Agent runs are designed to stream progress events back to the UI (SSE-style progress messages).
- The platform includes broader observability services/modules intended for both user-facing progress and administrative visibility.

### Security posture (current and planned)

**Current:**
- Authenticated access patterns exist (JWT guard is used on marketing configuration endpoints).
- Organization scoping is present in the database layer (RLS policies in the `marketing` schema).

**Planned hardening (first priority):**
- Threat modeling and security review of:
  - authn/authz boundaries
  - org isolation and RLS correctness
  - data retention policies and audit logs
  - secrets management and key handling
- Reliability work:
  - better failure modes and error surfacing
  - resource/queue management for long-running runs
  - regression testing around core workflow execution

### What technical leaders can evaluate quickly

- **Execution flow correctness**: conversations/tasks → agent runner → streaming progress → deliverables
- **Vertical workflow depth**: marketing swarm execution model and data audit trail
- **Operational fit**: deployment assumptions, observability, and maintenance model
- **Security fit**: how org isolation, authentication, and PII handling are implemented and what needs to be hardened

---

## Suggested starting points

- **2–4 week pilot** (marketing vertical; optional but useful)
  - Validate content workflows, iteration loops, and ranking/evaluation.
  - Produce a shared backlog for product and hardening priorities.

- **Security + reliability sprint**
  - Focused audit + remediation plan and high-impact fixes.

- **Consultancy/MSP enablement** (sales opportunity channel)
  - Define a deploy/runbook and a repeatable “first customer” implementation.

- **Fundraising support (leader/advisor)**
  - Tighten the investment narrative, build an investor target list, and run outreach.
  - Establish a hiring plan and budget tied directly to the hardening roadmap.

---

## Notes / caveats

- This brief is intentionally factual and reflects the system as it exists today, plus a near-term roadmap.
- We will not represent the platform as security-audited until it has been through a formal review.
