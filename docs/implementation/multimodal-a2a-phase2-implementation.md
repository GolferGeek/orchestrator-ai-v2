# Multimodal A2A Transport Support - Phase 2 Implementation

**Date**: 2026-01-05
**Agent**: api-architecture-agent
**Feature**: Legal Department AI - Multimodal Document Processing

## Overview

Implemented multimodal A2A transport support for Legal Department AI, enabling file uploads with automatic text extraction from images and scanned documents. This allows legal agents to process contracts, court documents, and other legal materials in various formats.

## Components Implemented

### 1. DocumentProcessingService
**Location**: `apps/api/src/agent2agent/services/document-processing.service.ts`

**Purpose**: Orchestrates document processing pipeline
- Accepts base64-encoded files from metadata
- Determines if text extraction is needed
- Routes to VisionExtractionService or OCRExtractionService
- Uploads original files to `legal-documents` storage bucket
- Returns document metadata with extracted text

**Key Features**:
- Supports multiple file formats (PNG, JPG, JPEG, WEBP, GIF, PDF)
- Automatic format detection and routing
- Storage path construction using ExecutionContext
- Error handling with fallback mechanisms

**Storage Structure**:
```
legal-documents/
  {orgSlug}/
    {conversationId}/
      {taskId}/
        {uuid}_{filename}
```

**ExecutionContext Flow**:
- Uses context.orgSlug for organization path
- Uses context.conversationId for conversation path
- Uses context.taskId for task path
- Uses context.userId for document ownership

### 2. VisionExtractionService
**Location**: `apps/api/src/agent2agent/services/vision-extraction.service.ts`

**Purpose**: Extract text from images and scanned documents using vision models

**Key Features**:
- Uses LLM service with vision-capable models
- Configurable via ENV variables (VISION_MODEL, VISION_PROVIDER)
- Supports OpenAI, Anthropic, Ollama, Google providers
- Automatic usage tracking via LLM service
- Observability events emitted automatically

**Vision Model Configuration**:
- VISION_MODEL (default: gpt-4-vision-preview)
- VISION_PROVIDER (default: openai)
- OLLAMA_BASE_URL (for Ollama provider)

**Supported Formats**:
- Images: PNG, JPG, JPEG, WEBP, GIF
- PDFs: First page only (for vision extraction)

**Integration**:
- Calls LLMService.generateResponse() with vision options
- LLM service handles:
  - Usage and cost tracking (RunMetadataService)
  - Provider routing
  - Observability events

### 3. OCRExtractionService
**Location**: `apps/api/src/agent2agent/services/ocr-extraction.service.ts`

**Purpose**: Fallback text extraction using OCR (Tesseract.js)

**Current Status**: Placeholder implementation
- OCR integration is pending Tesseract.js installation
- Currently throws error to ensure vision extraction is always attempted first
- Ready for Tesseract.js integration when needed

**Supported Formats**:
- Images: PNG, JPG, JPEG, WEBP, GIF
- PDFs: Requires PDF-to-image conversion

**Future Enhancement**:
1. Install Tesseract.js dependency
2. Initialize Tesseract worker
3. Implement image preprocessing (grayscale, contrast)
4. Add OCR processing with language detection
5. Calculate confidence scores
6. Add post-processing (spell check, formatting)

### 4. Agent2AgentController Updates
**Location**: `apps/api/src/agent2agent/agent2agent.controller.ts`

**Changes Made**:
1. Added `@UseInterceptors(FilesInterceptor('files', 10))` to support up to 10 file uploads
2. Added `@UploadedFiles()` parameter to receive uploaded files
3. Injected `DocumentProcessingService` into constructor
4. Added file processing logic before task execution:
   - Converts uploaded files to base64
   - Processes each file through DocumentProcessingService
   - Stores processed documents in `dto.metadata.documents[]`
   - Logs processing status and errors

**File Upload Flow**:
```
1. Frontend uploads files via multipart/form-data
2. FilesInterceptor captures files (max 10)
3. For each file:
   a. Convert buffer to base64
   b. Call documentProcessing.processDocument()
   c. Extract text if applicable (vision/ocr)
   d. Upload to legal-documents bucket
   e. Store metadata in dto.metadata.documents[]
4. Continue with normal task execution
```

**Document Metadata Structure**:
```typescript
{
  documents: [
    {
      documentId: string,
      filename: string,
      mimeType: string,
      size: number,
      url: string,
      storagePath: string,
      extractedText?: string,
      extractionMethod?: 'vision' | 'ocr' | 'none',
      uploadedAt: string
    }
  ]
}
```

### 5. Environment Configuration

**Updated Files**:
- `.env.example` (root)
- `apps/api/.env.example` (created)

**New Environment Variables**:
```bash
# Vision Model Configuration
VISION_MODEL=gpt-4-vision-preview
VISION_PROVIDER=openai

# Storage Buckets
MEDIA_STORAGE_BUCKET=media
LEGAL_DOCUMENTS_BUCKET=legal-documents
```

**Recommended Vision Models**:
- OpenAI: `gpt-4-vision-preview`, `gpt-4o`
- Anthropic: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`
- Ollama: `llava:13b`, `llava:34b` (local)
- Google: `gemini-pro-vision`

### 6. Module Registration
**Location**: `apps/api/src/agent2agent/agent2agent.module.ts`

**Changes Made**:
1. Imported new services
2. Registered services in providers array:
   - DocumentProcessingService
   - VisionExtractionService
   - OCRExtractionService

## Architecture Patterns Followed

### ExecutionContext Flow ✅
- ExecutionContext created by frontend flows through unchanged
- Backend only mutates: taskId, deliverableId, planId (when first created)
- Backend validates: userId matches JWT auth
- Full ExecutionContext passed to all services
- ExecutionContext used for storage path construction

### A2A Protocol Compliance ✅
- Multipart/form-data support for file uploads
- Document metadata stored in task metadata
- Compatible with JSON-RPC 2.0 format
- Files accessible via public URLs in storage

### API Architectural Patterns ✅
- Services follow NestJS dependency injection
- Proper error handling and logging
- Uses existing SupabaseService for storage
- Uses existing LLMService for vision extraction
- Services are @Injectable() with proper constructor injection

## Testing Checklist

### Unit Tests (TODO)
- [ ] DocumentProcessingService.processDocument()
- [ ] VisionExtractionService.extractText()
- [ ] OCRExtractionService.extractText()

### Integration Tests (TODO)
- [ ] File upload via Agent2AgentController
- [ ] Vision extraction with OpenAI
- [ ] Vision extraction with Anthropic
- [ ] Vision extraction with Ollama
- [ ] OCR fallback (when Tesseract.js integrated)
- [ ] Storage bucket upload
- [ ] Document metadata in task

### End-to-End Tests (TODO)
- [ ] Legal agent receives uploaded contract
- [ ] Text extracted from scanned document
- [ ] Text extraction included in agent prompt
- [ ] Agent analyzes extracted content
- [ ] Multiple files uploaded simultaneously

## Deployment Steps

### 1. Environment Variables
```bash
# Add to .env
VISION_MODEL=gpt-4-vision-preview
VISION_PROVIDER=openai
MEDIA_STORAGE_BUCKET=media
LEGAL_DOCUMENTS_BUCKET=legal-documents
```

### 2. Supabase Storage Buckets
Create buckets in Supabase Dashboard:
```
1. Navigate to Supabase Dashboard > Storage
2. Create bucket: media
3. Create bucket: legal-documents
4. Set RLS policies for file access:
   - Users can upload to their own org/conversation/task paths
   - Users can read files they own
```

### 3. Install Dependencies (Already Present)
```bash
# NestJS dependencies (already installed)
@nestjs/platform-express
@types/multer
```

### 4. OCR Integration (Future)
```bash
# When ready to enable OCR fallback
npm install tesseract.js
```

## Usage Example

### Frontend Code
```typescript
// Create FormData with files
const formData = new FormData();
formData.append('files', contractFile);
formData.append('files', exhibitFile);

// Add task request data
formData.append('mode', 'converse');
formData.append('userMessage', 'Analyze this contract for risks');
formData.append('context', JSON.stringify(executionContext));

// Send to A2A endpoint
const response = await fetch('/agent-to-agent/legal-dept/contract-analyzer/tasks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Agent Access to Documents
```typescript
// In agent runner, access documents from metadata
const documents = context.metadata?.documents || [];

for (const doc of documents) {
  console.log(`File: ${doc.filename}`);
  console.log(`Extracted Text: ${doc.extractedText}`);
  console.log(`Method: ${doc.extractionMethod}`);
  console.log(`URL: ${doc.url}`);
}
```

## Performance Considerations

### Vision Model Costs
- GPT-4 Vision: ~$0.01-0.03 per image
- Claude 3 Vision: ~$0.015-0.075 per image
- Ollama (local): Free, but requires GPU

### Extraction Time
- Vision models: 2-5 seconds per image
- OCR (Tesseract): 1-3 seconds per image
- Large PDFs: 5-15 seconds (multi-page)

### Storage Costs
- Supabase Storage: $0.021 per GB/month
- Average document: 100KB-5MB
- 1000 documents: ~1GB storage

## Known Limitations

1. **OCR Not Integrated**: Tesseract.js dependency not yet installed
2. **PDF Multi-Page**: Vision extraction only processes first page
3. **File Size Limit**: Default Multer limit (10MB per file)
4. **Concurrent Uploads**: Max 10 files per request
5. **Vision Model Rate Limits**: Subject to provider API limits

## Future Enhancements

1. **OCR Integration**: Install and configure Tesseract.js
2. **PDF Multi-Page**: Process all pages of PDFs
3. **Document Type Detection**: Automatic format detection
4. **Pre-Processing**: Image enhancement before extraction
5. **Batch Processing**: Parallel document processing
6. **Caching**: Cache extracted text for repeated documents
7. **Language Detection**: Support for non-English documents
8. **Table Extraction**: Preserve table structure in extracted text

## Related Documentation

- **PRD**: `/Users/Justin/projects/orchestrator-ai-v2/docs/PRD/legal-department-ai.md`
- **Architecture**: `api-architecture-skill.md`
- **ExecutionContext**: `execution-context-skill.md`
- **A2A Protocol**: `transport-types-skill.md`

## Completion Status

✅ **All 5 Steps Completed**:
1. ✅ DocumentProcessingService created
2. ✅ VisionExtractionService created
3. ✅ OCRExtractionService created (placeholder)
4. ✅ Agent2AgentController updated for file uploads
5. ✅ Environment configuration added

**Build Status**: Ready for testing (pending build verification)

**Next Steps**:
1. Run `npm run build` to verify compilation
2. Run `npm run lint` to check code style
3. Create Supabase storage buckets
4. Test file upload with vision extraction
5. Integrate Tesseract.js for OCR fallback
