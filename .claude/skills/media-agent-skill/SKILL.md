---
description: How to build media agents - agents that generate images, videos, or audio content. Use when building media agents, configuring media generation, or registering media agents in the database.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Media Agent Skill

## Purpose

This skill enables agents to build media agents - agents that generate images, videos, or audio content using specialized LLM provider APIs.

## When to Use

- **Building Media Agents**: When creating new media generation agents
- **Media Configuration**: When configuring image/video/audio generation
- **Agent Definition**: When defining media agent structure
- **Database Registration**: When registering media agents in the database

## Core Principles

### 1. Media Agent Characteristics

**Media Generation:**
- Generates images (DALL-E, Midjourney, Stable Diffusion, etc.)
- Generates videos (Runway, Pika, etc.)
- Generates audio (ElevenLabs, etc.)

**LLM Service Integration:**
- Uses LLM service for media generation
- Media generation via specialized provider APIs
- Automatic media storage in Supabase assets table

**Storage and Delivery:**
- Media stored in `assets` table
- Media linked to deliverable versions
- Media URLs returned in responses

### 2. Database Structure

**Required Fields:**
- `agent_type: 'media'`
- `context: string` - Markdown context file content
- `llm_config: JsonObject` - LLM provider, model for media generation
- `endpoint: null` - Media agents use LLM service directly
- `metadata: JsonObject` - Media type configuration

**Media Metadata:**
```typescript
{
  metadata: {
    mediaType: 'image' | 'video' | 'audio',
    storageConfig: {
      bucket: 'media-assets',
      public: true,
    },
  },
}
```

### 3. Media Types

**Image Generation:**
- Models: DALL-E 3, Midjourney, Stable Diffusion
- Formats: PNG, JPEG, WebP
- Sizes: 1024x1024, 1792x1024, etc.

**Video Generation:**
- Models: Runway Gen-2, Pika, etc.
- Formats: MP4, MOV
- Durations: 5s, 10s, etc.

**Audio Generation:**
- Models: ElevenLabs, etc.
- Formats: MP3, WAV
- Voices: Various voice options

## Agent Definition Pattern

### Image Generation Agent

```typescript
{
  slug: 'image-generator',
  organization_slug: ['demo-org'],
  name: 'Image Generator',
  description: 'Generates images from text prompts',
  agent_type: 'media',
  department: 'creative',
  tags: ['image', 'generation'],
  io_schema: {
    input: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        size: { type: 'string', enum: ['1024x1024', '1792x1024'] },
      },
      required: ['prompt'],
    },
    output: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        assetId: { type: 'string' },
      },
    },
  },
  capabilities: ['image-generation'],
  context: '# Image Generator\n\nGenerates high-quality images...',
  llm_config: {
    provider: 'openai',
    model: 'dall-e-3',
  },
  endpoint: null,
  metadata: {
    mediaType: 'image',
    storageConfig: {
      bucket: 'media-assets',
      public: true,
    },
  },
}
```

### Video Generation Agent

```typescript
{
  slug: 'video-generator',
  agent_type: 'media',
  context: '# Video Generator\n\nGenerates videos from prompts...',
  llm_config: {
    provider: 'runway',
    model: 'gen-2',
  },
  metadata: {
    mediaType: 'video',
    videoConfig: {
      duration: 5,
      format: 'mp4',
    },
  },
}
```

## Execution Flow

### BUILD Mode

1. **Generate Media**:
   - Call LLM service with media generation request
   - Provider-specific media generation API
   - Wait for media generation completion

2. **Store Media**:
   - Upload media to Supabase storage
   - Create asset record in `assets` table
   - Link asset to deliverable version

3. **Return Response**:
   - Return media URL
   - Return asset ID
   - Include metadata

## Database Registration

### Registration Pattern

```typescript
await agentsRepository.upsert({
  slug: 'image-generator',
  organization_slug: ['demo-org'],
  name: 'Image Generator',
  description: 'Generates images',
  agent_type: 'media',
  department: 'creative',
  tags: ['image'],
  io_schema: { /* schema */ },
  capabilities: ['image-generation'],
  context: '# Image Generator\n\n...',
  llm_config: {
    provider: 'openai',
    model: 'dall-e-3',
  },
  endpoint: null, // Media agents use LLM service directly
  metadata: {
    mediaType: 'image',
  },
});
```

## Common Patterns

### Image Generator

```typescript
{
  slug: 'image-generator',
  agent_type: 'media',
  context: '# Image Generator\n\nCreates images from text...',
  llm_config: {
    provider: 'openai',
    model: 'dall-e-3',
  },
  metadata: {
    mediaType: 'image',
  },
}
```

### Video Generator

```typescript
{
  slug: 'video-generator',
  agent_type: 'media',
  context: '# Video Generator\n\nCreates videos from text...',
  llm_config: {
    provider: 'runway',
    model: 'gen-2',
  },
  metadata: {
    mediaType: 'video',
  },
}
```

## Violations

### ❌ Missing Media Type

```typescript
// ❌ WRONG: Media agents require media type
{
  agent_type: 'media',
  metadata: {}, // Missing mediaType
}
```

**✅ FIX: Provide media type**
```typescript
// ✅ CORRECT: Media agents require media type
{
  agent_type: 'media',
  metadata: {
    mediaType: 'image', // REQUIRED
  },
}
```

### ❌ Using Endpoint for Media Agent

```typescript
// ❌ WRONG: Media agents use LLM service directly
{
  agent_type: 'media',
  endpoint: { url: '...' }, // WRONG
}
```

**✅ FIX: Endpoint must be null**
```typescript
// ✅ CORRECT: Media agents use LLM service directly
{
  agent_type: 'media',
  endpoint: null, // CORRECT
}
```

## Related

- **`agent-builder-agent.md`** - Main orchestrator
- **`execution-context-skill/`** - ExecutionContext validation
- **`transport-types-skill/`** - A2A compliance

