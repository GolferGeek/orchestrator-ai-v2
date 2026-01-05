# AI Contract Review Workflow

**PRD Created:** 2026-01-05
**Status:** Draft
**Priority:** P1

## Overview

An AI-powered contract review system that analyzes legal documents, extracts key clauses, compares against firm playbooks, and flags risks - all while keeping data inside the firewall using local LLMs.

## Problem Statement

- SaaS contract review tools (Kira, Luminance) cost $50K-200K/year
- Law firms are reluctant to send client contracts to third-party cloud AI
- Manual contract review is time-consuming and inconsistent
- Junior associates miss nuances that experienced attorneys catch

## Competitive Advantage

- **Self-hosted**: Client documents never leave the firm's network
- **Local LLMs**: No data sent to OpenAI/Anthropic
- **Customizable playbooks**: Firm-specific standards, not generic rules
- **HITL**: Attorney review checkpoint before final output

## Proposed Architecture

### Technology Choice: LangGraph

Contract review requires:
- Multi-step reasoning (not single-pass RAG)
- Conditional logic (different checks for different contract types)
- Human-in-the-loop checkpoints
- State tracking across analysis phases

### Graph Structure

```
[Start] → [Extract Text] → [Classify Contract Type]
                                    ↓
                          [Route by Type]
                         /      |       \
                      NDA    Service   Employment
                        \      |       /
                         [Extract Clauses]
                                ↓
                         [Risk Analysis]
                                ↓
                         [Generate Report]
                                ↓
                         [HITL Review] ←→ [Attorney Feedback]
                                ↓
                         [Final Output]
```

## Core Features

### 1. Document Ingestion
- Accept PDF, DOCX, TXT formats
- Extract text using existing RAG pipeline
- Store original document for reference

### 2. Contract Classification
- Identify contract type automatically:
  - NDA / Confidentiality Agreement
  - Master Service Agreement (MSA)
  - Employment Agreement
  - Lease Agreement
  - Purchase Agreement
  - License Agreement
  - Other (with manual classification option)

### 3. Clause Extraction
- Identify and extract key clauses:
  - Term and duration
  - Termination provisions
  - Indemnification
  - Limitation of liability
  - Confidentiality
  - IP ownership
  - Non-compete / Non-solicit
  - Governing law and jurisdiction
  - Assignment
  - Force majeure
  - Insurance requirements
  - Payment terms

### 4. Playbook Comparison
- Compare extracted terms against firm's standard positions
- Configurable playbooks per contract type
- Flag deviations from acceptable ranges
- Suggest alternative language

### 5. Risk Analysis
- Score risk level (Low / Medium / High / Critical)
- Identify:
  - Missing standard clauses
  - One-sided provisions
  - Unusual terms
  - Unlimited liability exposure
  - Problematic indemnification
  - Restrictive IP terms

### 6. Report Generation
- Executive summary
- Clause-by-clause analysis
- Risk matrix
- Recommended changes
- Alternative language suggestions

### 7. HITL Review
- Attorney review checkpoint
- Ability to approve, modify, or request re-analysis
- Feedback loop for improving future analysis

## Sample Playbook Structure (NDA)

```yaml
contract_type: nda
version: 1.0
firm_position:
  term:
    acceptable_range: "1-3 years"
    preferred: "2 years"
    flag_if: "> 5 years or perpetual"

  confidentiality_survival:
    acceptable_range: "2-5 years"
    preferred: "3 years"
    flag_if: "> 7 years or indefinite"

  definition_of_confidential:
    must_include:
      - "written or oral"
      - "marked as confidential"
    flag_if: "all information regardless of marking"

  permitted_disclosures:
    required:
      - "employees with need to know"
      - "legal/regulatory requirements"
    optional:
      - "professional advisors"
      - "contractors under NDA"

  return_of_materials:
    required: true
    preferred: "return or certify destruction"

  governing_law:
    preferred: "Delaware"
    acceptable: ["New York", "California", "client's state"]
    flag_if: "foreign jurisdiction"
```

## Technical Requirements

### Dependencies
- LangGraph (workflow orchestration)
- Existing document extractors (PDF, DOCX)
- Local LLM (Ollama)
- Supabase (state persistence, playbook storage)

### New Components Needed
- Contract classification prompt/model
- Clause extraction prompts (per contract type)
- Playbook schema and storage
- Risk scoring algorithm
- Report template system
- HITL checkpoint handler

## Success Metrics

- Contract review time reduced by 60%+
- 95%+ accuracy on clause extraction
- Risk flags catch 90%+ of issues identified by senior attorneys
- Attorney satisfaction with recommendations

## Open Questions

1. How to handle multi-party contracts?
2. Should we support contract comparison (redline analysis)?
3. Integration with document management systems?
4. Training/fine-tuning on firm-specific contracts?

## Next Steps

1. [ ] Build LangGraph scaffold
2. [ ] Create state definition
3. [ ] Implement text extraction node
4. [ ] Implement classification node
5. [ ] Build NDA playbook (first contract type)
6. [ ] Implement clause extraction for NDAs
7. [ ] Implement risk analysis
8. [ ] Build report generation
9. [ ] Add HITL checkpoint
10. [ ] Test with sample contracts
