# Law Firm RAG Collection

**Document ID:** LAW-README
**Smith & Associates, PLLC - Legal Document Library**
**Last Updated:** January 5, 2026
**Total Documents:** 12+
**Total Lines:** 33,000+

---

Sample legal documents for demonstrating advanced RAG capabilities in law firm settings.

**DISCLAIMER**: These are fictional sample documents for demonstration purposes only. Not legal advice.

---

## Document Structure

This collection is organized to support multiple RAG retrieval strategies:

### RAG Complexity Types Demonstrated

| RAG Type | Description | Document Examples |
|----------|-------------|-------------------|
| `attributed` | Document/section citations | Firm Policies - Citations needed |
| `hybrid` | Keyword + semantic search | Contract Templates & Clause Library - Legal terms |
| `cross-reference` | Multi-document traversal | Litigation docs - Documents reference each other |
| `temporal` | Version-aware retrieval | Client Intake - Multiple versions |

---

## Folder Structure

```
law/
├── contracts/
│   ├── templates/           # Contract templates (NDA, MSA, Engagement)
│   ├── clause-library/      # Reusable clause repository
│   └── guides/              # Drafting and negotiation guides
├── client-intake/
│   ├── checklists/          # Practice area intake checklists
│   ├── forms/               # Intake forms and questionnaires
│   └── guides/              # Intake procedure guides
├── firm-policies/
│   ├── billing/             # Fee and billing policies
│   ├── ethics/              # Confidentiality, conflicts
│   └── operations/          # File retention, IT policies
├── litigation/
│   ├── motions/             # Motion checklists and templates
│   ├── discovery/           # Discovery checklists
│   └── trial-prep/          # Trial preparation materials
└── estate-planning/
    ├── documents/           # Will and trust templates
    ├── guides/              # Planning guides
    └── checklists/          # Estate planning checklists
```

---

## Document Inventory

### Contracts

| Document | Location | Lines | RAG Type |
|----------|----------|-------|----------|
| Standard NDA Template | `contracts/templates/` | 600+ | hybrid |
| Engagement Letter Template | `contracts/templates/` | 800+ | hybrid |
| Master Services Agreement | `contracts/templates/` | 750+ | hybrid |
| Master Clause Library | `contracts/clause-library/` | 1200+ | hybrid |

### Firm Policies

| Document | Location | Lines | RAG Type |
|----------|----------|-------|----------|
| Fee Agreement Policy | `firm-policies/billing/` | 850+ | attributed |
| Client Confidentiality Policy | `firm-policies/ethics/` | 1200+ | attributed |
| Conflict of Interest Policy | `firm-policies/ethics/` | 200+ | attributed |

### Litigation

| Document | Location | Lines | RAG Type |
|----------|----------|-------|----------|
| Motion to Dismiss Checklist | `litigation/motions/` | 150+ | cross-reference |
| Written Discovery Checklist | `litigation/discovery/` | 650+ | cross-reference |

### Client Intake

| Document | Location | Lines | RAG Type |
|----------|----------|-------|----------|
| Personal Injury Intake Checklist | `client-intake/checklists/` | 1300+ | temporal |

### Estate Planning

| Document | Location | Lines | RAG Type |
|----------|----------|-------|----------|
| Basic Estate Plan Guide | `estate-planning/guides/` | 200+ | attributed |

---

## RAG Demo Scenarios

### Scenario 1: Attributed RAG (Firm Policies)
**Query**: "What are our billing policies for contingency fee matters?"
**Expected**: Sections from Fee Agreement Policy with document ID, section, and subsection citations

### Scenario 2: Hybrid Search (Contracts)
**Query**: "Find all clauses related to indemnification"
**Expected**: Exact match on "indemnification" keyword PLUS semantically similar clauses about liability protection

### Scenario 3: Cross-Reference RAG (Litigation)
**Query**: "What discovery needs to happen before a motion to dismiss?"
**Expected**: Discovery checklist sections PLUS motion to dismiss timeline with cross-references identified

### Scenario 4: Temporal RAG (Client Intake)
**Query**: "What changed in our PI intake process?"
**Expected**: Version comparison showing additions, removals, and modifications between versions

---

## Document Features for RAG

All documents include:
- **Document ID**: Unique identifier for attribution
- **Version**: For temporal tracking
- **Cross-References**: Links to related documents
- **Section Hierarchy**: Deep structure (H1 > H2 > H3 > H4) for section-aware chunking
- **Legal Terminology**: Specific legal terms for keyword matching
- **Revision History**: For temporal RAG demonstration

---

## Sample Queries

Once loaded into a RAG agent, test with:

### Basic Retrieval
- "What are the key terms in our standard NDA?"
- "What is included in our estate planning package?"
- "What are our billing rates for litigation matters?"

### Attributed Retrieval
- "What is our policy on client confidentiality? Include section references."
- "Cite the firm policy on conflict waivers."

### Hybrid Search
- "Find contract clauses about force majeure and impossibility of performance"
- "Show me all references to trade secrets in our templates"

### Cross-Reference Retrieval
- "What are all the documents related to new client onboarding?"
- "Show me how our discovery checklist relates to motion practice"

### Temporal Retrieval
- "What changes were made to the PI intake checklist in version 2?"
- "Show me the evolution of our confidentiality policy"

---

## Technical Notes

### Chunking Strategy
- Recommended chunk size: 500-1000 tokens
- Preserve section hierarchy in metadata
- Include document ID and section path in each chunk

### Metadata Schema
```json
{
  "document_id": "FP-001",
  "document_title": "Fee Agreement Policy",
  "section_path": "Article II > Section 2.1 > 2.1.1",
  "section_title": "Standard Hourly Rates",
  "version": "3.2",
  "effective_date": "2026-01-05",
  "cross_references": ["FP-002", "CON-002"]
}
```

---

*Contact the RAG Development Team for integration questions.*
