# Document Request Management with AI Extraction

**PRD Created:** 2026-01-05
**Status:** Draft
**Priority:** P1

## Overview

An AI system that processes client-submitted documents (medical records, financial statements, contracts, etc.), automatically classifies them, extracts key data points, flags missing information, and populates case management fields - all without sending sensitive client data to external clouds.

## Problem Statement

- Clients submit documents in various formats, often disorganized
- Staff spends hours manually reviewing, classifying, and data-entering
- Personal injury firms process thousands of pages of medical records per case
- Missing documents aren't discovered until late in the case
- Manual extraction is error-prone and inconsistent
- SaaS document processing requires uploading client PII to third-party servers

## Competitive Advantage

- **Self-hosted**: Client documents (medical records, financials) never leave firm's network
- **Local LLM vision models**: Can read and summarize scanned documents
- **Automated data entry**: Populate case management fields automatically
- **Missing document alerts**: Proactively identify gaps in documentation
- **High-volume processing**: Handle thousands of pages efficiently

## Target Use Cases

### Personal Injury
- Medical records extraction (diagnoses, treatments, providers, dates)
- Medical bills summarization
- Insurance correspondence parsing
- Police report data extraction

### Family Law
- Financial statement analysis
- Asset/debt inventories
- Income documentation

### Estate Planning
- Asset inventory from statements
- Beneficiary information extraction
- Prior document review

### Corporate/Transactional
- Due diligence document processing
- Contract data extraction
- Financial statement analysis

## Core Features

### 1. Document Intake Portal
- Secure upload interface for clients
- Bulk upload support
- Drag-and-drop interface
- Email-to-upload integration
- Mobile-friendly

### 2. Automatic Document Classification
- Identify document type:
  - Medical records
  - Medical bills
  - Insurance documents
  - Financial statements
  - Tax returns
  - Employment records
  - Police/incident reports
  - Contracts
  - Correspondence
  - ID documents
  - Other

### 3. AI Data Extraction

**Medical Records:**
- Provider name and contact
- Dates of service
- Diagnoses (ICD codes)
- Procedures (CPT codes)
- Treating physicians
- Medications prescribed
- Referrals made
- Prognosis notes

**Medical Bills:**
- Provider name
- Date of service
- Amount billed
- Amount paid
- Balance due
- Insurance adjustments

**Financial Documents:**
- Account holder
- Institution
- Account type
- Balance/value
- Date of statement
- Transactions (if relevant)

### 4. Missing Document Detection
- Compare received documents against checklist
- Alert staff to missing items
- Send automated requests to clients
- Track document request status

### 5. Case Management Integration
- Auto-populate case fields
- Create provider lists
- Generate treatment timelines
- Calculate medical specials
- Update matter status

### 6. Quality Assurance
- Confidence scores on extractions
- Flag low-confidence items for human review
- HITL checkpoint for sensitive data
- Audit trail of extractions

## Technical Architecture

### LangGraph Workflow

```
[Document Upload] → [OCR/Text Extract] → [Classify Document]
                                               ↓
                                      [Route by Type]
                                     /      |       \
                               Medical   Financial   Legal
                                   \       |       /
                                [Type-Specific Extraction]
                                           ↓
                                [Validation & Confidence Scoring]
                                           ↓
                                [HITL Review if Low Confidence]
                                           ↓
                                [Store Extracted Data]
                                           ↓
                                [Update Case Management]
                                           ↓
                                [Check for Missing Documents]
                                           ↓
                                [Alert/Request if Gaps Found]
```

### Vision Model Requirements

For scanned documents:
- Local vision model (LLaVA, Qwen-VL, etc.)
- OCR fallback for text extraction
- Table extraction for bills/statements
- Handwriting recognition (where possible)

## Data Schema

```typescript
interface ProcessedDocument {
  id: string;
  matterId: string;
  clientId: string;

  // Classification
  documentType: DocumentType;
  subType?: string;
  confidence: number;

  // Source
  originalFilename: string;
  uploadedAt: Date;
  uploadedBy: string;
  pageCount: number;

  // Extraction Results
  extractedData: ExtractedData;
  extractionConfidence: number;
  flaggedForReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;

  // Integration
  caseFieldsUpdated: string[];
  providerRecordCreated?: string;
}

interface MedicalRecordExtraction {
  provider: {
    name: string;
    address: string;
    phone: string;
    fax: string;
  };
  patient: {
    name: string;
    dob: Date;
    accountNumber: string;
  };
  visits: {
    date: Date;
    provider: string;
    chiefComplaint: string;
    diagnoses: string[];
    procedures: string[];
    medications: string[];
    notes: string;
    followUp: string;
  }[];
}

interface MedicalBillExtraction {
  provider: string;
  patient: string;
  accountNumber: string;
  statementDate: Date;
  lineItems: {
    dateOfService: Date;
    description: string;
    cptCode?: string;
    amountBilled: number;
    insurancePaid: number;
    adjustment: number;
    patientResponsibility: number;
  }[];
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
}
```

## Document Checklist System

```yaml
personal_injury_checklist:
  required:
    - police_report
    - insurance_declaration_page
    - medical_records_er
    - medical_bills
    - lost_wage_documentation

  recommended:
    - photos_of_injuries
    - photos_of_accident_scene
    - witness_statements
    - prior_medical_records

  triggers:
    if_surgery:
      - surgical_records
      - hospital_records
    if_ongoing_treatment:
      - recent_medical_records
    if_lost_wages:
      - employer_verification
      - pay_stubs
```

## Success Metrics

- 90%+ accuracy on document classification
- 85%+ accuracy on data extraction
- 70% reduction in manual data entry time
- 50% reduction in missing document discovery time
- Staff satisfaction with extraction quality

## Open Questions

1. How to handle multi-page documents with mixed content?
2. Retention policy for uploaded documents?
3. Client notification preferences for missing docs?
4. Integration with specific case management systems?
5. Handling illegible or poor-quality scans?

## Next Steps

1. [ ] Define complete data schemas by document type
2. [ ] Build document classification model/prompts
3. [ ] Build extraction prompts for medical records
4. [ ] Build extraction prompts for medical bills
5. [ ] Implement OCR/vision model integration
6. [ ] Create document checklist system
7. [ ] Build missing document alerting
8. [ ] Implement case management field mapping
9. [ ] Build HITL review interface
10. [ ] Test with sample client documents
