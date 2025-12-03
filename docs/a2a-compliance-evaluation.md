# A2A Protocol Compliance Evaluation

**Date:** December 3, 2025  
**Evaluator:** AI Assistant  
**Project:** Orchestrator AI v2

## Executive Summary

Your implementation demonstrates **strong A2A protocol compliance** with well-architected encapsulation in `agent2agent` service, `transport-types`, and SSE streaming. The system follows core A2A standards but has some gaps in discovery mechanisms and external agent support.

**Overall Compliance Score: 88/100** (Updated after verification)

---

## Compliance Assessment by Component

### ✅ 1. JSON-RPC 2.0 Protocol (Score: 100/100)

**Status: FULLY COMPLIANT**

**Evidence:**
- ✅ Proper JSON-RPC 2.0 request/response structure in `apps/transport-types/request/json-rpc.types.ts`
- ✅ Correct `jsonrpc: "2.0"` version field
- ✅ Proper `id`, `method`, `params` structure for requests
- ✅ Proper `id`, `result`, `error` structure for responses
- ✅ Error codes and messages follow JSON-RPC 2.0 spec
- ✅ Controller properly wraps/unwraps JSON-RPC envelopes (`agent2agent.controller.ts`)

**Implementation Quality:**
- Type-safe TypeScript interfaces ensure compile-time compliance
- Shared `transport-types` package guarantees API/Web consistency
- Proper error handling with JSON-RPC error objects

**Recommendations:**
- ✅ No changes needed - implementation is exemplary

---

### ✅ 2. Transport Types Encapsulation (Score: 95/100)

**Status: EXCELLENT**

**Evidence:**
- ✅ Centralized type definitions in `apps/transport-types/`
- ✅ Shared package (`@orchestrator-ai/transport-types`) used by both API and Web
- ✅ Complete type coverage:
  - JSON-RPC base types
  - Task request/response types
  - ExecutionContext (core context capsule)
  - Mode-specific types (plan, build, converse, hitl)
  - SSE event types
- ✅ Type safety enforced at compile time
- ✅ Versioned package ensures API contract stability

**Strengths:**
- **ExecutionContext as Single Source of Truth**: Excellent design - context flows through entire system unchanged
- **Strict Type Aliases**: Prevents type drift between frontend/backend
- **Comprehensive Coverage**: All A2A protocol types are defined

**Minor Gaps:**
- ⚠️ No explicit versioning strategy documented for transport-types package
- ⚠️ No migration guide for breaking changes

**Recommendations:**
- Add semantic versioning strategy (e.g., `1.0.0` → `1.1.0` for additions, `2.0.0` for breaking changes)
- Document breaking change migration process

---

### ✅ 3. Agent Cards (Score: 90/100)

**Status: EXCELLENT - Server-Side Complete, Client-Side Discovery Missing**

**Evidence:**
- ✅ Agent Card generation implemented (`AgentCardBuilderService`)
- ✅ **`.well-known/agent.json` endpoint available** (SERVING agent cards):
  - `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`
  - `GET /agents/:orgSlug/:agentSlug/.well-known/agent.json`
- ✅ **`.well-known/hierarchy` endpoint** for agent discovery:
  - `GET /agent-to-agent/.well-known/hierarchy`
- ✅ Proper A2A protocol declaration: `protocol: 'google/a2a'`
- ✅ Required fields present:
  - `name`, `description`, `url`
  - `endpoints` (health, tasks, card)
  - `capabilities`, `skills`
  - `securitySchemes`
- ✅ Metadata includes agent-specific info (slug, organization, agentType, modeProfile)
- ✅ Public endpoint (no auth required for basic card)
- ✅ Supports authenticated extended cards (`supportsAuthenticatedExtendedCard: true`)

**Strengths:**
- Dynamic card generation from database records
- Proper endpoint URLs constructed from base URL
- Hierarchy endpoint for discovering all agents
- Public access for agent cards (A2A compliant)

**Gaps:**
- ⚠️ **Discovery Step Missing**: `ExternalAgentRunnerService` can EXECUTE external agents (with auth), but does NOT fetch `.well-known/agent.json` for discovery/validation before execution
- ⚠️ **Card Caching**: No caching mechanism for fetched external agent cards
- ⚠️ **Card Validation**: No validation against A2A Agent Card schema when fetching external cards
- ⚠️ **External Registry**: No centralized catalog of trusted external agents

**Note:** You DO have `ExternalAgentRunnerService` which can execute external agents if you know their URL and configure authentication. The gap is specifically the DISCOVERY step (fetching `.well-known/agent.json` to validate/configure the agent before execution).

**Recommendations:**
1. **Implement External Agent Discovery:**
   ```typescript
   // In ExternalAgentRunnerService or new AgentDiscoveryService
   async discoverExternalAgent(discoveryUrl: string): Promise<AgentCard> {
     const response = await fetch(`${discoveryUrl}/.well-known/agent.json`);
     const card = await response.json();
     // Validate against A2A schema
     return card;
   }
   ```

2. **Add Card Caching:**
   - Cache external agent cards in database (`cached_agent_card` JSONB column)
   - Refresh cache periodically or on-demand
   - Store cache expiration timestamp

3. **Add Card Validation:**
   - Validate agent cards against A2A schema before caching
   - Reject invalid cards with clear error messages

4. **Implement Agent Registry:**
   - Maintain catalog of trusted agents
   - Support trust scores and compliance tags
   - Enable agent search/filtering by capabilities

---

### ⚠️ 4. Discovery Mechanisms (Score: 75/100)

**Status: GOOD - Internal Discovery Complete, External Discovery Missing**

**Evidence:**
- ✅ **Agent hierarchy endpoint**: `GET /agent-to-agent/.well-known/hierarchy` (PUBLIC)
- ✅ **Individual agent cards**: `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json` (PUBLIC)
- ✅ Agent registry service exists (`AgentRegistryService`) for internal agents
- ✅ Hierarchy supports organization filtering via `x-organization-slug` header
- ✅ Returns structured hierarchy with metadata

**Strengths:**
- Public endpoints (no auth required) - A2A compliant
- Proper hierarchy structure
- Organization-scoped discovery
- Database-backed agent discovery

**Gaps:**
- ⚠️ **Discovery Step Missing**: `ExternalAgentRunnerService` can execute external agents (with auth), but does NOT fetch `.well-known/agent.json` for discovery/validation
- ⚠️ **No Capability-Based Search**: Cannot search agents by capabilities/skills (only hierarchy)
- ⚠️ **No Version Negotiation**: No mechanism to negotiate agent versions
- ⚠️ **No External Registry**: No centralized catalog of trusted external agents

**Note:** You CAN execute external agents if you know their URL and configure authentication. The gap is the DISCOVERY step (fetching `.well-known/agent.json` to validate/configure before execution).

**Recommendations:**
1. **Implement External Discovery Service:**
   ```typescript
   @Injectable()
   export class AgentDiscoveryService {
     async discoverAgent(discoveryUrl: string): Promise<AgentCard> {
       // Fetch .well-known/agent.json
       // Validate schema
       // Cache result
       // Return card
     }
     
     async searchByCapability(capability: string): Promise<AgentCard[]> {
       // Search local + cached external agents
     }
   }
   ```

2. **Add Agent Registry:**
   - Database table for external agent registrations
   - Trust scores, compliance tags
   - Discovery URL management

---

### ✅ 5. SSE (Server-Sent Events) Streaming (Score: 95/100)

**Status: EXCELLENT**

**Evidence:**
- ✅ Proper SSE implementation in `agent2agent.controller.ts`
- ✅ Correct headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- ✅ Keep-alive mechanism (15-second intervals)
- ✅ Proper event formatting: `data: {json}\n\n`
- ✅ Typed SSE events in `apps/transport-types/streaming/sse-events.types.ts`:
  - `AgentStreamChunkSSEEvent`
  - `AgentStreamCompleteSSEEvent`
  - `AgentStreamErrorSSEEvent`
  - `TaskProgressSSEEvent`
- ✅ Full ExecutionContext in all SSE events (excellent design)
- ✅ Centralized streaming service (`StreamingService`)
- ✅ Event replay support for reconnecting clients

**Strengths:**
- **Type Safety**: All SSE events are strongly typed
- **Context Preservation**: ExecutionContext flows through all events
- **Observability Integration**: Events pushed to observability buffer
- **Proper Cleanup**: Stream session management and cleanup on disconnect

**Minor Gaps:**
- ⚠️ No explicit retry mechanism documented for SSE reconnection
- ⚠️ No exponential backoff strategy for failed connections

**Recommendations:**
- Document SSE reconnection strategy in frontend
- Add exponential backoff for reconnection attempts
- Consider adding `retry` field to SSE events (already in type definition)

---

### ✅ 6. Authentication & Authorization (Score: 75/100)

**Status: GOOD - Basic Security Present, Enterprise Features Missing**

**Current Implementation:**

**✅ What You Have:**
1. **JWT Authentication** (`JwtAuthGuard`)
   - User authentication via Supabase JWT tokens
   - User-scoped task access
   - Organization-scoped access control

2. **API Key Authentication** (`ApiKeyGuard`)
   - Organization-scoped API keys (`X-Agent-Api-Key` header)
   - Credential caching (60s TTL, configurable)
   - Rate limiting (120 requests/minute, configurable)
   - Timing-safe key comparison (prevents timing attacks)
   - Credential fingerprinting for audit trails
   - Support for multiple credential aliases per organization

3. **Security Schemes in Agent Cards**
   - Declared in `.well-known/agent.json`: `security: [{ apiKey: [] }]`
   - Security scheme metadata: `securitySchemes.apiKey` with description

4. **Organization Isolation**
   - Tasks scoped to organizations
   - Credentials scoped to organizations
   - RBAC for organization-level permissions

**❌ What's Missing:**

1. **OAuth 2.0 Support**
   - **Why it matters**: Industry standard for third-party integrations
   - **Use case**: External agents from different vendors need OAuth flows
   - **Impact**: Cannot integrate with agents that require OAuth (e.g., Google, Microsoft agents)
   - **Implementation**: Need to support authorization code flow, client credentials flow

2. **OpenID Connect (OIDC)**
   - **Why it matters**: Identity layer on top of OAuth 2.0
   - **Use case**: Enterprise SSO, identity federation
   - **Impact**: Cannot integrate with enterprise identity providers
   - **Implementation**: OIDC discovery, token validation, user info endpoints

3. **Mutual TLS (mTLS)**
   - **Why it matters**: Certificate-based authentication for high-security scenarios
   - **Use case**: B2B integrations, government/healthcare agents
   - **Impact**: Cannot meet high-security compliance requirements
   - **Implementation**: Client certificate validation, certificate pinning

4. **External Agent Auth Declaration**
   - **Why it matters**: External agents may require different auth methods
   - **Use case**: When discovering external agents, need to read their auth requirements
   - **Impact**: Cannot automatically configure auth for discovered agents
   - **Implementation**: Parse `securitySchemes` from external agent cards, negotiate auth

5. **Token Management**
   - **Why it matters**: OAuth tokens expire, need refresh flows
   - **Use case**: Long-running agent interactions
   - **Impact**: Cannot maintain authenticated sessions with external agents
   - **Implementation**: Token storage, refresh token handling, secure token rotation

6. **Auth Negotiation Protocol**
   - **Why it matters**: Different agents may support different auth methods
   - **Use case**: Finding common auth method between your system and external agent
   - **Impact**: Manual configuration required for each external agent
   - **Implementation**: Auth capability negotiation, fallback mechanisms

**Detailed Recommendations:**

1. **Expand Security Schemes in Agent Cards:**
   ```typescript
   // In AgentCardBuilderService.buildSecuritySchemes()
   private buildSecuritySchemes(): Record<string, unknown> {
     return {
       apiKey: {
         type: 'apiKey',
         name: 'X-Agent-Api-Key',
         in: 'header',
         description: 'Organization-scoped API key'
       },
       oauth2: {
         type: 'oauth2',
         flows: {
           authorizationCode: {
             authorizationUrl: 'https://auth.example.com/oauth/authorize',
             tokenUrl: 'https://auth.example.com/oauth/token',
             scopes: { 'agent:read': 'Read agent data', 'agent:write': 'Write agent data' }
           },
           clientCredentials: {
             tokenUrl: 'https://auth.example.com/oauth/token',
             scopes: { 'agent:execute': 'Execute agent tasks' }
           }
         }
       },
       openIdConnect: {
         type: 'openIdConnect',
         openIdConnectUrl: 'https://auth.example.com/.well-known/openid-configuration'
       },
       mutualTls: {
         type: 'mutualTls',
         description: 'Client certificate authentication'
       }
     };
   }
   ```

2. **Support External Agent Auth Discovery:**
   ```typescript
   // In ExternalAgentRunnerService
   async discoverAndConfigureAuth(discoveryUrl: string): Promise<AuthConfig> {
     const card = await this.fetchAgentCard(discoveryUrl);
     const schemes = card.securitySchemes;
     
     // Find common auth method
     const supportedSchemes = ['apiKey', 'oauth2', 'openIdConnect'];
     const commonScheme = supportedSchemes.find(s => schemes[s]);
     
     if (!commonScheme) {
       throw new Error('No compatible auth scheme found');
     }
     
     return this.configureAuth(commonScheme, schemes[commonScheme]);
   }
   ```

3. **Add OAuth 2.0 Token Management:**
   - Store OAuth tokens securely (encrypted in database)
   - Implement refresh token rotation
   - Handle token expiration gracefully
   - Support multiple OAuth providers

**Real-World Impact:**
- **Current**: Can only integrate with agents that support API keys or JWT
- **With OAuth/OIDC**: Can integrate with Google, Microsoft, Salesforce agents
- **With mTLS**: Can meet healthcare (HIPAA) and government security requirements
- **With Auth Negotiation**: Automatic configuration when discovering new agents

---

### ✅ 7. Agent-to-Agent Service Encapsulation (Score: 90/100)

**Status: EXCELLENT**

**Evidence:**
- ✅ Centralized `agent2agent` service layer
- ✅ Clean separation of concerns:
  - Controller handles HTTP/JSON-RPC
  - Gateway routes to appropriate runners
  - Runners handle mode-specific logic
  - Services handle business logic
- ✅ Base runner pattern for code reuse
- ✅ Mode router for dispatching to correct handlers
- ✅ Proper error handling and logging

**Strengths:**
- **Clean Architecture**: Well-organized service layer
- **Extensibility**: Easy to add new agent types/runners
- **Type Safety**: Strong TypeScript typing throughout
- **Consistency**: All agents follow same execution pattern

**Minor Gaps:**
- ⚠️ External agent runner exists but discovery not fully implemented
- ⚠️ No agent capability negotiation

**Recommendations:**
- Complete external agent discovery implementation
- Add capability negotiation for external agents

---

### ⚠️ 8. Governance & Compliance (Score: 70/100)

**Status: PARTIAL - Basic Auditability Present, Enterprise Governance Missing**

**Current Implementation:**

**✅ What You Have:**
1. **Observability Events Service**
   - Event emission for agent interactions
   - Task progress tracking
   - Status updates (started, processing, completed, failed)
   - ExecutionContext preservation for traceability

2. **Task Status Tracking**
   - Task lifecycle management
   - Status transitions (pending → in-progress → completed/failed)
   - Task metadata storage

3. **Conversation History**
   - Message storage in conversations
   - Conversation-scoped task tracking
   - User message history

4. **Deliverable Versioning**
   - Version tracking for deliverables
   - Content history
   - Version metadata

**❌ What's Missing:**

1. **Compliance Tags in Agent Cards**
   - **Why it matters**: Organizations need to know which agents meet regulatory requirements
   - **Use case**: Healthcare organizations need HIPAA-compliant agents, EU companies need GDPR-compliant agents
   - **Impact**: Cannot filter or validate agents by compliance requirements
   - **Standards to support**:
     - **GDPR** (EU General Data Protection Regulation): Data privacy, right to deletion
     - **HIPAA** (US Health Insurance Portability): Healthcare data protection
     - **SOC2** (Service Organization Control): Security, availability, processing integrity
     - **ISO 27001**: Information security management
     - **PCI-DSS**: Payment card industry compliance
   - **Implementation**: Add `complianceTags` array to agent metadata, validate against requirements

2. **Trust Scores**
   - **Why it matters**: Not all agents are equally trustworthy
   - **Use case**: Prioritize verified agents, warn about untrusted agents
   - **Impact**: Cannot make informed decisions about agent reliability
   - **Factors to consider**:
     - Verification status (verified by platform, self-reported, unverified)
     - Historical success rate
     - Response time reliability
     - Error rate
     - User ratings/feedback
     - Security audit status
   - **Implementation**: Calculate trust score (0.0-1.0), update dynamically, display in agent cards

3. **Comprehensive Audit Logging**
   - **Why it matters**: Regulatory compliance requires detailed audit trails
   - **Use case**: SOC2, HIPAA, GDPR all require audit logs
   - **Impact**: Cannot prove compliance or investigate security incidents
   - **What to log**:
     - All agent-to-agent interactions (request/response)
     - Authentication attempts (success/failure)
     - Authorization decisions (allowed/denied)
     - Data access (what data was accessed, by whom)
     - Configuration changes (who changed what, when)
     - Error events (with full context)
   - **Requirements**:
     - Immutable logs (cannot be modified after creation)
     - Retention policies (e.g., 7 years for HIPAA)
     - Searchable/indexed
     - Exportable for compliance audits
   - **Implementation**: Dedicated audit table, structured logging, log retention policies

4. **Policy Enforcement Engine**
   - **Why it matters**: Automated compliance enforcement prevents violations
   - **Use case**: Block non-HIPAA agents from accessing healthcare data
   - **Impact**: Manual compliance checks, risk of violations
   - **Policy types**:
     - **Data access policies**: Which agents can access which data types
     - **Compliance policies**: Require specific compliance tags for certain operations
     - **Geographic policies**: Data residency requirements (e.g., EU data stays in EU)
     - **Time-based policies**: Restrict agent execution to business hours
     - **Rate limiting policies**: Prevent abuse
   - **Implementation**: Policy engine service, policy definition language, runtime enforcement

5. **Data Privacy Controls**
   - **Why it matters**: GDPR requires data minimization, right to deletion
   - **Use case**: User requests data deletion, need to remove from all systems
   - **Impact**: Cannot meet GDPR requirements
   - **Requirements**:
     - Data minimization (only collect necessary data)
     - Right to access (export user data)
     - Right to deletion (remove user data)
     - Data portability (export in machine-readable format)
     - Consent management (track user consent)
   - **Implementation**: Data deletion workflows, data export endpoints, consent tracking

6. **Security Audit Trail**
   - **Why it matters**: Security incidents require detailed investigation
   - **Use case**: Detect and investigate security breaches
   - **Impact**: Cannot effectively respond to security incidents
   - **What to track**:
     - Failed authentication attempts
     - Unauthorized access attempts
     - Unusual access patterns
     - Configuration changes
     - API key rotations
     - External agent connections

7. **Agent Verification & Certification**
   - **Why it matters**: Verified agents are more trustworthy
   - **Use case**: Platform-verified agents vs. self-reported agents
   - **Impact**: Cannot distinguish verified from unverified agents
   - **Implementation**: Verification badges, certification levels, verification process

**Detailed Recommendations:**

1. **Add Compliance Tags to Agent Cards:**
   ```typescript
   // In AgentCardBuilderService.composeSpecCard()
   metadata: {
     slug: agent.slug,
     organization: agent.organization_slug,
     // ... existing fields ...
     complianceTags: metadataObj.compliance_tags || [],
     trustScore: this.calculateTrustScore(agent),
     verified: metadataObj.verified || false,
     certificationLevel: metadataObj.certification_level || 'unverified',
     lastSecurityAudit: metadataObj.last_security_audit || null,
     dataResidency: metadataObj.data_residency || [], // ['EU', 'US', etc.]
   }
   ```

2. **Implement Audit Logging Service:**
   ```typescript
   @Injectable()
   export class AuditLogService {
     async logAgentInteraction(event: {
       type: 'agent_request' | 'agent_response' | 'auth_attempt' | 'config_change';
       agentSlug: string;
       organizationSlug: string;
       userId: string;
       requestId: string;
       action: string;
       success: boolean;
       metadata: Record<string, unknown>;
       timestamp: Date;
     }): Promise<void> {
       // Store in audit_logs table
       // Ensure immutability (no updates, only inserts)
       // Index for searchability
     }
     
     async queryAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
       // Search audit logs with filters
       // Support date ranges, agent filters, user filters
     }
     
     async exportAuditLogs(format: 'json' | 'csv'): Promise<Buffer> {
       // Export for compliance audits
     }
   }
   ```

3. **Add Policy Engine:**
   ```typescript
   @Injectable()
   export class PolicyEngine {
     async evaluatePolicy(
       policy: Policy,
       context: PolicyContext
     ): Promise<PolicyDecision> {
       // Evaluate policy rules
       // Return ALLOW, DENY, or CONDITIONAL
     }
     
     async enforceCompliance(
       agent: AgentRecord,
       operation: string,
       data: unknown
     ): Promise<boolean> {
       // Check if agent has required compliance tags
       // Check if operation is allowed
       // Check data residency requirements
       // Return true if compliant, false otherwise
     }
   }
   ```

4. **Add Trust Score Calculation:**
   ```typescript
   private calculateTrustScore(agent: AgentRecord): number {
     let score = 0.5; // Base score
     
     // Verification bonus
     if (agent.metadata?.verified) score += 0.2;
     
     // Historical performance
     const successRate = this.getSuccessRate(agent.slug);
     score += successRate * 0.2;
     
     // Security audit bonus
     if (agent.metadata?.last_security_audit) {
       const daysSinceAudit = (Date.now() - new Date(agent.metadata.last_security_audit).getTime()) / (1000 * 60 * 60 * 24);
       if (daysSinceAudit < 90) score += 0.1;
     }
     
     return Math.min(1.0, score);
   }
   ```

**Real-World Impact:**
- **Current**: Basic auditability, but cannot prove compliance or enforce policies
- **With Compliance Tags**: Healthcare orgs can filter to HIPAA-compliant agents only
- **With Trust Scores**: Users can prioritize verified, high-performing agents
- **With Audit Logging**: Can pass SOC2 audits, investigate security incidents
- **With Policy Engine**: Automated compliance enforcement prevents violations
   - Enforce policies before agent execution
   - Block non-compliant agents

---

## Detailed Findings

### Strengths

1. **Excellent Type Safety**: Transport types ensure compile-time compliance
2. **Clean Architecture**: Well-encapsulated service layer
3. **ExecutionContext Pattern**: Single source of truth for context
4. **SSE Implementation**: Properly implemented with type safety
5. **JSON-RPC Compliance**: Fully compliant with JSON-RPC 2.0 spec
6. **Agent Card Generation**: Dynamic card generation from database

### Critical Gaps

1. **External Agent Discovery Step**: `ExternalAgentRunnerService` can execute external agents (with auth) if you know their URL, but does NOT fetch `.well-known/agent.json` for discovery/validation
2. **Agent Card Fetching**: No service to fetch external agent cards for validation/configuration
3. **Limited Auth Schemes**: Missing OAuth 2.0, OpenID Connect, mutual TLS
4. **No Compliance Tags**: Missing compliance metadata in agent cards
5. **No Agent Registry**: No centralized catalog of trusted external agents

**Note:** You CAN use external agents via `ExternalAgentRunnerService` - you just need to manually configure the URL and authentication. The gap is automatic discovery/validation via `.well-known/agent.json`.

### Recommendations Priority

#### High Priority (Required for Full A2A Compliance)

1. **Implement External Agent Discovery Service**
   - Fetch `.well-known/agent.json` from remote URLs
   - Validate agent cards against A2A schema
   - Cache agent cards with expiration

2. **Complete External Agent Runner**
   - Implement discovery flow
   - Support external agent authentication
   - Handle external agent responses

3. **Add Agent Registry**
   - Database table for external agent registrations
   - Trust scores and compliance tags
   - Search/filter capabilities

#### Medium Priority (Enhancements)

4. **Expand Authentication Schemes**
   - OAuth 2.0 support
   - OpenID Connect support
   - Mutual TLS support

5. **Add Compliance Tags**
   - GDPR, HIPAA, SOC2 tags
   - Trust scores
   - Verification status

6. **Implement Audit Logging**
   - Comprehensive audit trail
   - Request/response logging
   - Retention policies

#### Low Priority (Nice to Have)

7. **Add Version Negotiation**
   - Agent version compatibility checks
   - Version-specific capabilities

8. **Capability-Based Search**
   - Search agents by capabilities
   - Filter by skills/tags

---

## Compliance Checklist

### Core Protocol Requirements

- [x] JSON-RPC 2.0 over HTTPS
- [x] Agent Cards (`.well-known/agent.json`) - **SERVING** ✅
- [x] Agent Hierarchy (`.well-known/hierarchy`) - **SERVING** ✅
- [x] Task request/response format
- [x] SSE streaming support
- [x] ExecutionContext capsule
- [x] Error handling
- [x] Public endpoints (no auth for discovery) ✅
- [ ] External agent discovery (FETCHING from remote agents)
- [ ] Agent card fetching service (client-side)
- [ ] External agent registry

### Security Requirements

- [x] HTTPS/TLS
- [x] API key authentication
- [x] JWT authentication
- [ ] OAuth 2.0
- [ ] OpenID Connect
- [ ] Mutual TLS
- [ ] Auth negotiation

### Governance Requirements

- [x] Observability events
- [x] Task tracking
- [ ] Compliance tags
- [ ] Trust scores
- [ ] Audit logging
- [ ] Policy enforcement

---

## Conclusion

Your A2A implementation is **strong and well-architected**. The core protocol compliance is excellent, with proper JSON-RPC 2.0, transport types, and SSE streaming. The main gaps are in **external agent discovery** and **governance features**.

**Key Strengths:**
- Excellent type safety and encapsulation
- Clean service architecture
- Proper SSE implementation
- Full JSON-RPC 2.0 compliance

**Key Gaps:**
- **Discovery Step Missing**: `ExternalAgentRunnerService` can execute external agents (with auth) if you know their URL, but does NOT fetch `.well-known/agent.json` for discovery/validation
- Limited authentication schemes (only API key/JWT)
- Missing compliance tags and trust scores

**Clarification:** You CAN use external agents via `ExternalAgentRunnerService` - you just need to manually configure the URL and authentication. The gap is automatic discovery/validation via `.well-known/agent.json`.

**Next Steps:**
1. Add discovery step to `ExternalAgentRunnerService` (fetch `.well-known/agent.json` before execution)
2. Add card caching and validation
3. Add agent registry
4. Expand authentication schemes
5. Add compliance tags

With these additions, you'll achieve **full A2A protocol compliance** and enable true vendor-neutral agent interoperability.

