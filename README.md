# Orchestrator AI

[![License: Polyform Noncommercial](https://img.shields.io/badge/License-Polyform%20Noncommercial-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.0+-4FC08D.svg)](https://vuejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-Latest-E0234E.svg)](https://nestjs.com/)

**A self-hostable, inside-the-firewall AI agent orchestration platform designed for enterprise security and governance.**

Orchestrator AI provides a comprehensive framework for building, deploying, and managing autonomous AI agents with enterprise-grade security, governance, and observability. The platform is designed for **inside-the-firewall deployment** with strong emphasis on **local LLM execution**, **PII protection**, and **framework-agnostic agent development**.

---

## ⚠️ Important: Enterprise Setup Required

**This platform was designed for enterprise/customer deployments, not quick-start installations.**

Orchestrator AI requires significant setup and configuration work:

- **Database Configuration**: Proper Supabase/PostgreSQL setup with migrations, RLS policies, and organization isolation
- **Authentication Setup**: User management, JWT configuration, and organization context
- **LLM Provider Configuration**: Explicit model selection and provider setup (no defaults or fallbacks)
- **Security Hardening**: PII dictionaries, RBAC configuration, and access controls
- **Infrastructure**: Self-hosted deployment with proper networking, monitoring, and observability

**This is not a "download and run" solution.** Expect to invest time in:
- Understanding the architecture and security model
- Configuring your database and authentication
- Setting up your preferred LLM providers (especially local LLMs like Ollama)
- Configuring PII protection and RBAC policies
- Deploying and maintaining the infrastructure

We're working on improving onboarding, but as a newly open-sourced project, comprehensive setup documentation and automation are still being developed.

---

## 🎯 Core Philosophy

### Security-First Architecture

Orchestrator AI is built with **inside-the-firewall security** as a fundamental design principle:

- **Local LLM Support**: Heavy emphasis on local LLM execution (Ollama) to keep sensitive data within your infrastructure
- **PII Pseudonymization**: Built-in dictionary-based pseudonymization with pattern detection to protect personally identifiable information
- **Organization Isolation**: Multi-tenant architecture with strict organization boundaries enforced at the database and API layers
- **No Silent Fallbacks**: Explicit configuration required—no hardcoded defaults that could expose data unexpectedly
- **Self-Hosted RAG**: Complete RAG infrastructure (embeddings, vector search, LLM interpretation) runs entirely within your firewall

### Framework-Agnostic Agent Development

Build agents in **whatever framework you prefer**—we'll wrap them in our governed execution layer:

- **LangGraph Agents**: Create LangGraph workflows as NestJS applications and expose them as API agents
- **N8N Workflows**: Build visual workflows in N8N (local or SaaS) and wrap them as governed agents
- **Future Frameworks**: Designed to support CrewAI, AutoGen, Microsoft AI Foundry, and other emerging frameworks

The platform provides:
- **A2A Protocol**: Agent-to-Agent communication using JSON-RPC 2.0
- **Governed Execution Layer**: PII handling, observability, authentication, and organization context
- **Stable API Contracts**: Consistent execution patterns regardless of underlying framework

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator AI Platform                  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web UI     │  │   API Layer  │  │ Observability│      │
│  │  (Vue/Ionic) │  │   (NestJS)   │  │   (Helicone) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  │                                           │
│         ┌────────▼──────────────────────────┐               │
│         │   Governed Execution Layer        │               │
│         │  • A2A Protocol                   │               │
│         │  • PII Pseudonymization           │               │
│         │  • RBAC & Auth                    │               │
│         │  • Organization Context           │               │
│         │  • Observability & Streaming       │               │
│         └────────┬──────────────────────────┘               │
│                  │                                           │
│    ┌─────────────┼─────────────┐                            │
│    │             │             │                            │
│ ┌──▼──────┐ ┌───▼──────┐ ┌───▼──────┐                      │
│ │LangGraph│ │   N8N    │ │  Future  │                      │
│ │ Agents  │ │Workflows │ │Frameworks│                      │
│ └─────────┘ └──────────┘ └──────────┘                      │
│                                                               │
│  ┌──────────────────────────────────────────┐              │
│  │         Infrastructure Layer              │              │
│  │  • Supabase (PostgreSQL + pgvector)      │              │
│  │  • Ollama (Local LLMs & Embeddings)      │              │
│  │  • RAG (Self-Hosted Vector Search)       │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
apps/
  api/              # NestJS backend API (governed execution layer)
  web/              # Vue 3 + Ionic frontend
  langgraph/        # LangGraph workflow engine
  n8n/              # N8N workflow storage and management
  orch-flow/        # Orchestration flow UI
  open-notebook/    # RAG document management
  observability/    # Monitoring and tracing
packages/
  transport-types/  # Shared TypeScript types (A2A protocol)
```

---

## 🔒 Security Features

### Inside-the-Firewall Deployment

Orchestrator AI is designed for **self-hosted, inside-the-firewall** deployment:

- **Data Sovereignty**: All data stays within your infrastructure
- **Regulatory Compliance**: Supports HIPAA, GDPR, and other compliance requirements
- **Complete Control**: You control access, encryption, and data retention policies
- **No External Dependencies**: Optional cloud integration—only when explicitly configured

### Local LLM Support

**Heavy emphasis on local LLM execution** for security and data privacy:

- **Ollama Integration**: Full support for local LLM execution via Ollama
- **Self-Hosted Embeddings**: Generate embeddings locally using `nomic-embed-text` or other Ollama models
- **RAG Infrastructure**: Complete RAG pipeline (document storage, embeddings, vector search, LLM interpretation) runs entirely within your firewall
- **Provider Abstraction**: Support for OpenAI, Anthropic, Google, and others—but local execution is the default and recommended approach

**Why Local LLMs?**

- **Data Privacy**: Sensitive documents never leave your infrastructure
- **Cost Control**: Predictable costs without per-API charges
- **Performance**: Lower latency, no network overhead
- **Compliance**: Meets strict regulatory requirements for data handling

### PII Pseudonymization

**Comprehensive PII protection** built into the platform:

- **Dictionary-Based Pseudonymization**: Organization/agent-scoped dictionaries map real names to pseudonyms (e.g., "Matt Weber" → "@christophercbfb")
- **Pattern Detection**: Automatically detects and redacts high-risk patterns (SSN, credit cards, email addresses, phone numbers)
- **Reversible**: Pseudonyms are restored in user-facing responses while keeping PII out of LLM processing
- **Auditable**: All pseudonymization mappings are tracked for compliance and auditing

**Flow:**
```
User Input → Dictionary Pseudonymization → Pattern Detection → 
LLM Processing (with pseudonyms) → Reverse Pseudonymization → 
User Response (with originals restored)
```

### Role-Based Access Control (RBAC)

**Comprehensive RBAC system** for fine-grained access control:

- **Multi-Tenant Support**: Users can belong to multiple organizations with different roles in each
- **Resource-Level Permissions**: Fine-grained access control to collections, documents, agents, and workflows
- **Super-Admin Capability**: Global access across all organizations for platform administrators
- **Standard RBAC Pattern**: Industry-standard approach similar to AWS IAM, GCP IAM

**Roles:**
- `user` - Standard user access
- `admin` - Organization administrator
- `developer` - Developer access with additional capabilities
- `evaluation_monitor` - Access to evaluation and monitoring features
- `beta_tester` - Beta feature access
- `support` - Support team access

---

## 🤖 Agent Development

### Framework-Agnostic Approach

Build agents in **whatever framework you prefer**:

#### LangGraph Agents

Create LangGraph workflows as NestJS applications:

```typescript
// apps/langgraph/{workflow-name}/src/workflows/{workflow}.workflow.ts
export const createWorkflow = () => {
  return new StateGraph(WorkflowState)
    .addNode("process", processNode)
    .addNode("validate", validateNode)
    .setEntryPoint("process")
    .addEdge("process", "validate")
    .compile();
};
```

**Features:**
- NestJS application structure
- Webhook endpoints for task execution
- Status tracking and progress streaming
- Automatic wrapping as API agents

#### N8N Workflows

Build visual workflows in N8N and wrap them as governed agents:

- **Local or SaaS**: Use N8N locally or via SaaS
- **Visual Builder**: Drag-and-drop workflow creation
- **API Wrapper**: Automatically wrapped as API agents with governance
- **Storage**: Workflows stored in database for versioning and management

#### Custom Agents

Any HTTP endpoint can be wrapped as an API agent:

1. Build your agent/workflow in your preferred framework
2. Expose it as an HTTP endpoint
3. Register it as an API agent in Orchestrator AI
4. Get automatic governance: PII handling, observability, auth, organization context

### A2A Protocol

**Agent-to-Agent communication** using JSON-RPC 2.0:

- **Standardized Transport**: Consistent communication patterns across all agents
- **Type Safety**: Shared TypeScript types ensure compatibility
- **Observability**: All A2A calls are traced and monitored
- **Error Handling**: Standardized error responses and retry logic

---

## 📚 Advanced RAG Capabilities

**Comprehensive RAG infrastructure** with advanced retrieval strategies:

### Self-Hosted RAG Pipeline

**100% inside-the-firewall** RAG infrastructure:

- **Document Storage**: Supabase (PostgreSQL) with organization isolation
- **Vector Database**: pgvector extension for similarity search
- **Embedding Generation**: Ollama (local) - `nomic-embed-text` or other models
- **LLM Interpretation**: Ollama (local) - `llama3.2` or other models

**Data Flow (All Internal):**
```
User Upload → Text Extraction → Chunking → 
Local Embedding Generation → Vector Storage → 
Query → Vector Search → Local LLM Interpretation → Response
```

### Advanced RAG Strategies

Beyond basic retrieval, Orchestrator AI supports advanced RAG patterns:

- **Hybrid Search**: Combine vector similarity and keyword (BM25) search
- **Reranking Pipeline**: Cross-encoder models for precision improvement
- **Parent Document RAG**: Retrieve full documents from chunk matches
- **Multi-Query RAG**: Generate multiple query variations for better coverage
- **Query Expansion**: Expand queries with synonyms and related terms
- **Self-RAG**: Self-reflective retrieval with quality checks
- **Adaptive RAG**: Route queries based on complexity (skip RAG for simple queries)
- **Agentic RAG**: LLM-guided multi-step retrieval
- **Contextual Compression**: Extract only relevant content before generation

**Future Strategies:**
- Corrective RAG, Multi-Step RAG, Ensemble RAG, RAG-Fusion, GraphRAG, and more

### Collection-Level RBAC

RAG collections support **role-based access control**:

- **Default**: All organization members can access
- **Director-Level**: Restricted to directors and above
- **C-Level**: Restricted to C-suite executives only

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+**
- **Docker & Docker Compose** (for Supabase and Ollama)
- **Supabase CLI**
- **PostgreSQL** (via Supabase or standalone)
- **Ollama** (for local LLM execution)

### Installation

```bash
# Clone the repository
git clone https://github.com/golfergeek/orchestrator-ai-v2.git
cd orchestrator-ai-v2

# Install dependencies
npm install

# Copy environment file
cp dev.env.example .env
# Edit .env with your configuration:
# - Supabase credentials
# - LLM provider API keys (if using cloud providers)
# - Ollama base URL (default: http://localhost:11434)
# - Other required environment variables

# Start local Supabase
cd apps/api
npx supabase start

# Run database migrations
npx supabase db push

# Start Ollama (if not already running)
# See: https://ollama.ai for installation instructions
# Ensure Ollama is accessible at http://localhost:11434

# Start development servers
cd ../..
npm run dev
```

### Development Environment

The development environment uses:
- **API**: http://localhost:6100
- **Web UI**: http://localhost:6101
- **Supabase Studio**: http://localhost:6010
- **Ollama**: http://localhost:11434

### Initial Setup Steps

**After installation, you'll need to:**

1. **Configure Authentication**
   - Set up user management
   - Configure JWT tokens
   - Create initial organization

2. **Configure LLM Providers**
   - Set up Ollama (recommended for local execution)
   - Configure cloud providers (optional, if needed)
   - No defaults or fallbacks—explicit configuration required

3. **Set Up PII Protection**
   - Create PII dictionaries for your organization
   - Configure pattern detection rules
   - Test pseudonymization flow

4. **Configure RBAC**
   - Set up roles and permissions
   - Configure organization-level access controls
   - Set up collection-level permissions (for RAG)

5. **Deploy Infrastructure**
   - Set up production Supabase instance
   - Configure networking and access controls
   - Set up monitoring and observability

**See [deployment/PRODUCTION_DEPLOYMENT.md](deployment/PRODUCTION_DEPLOYMENT.md) for detailed production deployment instructions.**

---

## 📖 Documentation

### Getting Started
- **[Getting Started Guide](GETTING_STARTED.md)** - Step-by-step setup tutorial
- **[Architecture Overview](ARCHITECTURE.md)** - System architecture and design
- **[Examples & Tutorials](docs/EXAMPLES.md)** - Example agents and workflows

### Technical Documentation
- **[API Documentation](docs/api/README.md)** - API endpoints and usage
- **[Agent Development Guide](docs/agents/README.md)** - Building and deploying agents
- **[A2A Protocol Specification](docs/a2a/README.md)** - Agent-to-Agent communication
- **[RAG Documentation](specs/prd-phase-6-rag-infrastructure.md)** - RAG infrastructure and advanced strategies
- **[RBAC Documentation](specs/prd-rbac-permissions.md)** - Role-based access control
- **[Production Deployment](deployment/PRODUCTION_DEPLOYMENT.md)** - Production deployment guide

### Security & Governance
- **[Security Policy](SECURITY.md)** - Security reporting and best practices
- **[Enterprise Hardening](docs/ENTERPRISE_HARDENING_ASSESSMENT.md)** - Hardening assessment
- **[Security Checklist](docs/security/SECURITY-CHECKLIST.md)** - Security checklist

---

## 🏛️ Architecture Principles

### No Fallbacks or Hardcoded Defaults

**Explicit configuration required**—no silent fallbacks:

```typescript
// ❌ FORBIDDEN
const provider = config.provider || 'openai';

// ✅ REQUIRED
if (!config.provider || !config.model) {
  throw new Error('LLM provider and model must be explicitly configured');
}
```

**Why?**
- **Predictable Behavior**: You get exactly what you configure
- **Easy Debugging**: Clear errors show what's missing
- **Security**: No surprise dependencies or hidden assumptions
- **Fast Failure**: Problems caught immediately, not in production

### Framework-Agnostic Execution

The **API is the governed execution layer**:

- Agents/workflows can be built in any framework
- Platform provides governance (PII, observability, auth, org context)
- Stable API contracts regardless of underlying framework
- Easy to add new frameworks via adapters/runners

### Inside-the-Firewall First

**Designed for self-hosted deployment**:

- Local LLM execution (Ollama) is the default and recommended approach
- Complete RAG infrastructure runs within your firewall
- Optional cloud integration—only when explicitly configured
- Data sovereignty and regulatory compliance built-in

---

## 📋 Current Status

**Working codebase, actively being hardened for production use.**

### What's Working

- ✅ Multi-agent orchestration with A2A protocol
- ✅ Framework-agnostic agent execution (LangGraph, N8N)
- ✅ PII pseudonymization and pattern detection
- ✅ RBAC with organization isolation
- ✅ Self-hosted RAG with advanced strategies
- ✅ Local LLM support (Ollama)
- ✅ Observability and progress streaming
- ✅ Marketing Swarm workflow (example vertical)

### In Progress

- 🔄 Security hardening and audit
- 🔄 Production deployment automation
- 🔄 Comprehensive setup documentation
- 🔄 Additional advanced RAG strategies
- 🔄 More agent framework integrations

### Known Limitations

- **Setup Complexity**: Requires significant configuration (see warning above)
- **Documentation**: Setup guides are being improved
- **Security Audit**: Not yet security-audited (hardening is first priority)
- **Onboarding**: Quick-start automation is planned but not yet available

---

## 📄 License

This project is licensed under the **Polyform Noncommercial License 1.0.0**.

### What this means:

**Allowed:**
- Personal use and learning
- Academic and educational use
- Research and experimentation
- Internal evaluation by organizations
- Non-profit and government use

**Not Allowed (without a commercial license):**
- Offering consulting or implementation services
- Operating as a managed service or SaaS
- Building commercial products
- Any revenue-generating use

See [LICENSE](LICENSE) for full terms.

### Commercial Licensing

For commercial use, please contact: **golfergeek@orchestratorai.io**

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) first.

**Important:** All contributors must agree to our [Contributor License Agreement](CLA.md) before their contributions can be accepted.

### Areas Where We Need Help

- **Security Hardening**: Security review, threat modeling, vulnerability remediation
- **Documentation**: Setup guides, API documentation, architecture diagrams
- **Testing**: Unit tests, integration tests, end-to-end tests
- **Deployment Automation**: Docker Compose, Kubernetes, deployment scripts
- **Framework Integrations**: Additional agent framework adapters
- **Examples**: More example agents and workflows

### Areas Where We Need Help

- **Security Hardening**: Security review, threat modeling, vulnerability remediation
- **Documentation**: Setup guides, API documentation, architecture diagrams
- **Testing**: Unit tests, integration tests, end-to-end tests
- **Deployment Automation**: Docker Compose, Kubernetes, deployment scripts
- **Framework Integrations**: Additional agent framework adapters

---

## 💬 Support & Community

- **GitHub Issues**: [Report bugs or request features](https://github.com/golfergeek/orchestrator-ai-v2/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/golfergeek/orchestrator-ai-v2/discussions)
- **Email**: golfergeek@orchestratorai.io
- **Security Issues**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

## 📚 Learning Resources

### For Students & Educators
- **[Getting Started Guide](GETTING_STARTED.md)** - Learn how to set up and run the platform
- **[Architecture Documentation](ARCHITECTURE.md)** - Understand the system design
- **[Examples](docs/EXAMPLES.md)** - Explore example agents and workflows
- **[Demo Agents](demo-agents/)** - Study real agent implementations

### For Developers
- **[Agent Development Guide](docs/agents/README.md)** - Build your own agents
- **[A2A Protocol](docs/a2a/README.md)** - Understand agent-to-agent communication
- **[API Documentation](docs/api/README.md)** - API reference and usage

### For Enterprise Evaluators
- **[Enterprise Hardening Assessment](docs/ENTERPRISE_HARDENING_ASSESSMENT.md)** - Security and hardening status
- **[Partner Opportunity Brief](docs/partner-opportunity-brief.md)** - Business and technical overview
- **[Production Deployment Guide](deployment/PRODUCTION_DEPLOYMENT.md)** - Production deployment instructions

---

## 🙏 Acknowledgments

Built with a focus on **security, governance, and flexibility**. Designed for organizations that need **inside-the-firewall AI agent orchestration** with **local LLM execution** and **comprehensive PII protection**.

---

**Copyright 2024-2025 Justin Vos - https://orchestratorai.io**
