# Case Law Research Extractor

**PRD Created:** 2026-01-05
**Status:** Draft
**Priority:** P1

## Overview

An AI system that transforms unstructured legal case documents (PDFs, court filings, depositions) into structured, searchable data - building a proprietary knowledge base that becomes a competitive advantage for the firm.

## Problem Statement

- Law firms accumulate massive archives of case files they can't effectively search
- Westlaw/Lexis charge $500-2000/month per attorney and don't index firm-specific documents
- SaaS solutions require uploading sensitive case documents to third-party clouds
- Manual research is time-consuming and inconsistent
- Institutional knowledge leaves when attorneys depart

## Competitive Advantage

- **Self-hosted**: Case documents never leave the firm's network
- **Proprietary data**: Build searchable index of firm's own cases, briefs, memos
- **Local processing**: Extract insights without cloud dependency
- **Cumulative value**: Knowledge base grows more valuable over time

## Core Features

### 1. Document Ingestion
- Accept PDF, DOCX, TXT formats
- Batch upload capability
- OCR for scanned documents
- Preserve document metadata (date, court, case number)

### 2. Case Document Classification
- Automatically identify document type:
  - Court opinions
  - Pleadings (complaints, answers, motions)
  - Discovery documents
  - Depositions
  - Briefs and memoranda
  - Contracts/exhibits
  - Correspondence

### 3. Entity Extraction
- Parties (plaintiffs, defendants, third parties)
- Attorneys and law firms
- Judges
- Courts and jurisdictions
- Case numbers and citations
- Dates (filing, hearing, decision)
- Monetary amounts

### 4. Legal Concept Extraction
- Claims and causes of action
- Legal theories
- Key holdings
- Procedural posture
- Outcome/disposition
- Damages awarded
- Settlement terms (if disclosed)

### 5. Citation Network
- Extract case citations
- Build citation graph
- Identify frequently cited authorities
- Track citation treatment (followed, distinguished, overruled)

### 6. Structured Output
- Standardized JSON schema for all extracted data
- Searchable database entries
- Vector embeddings for semantic search
- Integration with RAG collections

### 7. Research Interface
- Natural language queries
- Filtered search (by date, court, outcome, etc.)
- Similar case finder
- Precedent chain visualization

## Technical Architecture

### Option A: LangGraph Workflow

```
[Upload] → [OCR/Extract Text] → [Classify Document]
                                       ↓
                               [Route by Type]
                              /       |       \
                         Opinion   Pleading   Discovery
                             \       |       /
                              [Entity Extraction]
                                      ↓
                              [Legal Concept Extraction]
                                      ↓
                              [Citation Extraction]
                                      ↓
                              [Generate Structured Output]
                                      ↓
                              [Store in Database + RAG]
```

### Option B: RAG Agent + Processing Pipeline

- Background job processes uploaded documents
- RAG agent queries the processed knowledge base
- Simpler but less control over extraction quality

**Recommendation: LangGraph** - Better control over multi-step extraction and quality

## Data Schema

```typescript
interface CaseDocument {
  id: string;
  documentType: 'opinion' | 'pleading' | 'discovery' | 'brief' | 'deposition' | 'other';

  // Metadata
  title: string;
  court: string;
  jurisdiction: string;
  caseNumber: string;
  filingDate: Date;
  decisionDate?: Date;

  // Parties
  parties: {
    plaintiffs: string[];
    defendants: string[];
    thirdParties: string[];
  };

  // Legal Team
  attorneys: {
    name: string;
    firm: string;
    representing: string;
  }[];
  judge?: string;

  // Legal Content
  claimsAndCauses: string[];
  legalTheories: string[];
  keyHoldings: string[];
  proceduralPosture: string;
  outcome: string;
  damagesAwarded?: number;

  // Citations
  citedCases: {
    citation: string;
    treatment: 'followed' | 'distinguished' | 'overruled' | 'cited';
  }[];

  // Full Text
  fullText: string;
  summary: string;

  // Embeddings
  embedding: number[];
}
```

## Sample Queries

Once built, users should be able to ask:

- "Find cases where we successfully argued statute of limitations defense"
- "What damages were awarded in our slip-and-fall cases?"
- "Show me briefs that cite Smith v. Jones"
- "What arguments did we use in employment discrimination cases?"
- "Find depositions mentioning product defect"

## Success Metrics

- 90%+ accuracy on document classification
- 85%+ accuracy on entity extraction
- Query response time < 3 seconds
- User adoption by 50%+ of attorneys within 3 months

## Open Questions

1. OCR quality for older scanned documents?
2. How to handle privileged vs. non-privileged documents?
3. Access control at document level?
4. Integration with existing document management systems?
5. Handling redacted documents?

## Next Steps

1. [ ] Define complete data schema
2. [ ] Build document classification prompt
3. [ ] Build entity extraction prompts
4. [ ] Build legal concept extraction prompts
5. [ ] Implement citation parser
6. [ ] Create database tables
7. [ ] Build LangGraph workflow
8. [ ] Implement search/query interface
9. [ ] Test with sample case documents
10. [ ] Build UI for research queries
