# CLAUDE Development Principles

## CRITICAL: NO FALLBACKS, NO MOCKS, NO FAKE SUCCESS

**The user is a senior developer with plenty of time who is infinitely more concerned with code and tests working properly than getting done quickly.**

### Core Principles:

1. **ALWAYS ERROR RATHER than create fallbacks**
   - Never use fallback data, mock responses, or hardcoded values
   - If something doesn't work, throw a clear error explaining what's broken
   - Failing tests that reveal real problems are better than passing tests that hide issues

2. **NO HARDCODED ASSUMPTIONS**
   - Never hardcode lists of expected database tables, API endpoints, or data structures
   - Always discover/query actual state dynamically
   - Schema discovery should query real database metadata, not return predefined schemas

3. **REAL FUNCTIONALITY ONLY**
   - Only implement features that actually work with real data
   - Don't simulate success to make tests pass
   - If a database query fails, fix the query - don't return sample data

4. **TRANSPARENT ERRORS**
   - Error messages should clearly explain what was attempted and why it failed
   - Include enough detail for debugging the real issue
   - Never mask errors with "graceful degradation"

5. **TEST INTEGRITY**
   - Tests should verify actual functionality, not mock implementations
   - A failing test that exposes a real bug is valuable
   - Don't modify tests to work around broken code - fix the code

### Examples of What NOT to Do:

❌ `const fallbackSchema = { tables: [hardcoded list] }`
❌ `if (realQueryFails) { return mockData; }`
❌ `catch(error) { console.warn(error); return successResponse; }`

### Examples of What TO Do:

✅ `throw new Error('Database schema query failed: ' + details)`
✅ `const tables = await queryActualDatabase();`
✅ `if (!realData) { throw new Error('Expected data not found'); }`

## Remember: 
**It's better to have 0 working features that are real than 100 "working" features that are fake.**

# ORCHESTRATOR ARCHITECTURE PRINCIPLE

## Core Paradigm: Conversation + Tasks Pattern

**The orchestrator follows the proven conversation + tasks paradigm that already works, enhanced with:**

- **Delegation & Pass-through**: Understands existing delegated agents and routes accordingly
- **Project Capabilities**: Can create and manage multi-step projects as enhanced task workflows  
- **Same Frontend Patterns**: Conversations with orchestrator work like conversations with any other agent
- **A2A Compliance**: Tasks flow through normally, orchestrator just adds project orchestration on top

**Key Insight**: The orchestrator isn't a special case - it's **a regular agent that happens to coordinate other agents and manage projects**. It should work exactly like the existing conversation + tasks system that's proven to work, just with added orchestration intelligence.

# DATABASE ARCHITECTURE PRINCIPLE

## Four Separate Databases - By Design

**Orchestrator AI uses four separate databases intentionally. This separation is a core architectural decision and should be maintained.**

| Database | Purpose | Connection |
|----------|---------|------------|
| `postgres` | Main Orchestrator AI (agents, conversations, tasks, orgs, users) | `DATABASE_URL` |
| `rag_data` | RAG infrastructure (collections, documents, vector embeddings) | `RAG_DATABASE_URL` |
| `n8n` | N8N workflow automation | N8N internal |
| `observability` | Multi-agent observability events and analytics | Observability service |

**Why separate databases?**
- **Isolation**: Each concern has its own data lifecycle and scaling needs
- **Performance**: Vector operations (RAG) don't impact transactional workloads (Orchestrator)
- **Security**: Service-level access control per database
- **Backup/Restore**: Independent backup strategies per concern

**NEVER consolidate these databases.** Keep the four-database architecture.