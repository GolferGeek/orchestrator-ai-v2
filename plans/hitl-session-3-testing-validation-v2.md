# HITL Refactoring Session 3: Testing & Validation (v2 - Deliverable-Centric)

## Goal
Validate the complete HITL flow end-to-end, handle edge cases, and ensure frontend integration works.

## Prerequisites
- Session 1 completed (transport types with taskId, HitlBaseStateAnnotation)
- Session 2 completed (API Runner HITL method handling)
- Supabase running
- LangGraph service running
- API service running
- Web frontend running

---

## Overview

This session covers:
1. End-to-end testing of all decision types
2. Error handling and edge cases
3. Frontend integration verification
4. Performance and concurrency testing
5. Documentation and cleanup

---

## Task 1: End-to-End Test Suite

### 1.1 Create E2E Test File

**File**: `apps/api/src/agent2agent/__tests__/hitl-e2e.spec.ts`

Note: Tests use the A2A endpoint with HITL methods, not a separate HITL controller.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('HITL E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let taskId: string;
  let deliverableId: string;
  const orgSlug = 'test-org';
  const agentSlug = 'extended-post-writer';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token for tests
    authToken = await getTestAuthToken();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to call A2A endpoint with JSON-RPC
  const callA2A = (method: string, params: any) => {
    return request(app.getHttpServer())
      .post(`/agent-to-agent/${orgSlug}/${agentSlug}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      });
  };

  describe('Complete HITL Flow', () => {
    it('should complete APPROVE flow', async () => {
      // 1. Start a task that triggers HITL
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about AI in healthcare' },
        mode: 'build',
      });

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.result.payload.status).toBe('hitl_waiting');

      taskId = startResponse.body.result.payload.taskId;
      deliverableId = startResponse.body.result.payload.deliverableId;

      expect(taskId).toBeDefined();
      expect(deliverableId).toBeDefined();

      // 2. Get status via A2A
      const statusResponse = await callA2A('hitl.status', {
        taskId,
      });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.result.payload.hitlPending).toBe(true);

      // 3. Resume with APPROVE via A2A
      const resumeResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(resumeResponse.status).toBe(200);
      expect(resumeResponse.body.result.payload.status).toBe('completed');

      // 4. Verify deliverable has one version via A2A
      const historyResponse = await callA2A('hitl.history', {
        taskId,
      });

      expect(historyResponse.body.result.payload.versionCount).toBe(1);
    });

    it('should complete REGENERATE flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about quantum computing' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Resume with REGENERATE
      const regenerateResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'regenerate',
        feedback: 'Make it shorter and more engaging',
      });

      expect(regenerateResponse.status).toBe(200);
      // Should return another HITL response for review
      expect(regenerateResponse.body.result.payload.status).toBe('hitl_waiting');

      // 3. Now approve
      const approveResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(approveResponse.status).toBe(200);

      // 4. Verify deliverable has two versions
      const historyResponse = await callA2A('hitl.history', { taskId });

      expect(historyResponse.body.result.payload.versionCount).toBe(2);
    });

    it('should complete REPLACE flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about machine learning' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Resume with REPLACE
      const replaceResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'replace',
        editedContent: {
          blogPost: '# My Custom Blog Post\n\nThis is my own content.',
          seoDescription: 'A custom SEO description',
          socialPosts: ['Check out my new post!'],
        },
      });

      expect(replaceResponse.status).toBe(200);

      // 3. Verify deliverable has user version via deliverablesService
      // (hitl.history only returns counts, use direct API for version details)
    });

    it('should complete REJECT flow', async () => {
      // Similar to REGENERATE but starts fresh
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about cloud computing' },
          mode: 'build',
        });

      taskId = startResponse.body.result.payload.taskId;

      const rejectResponse = await request(app.getHttpServer())
        .post(`/api/hitl/${taskId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'reject',
        });

      // Should regenerate and return HITL again
      expect(rejectResponse.body.payload.status).toBe('hitl_waiting');
    });

    it('should complete SKIP flow', async () => {
      const startResponse = await request(app.getHttpServer())
        .post('/api/agent2agent/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentSlug: 'extended-post-writer',
          message: 'Write about data science',
          mode: 'build',
        });

      taskId = startResponse.body.result.payload.taskId;

      const skipResponse = await request(app.getHttpServer())
        .post(`/api/hitl/${taskId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'skip',
        });

      // Should complete without creating new version
      expect(skipResponse.status).toBe(200);
    });
  });
});
```

---

## Task 2: Error Handling Tests

### 2.1 Validation Error Tests

```typescript
describe('HITL Validation Errors', () => {
  it('should reject REGENERATE without feedback', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        decision: 'regenerate',
        // Missing feedback
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('feedback');
  });

  it('should reject REPLACE without content', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        decision: 'replace',
        // Missing content
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('content');
  });

  it('should reject invalid decision', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        decision: 'invalid_decision',
      });

    expect(response.status).toBe(400);
  });

  it('should reject resume on non-pending thread', async () => {
    // First approve the thread
    await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ decision: 'approve' });

    // Try to resume again
    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ decision: 'approve' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('not pending');
  });
});
```

### 2.2 Authorization Error Tests

```typescript
describe('HITL Authorization Errors', () => {
  it('should reject unauthenticated request', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .send({ decision: 'approve' });

    expect(response.status).toBe(401);
  });

  it('should reject request from different user', async () => {
    const otherUserToken = await getOtherUserAuthToken();

    const response = await request(app.getHttpServer())
      .post(`/api/hitl/${taskId}/resume`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ decision: 'approve' });

    expect(response.status).toBe(403);
  });

  it('should return 404 for unknown thread', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/hitl/nonexistent-thread/status')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });
});
```

---

## Task 3: Edge Cases and Concurrency

### 3.1 Concurrent Resume Tests

```typescript
describe('HITL Concurrency', () => {
  it('should handle concurrent resume requests gracefully', async () => {
    // Start a task
    const startResponse = await request(app.getHttpServer())
      .post('/api/agent2agent/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        agentSlug: 'extended-post-writer',
        message: 'Write about concurrent systems',
        mode: 'build',
      });

    taskId = startResponse.body.result.payload.taskId;

    // Send two resume requests simultaneously
    const [response1, response2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/hitl/${taskId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ decision: 'approve' }),
      request(app.getHttpServer())
        .post(`/api/hitl/${taskId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ decision: 'approve' }),
    ]);

    // One should succeed, one should fail (or be idempotent)
    const successes = [response1, response2].filter(r => r.status === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle rapid regenerate cycles', async () => {
    const startResponse = await request(app.getHttpServer())
      .post('/api/agent2agent/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        agentSlug: 'extended-post-writer',
        message: 'Write about testing',
        mode: 'build',
      });

    taskId = startResponse.body.result.payload.taskId;

    // Regenerate 5 times rapidly
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post(`/api/hitl/${taskId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'regenerate',
          feedback: `Iteration ${i + 1}: make it better`,
        });

      expect(response.status).toBe(200);
    }

    // Verify we have 6 versions (1 original + 5 regenerations)
    const versionsResponse = await request(app.getHttpServer())
      .get(`/api/hitl/${taskId}/versions`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(versionsResponse.body.versions.length).toBe(6);
  });
});
```

---

## Task 4: Frontend Component Updates

### 4.1 Create HitlVersionSelector Component

**File**: `apps/web/src/components/hitl/HitlVersionSelector.vue`

```vue
<template>
  <div class="version-selector">
    <div class="version-header">
      <ion-icon :icon="timeOutline" />
      <span class="version-label">Version History</span>
      <ion-badge color="medium">{{ versions.length }}</ion-badge>
    </div>

    <div class="version-list">
      <div
        v-for="version in sortedVersions"
        :key="version.id"
        class="version-item"
        :class="{
          'version-item--current': version.isCurrentVersion,
          'version-item--selected': selectedVersionId === version.id
        }"
        @click="selectVersion(version)"
      >
        <div class="version-number">v{{ version.versionNumber }}</div>
        <div class="version-info">
          <div class="version-type">{{ formatCreationType(version.createdByType) }}</div>
          <div class="version-date">{{ formatDate(version.createdAt) }}</div>
        </div>
        <ion-icon
          v-if="version.isCurrentVersion"
          :icon="checkmarkCircleOutline"
          class="current-indicator"
        />
      </div>
    </div>

    <!-- Version comparison toggle -->
    <div v-if="versions.length > 1" class="compare-toggle">
      <ion-checkbox v-model="showComparison" />
      <span>Compare with previous</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon, IonBadge, IonCheckbox } from '@ionic/vue';
import { timeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import type { DeliverableVersion } from '@/services/deliverablesService';

interface Props {
  versions: DeliverableVersion[];
  selectedVersionId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [version: DeliverableVersion];
  compare: [enabled: boolean];
}>();

const showComparison = ref(false);

const sortedVersions = computed(() =>
  [...props.versions].sort((a, b) => b.versionNumber - a.versionNumber)
);

const selectVersion = (version: DeliverableVersion) => {
  emit('select', version);
};

const formatCreationType = (type: string): string => {
  const labels: Record<string, string> = {
    ai_response: '🤖 AI Generated',
    manual_edit: '✏️ Your Edit',
    ai_enhancement: '🔄 AI Regenerated',
    user_request: '👤 Requested',
  };
  return labels[type] || type;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Watch comparison toggle
import { watch } from 'vue';
watch(showComparison, (enabled) => emit('compare', enabled));
</script>

<style scoped>
.version-selector {
  background: var(--ion-color-step-50);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.version-header ion-icon {
  font-size: 1.25rem;
  color: var(--ion-color-primary);
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.version-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-color-step-100);
}

.version-item:hover {
  background: var(--ion-color-step-100);
}

.version-item--current {
  border-color: var(--ion-color-primary);
}

.version-item--selected {
  background: var(--ion-color-primary-tint);
}

.version-number {
  font-weight: 700;
  font-size: 0.9rem;
  min-width: 2.5rem;
}

.version-info {
  flex: 1;
}

.version-type {
  font-size: 0.85rem;
}

.version-date {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.current-indicator {
  color: var(--ion-color-primary);
  font-size: 1.25rem;
}

.compare-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-color-step-100);
  font-size: 0.85rem;
}
</style>
```

### 4.2 Update HitlApprovalModal with Version History

**File**: `apps/web/src/components/hitl/HitlApprovalModal.vue`

Add version history integration to the existing modal. Key changes:

1. Add version selector component import
2. Add version loading on modal open
3. Add version switching functionality
4. Show current version number in header

```typescript
// Add to imports
import HitlVersionSelector from './HitlVersionSelector.vue';
import { hitlService } from '@/services/hitlService';
import type { DeliverableVersion } from '@/services/deliverablesService';

// Add to Props interface
interface Props {
  // ... existing props ...
  deliverableId?: string;
  currentVersionNumber?: number;
  agentSlug?: string;
}

// Add to script setup
const versions = ref<DeliverableVersion[]>([]);
const selectedVersion = ref<DeliverableVersion | null>(null);
const isLoadingVersions = ref(false);

// Load versions when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.taskId && props.agentSlug) {
    isLoadingVersions.value = true;
    try {
      const { versions: loadedVersions } = await hitlService.getVersionHistory(
        props.agentSlug,
        props.taskId,
        conversationId // from parent context
      );
      versions.value = loadedVersions;
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      isLoadingVersions.value = false;
    }
  }
});

// Handle version selection
const handleVersionSelect = async (version: DeliverableVersion) => {
  selectedVersion.value = version;

  // Parse version content and update display
  if (version.content) {
    try {
      const content = JSON.parse(version.content);
      editedContent.blogPost = content.blogPost || '';
      editedContent.seoDescription = content.seoDescription || '';
      editedContent.socialPosts = Array.isArray(content.socialPosts)
        ? content.socialPosts.join('\n')
        : content.socialPosts || '';

      // Store as original for this version
      originalContent.blogPost = editedContent.blogPost;
      originalContent.seoDescription = editedContent.seoDescription;
      originalContent.socialPosts = editedContent.socialPosts;
    } catch (e) {
      console.error('Failed to parse version content:', e);
    }
  }
};
```

Add to template (after topic section, before content sections):

```vue
<!-- Version History (show if multiple versions exist) -->
<div v-if="versions.length > 1" class="version-section">
  <HitlVersionSelector
    :versions="versions"
    :selected-version-id="selectedVersion?.id"
    @select="handleVersionSelect"
  />
</div>

<!-- Current version indicator -->
<div v-if="currentVersionNumber" class="current-version-badge">
  Reviewing version {{ currentVersionNumber }}
  <span v-if="versions.length > 1">({{ versions.length }} total)</span>
</div>
```

Add styles:

```css
.version-section {
  margin-bottom: 1rem;
}

.current-version-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary-shade);
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
```

### 4.3 Add REGENERATE Decision to Modal

Update the action buttons section to include a Regenerate button:

```vue
<!-- Action Buttons - add regenerate option -->
<div class="action-buttons">
  <ion-button
    fill="outline"
    color="danger"
    @click="handleReject"
    :disabled="isSubmitting"
  >
    <ion-icon :icon="closeCircleOutline" slot="start" />
    Reject
  </ion-button>

  <ion-button
    fill="outline"
    color="warning"
    @click="handleRegenerate"
    :disabled="isSubmitting || !feedback.trim()"
    title="Add feedback above to regenerate"
  >
    <ion-icon :icon="refreshOutline" slot="start" />
    Regenerate
  </ion-button>

  <ion-button
    fill="outline"
    color="secondary"
    @click="handleEdit"
    :disabled="isSubmitting || !hasEdits"
  >
    <ion-icon :icon="createOutline" slot="start" />
    Use My Edits
  </ion-button>

  <ion-button
    fill="solid"
    color="success"
    @click="handleApprove"
    :disabled="isSubmitting"
  >
    <ion-icon :icon="checkmarkCircleOutline" slot="start" />
    Approve
  </ion-button>
</div>
```

Add regenerate handler:

```typescript
import { refreshOutline } from 'ionicons/icons';

const emit = defineEmits<{
  cancel: [];
  approve: [feedback?: string];
  edit: [editedContent: Partial<HitlGeneratedContent>, feedback?: string];
  reject: [feedback?: string];
  regenerate: [feedback: string];  // NEW
}>();

const handleRegenerate = async () => {
  if (!feedback.value.trim()) {
    // Show validation message
    return;
  }
  isSubmitting.value = true;
  try {
    emit('regenerate', feedback.value);
  } finally {
    isSubmitting.value = false;
  }
};
```

---

## Task 5: Frontend Integration Verification

### 5.1 Verify Response Format

Create a test to verify response format matches what frontend expects:

```typescript
describe('HITL Response Format', () => {
  it('should return correct HITL waiting response format', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/agent2agent/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        agentSlug: 'extended-post-writer',
        message: 'Write about APIs',
        mode: 'build',
      });

    const payload = response.body.payload;

    // Verify all required fields for frontend
    expect(payload).toHaveProperty('taskId');
    expect(payload).toHaveProperty('status', 'hitl_waiting');
    expect(payload).toHaveProperty('deliverableId');
    expect(payload).toHaveProperty('currentVersionNumber');
    expect(payload).toHaveProperty('message');
    expect(payload).toHaveProperty('generatedContent');

    // Verify generated content structure
    expect(payload.generatedContent).toHaveProperty('blogPost');
  });

  it('should return correct versions response format', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/hitl/${taskId}/versions`)
      .set('Authorization', `Bearer ${authToken}`);

    const payload = response.body;

    expect(payload).toHaveProperty('taskId');
    expect(payload).toHaveProperty('deliverableId');
    expect(payload).toHaveProperty('versions');
    expect(payload).toHaveProperty('currentVersionNumber');

    // Verify version structure
    if (payload.versions.length > 0) {
      const version = payload.versions[0];
      expect(version).toHaveProperty('id');
      expect(version).toHaveProperty('versionNumber');
      expect(version).toHaveProperty('createdByType');
      expect(version).toHaveProperty('isCurrentVersion');
      expect(version).toHaveProperty('createdAt');
    }
  });
});
```

### 4.2 Manual Frontend Testing Checklist

Create a checklist document for manual testing:

**File**: `apps/api/src/agent2agent/hitl/__tests__/MANUAL_TEST_CHECKLIST.md`

```markdown
# HITL Manual Testing Checklist

## Prerequisites
- [ ] API server running on port 6100
- [ ] LangGraph server running on port 6500
- [ ] Web frontend running on port 5173
- [ ] Logged in as test user

## Test Cases

### 1. Basic APPROVE Flow
- [ ] Start new conversation with extended-post-writer
- [ ] Send message: "Write a blog post about AI in healthcare"
- [ ] Verify HITL review panel appears
- [ ] Verify blog post content is displayed
- [ ] Click "Approve" button
- [ ] Verify workflow completes
- [ ] Verify deliverable is created

### 2. REGENERATE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Enter feedback: "Make it shorter"
- [ ] Click "Regenerate" button
- [ ] Verify new content is generated
- [ ] Verify version history shows 2 versions
- [ ] Approve and complete

### 3. REPLACE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Edit the content manually
- [ ] Click "Use My Version" button
- [ ] Verify workflow completes with user content
- [ ] Verify version history shows manual_edit type

### 4. Version History in Modal
- [ ] After multiple regenerations, versions appear in modal
- [ ] Version selector shows all versions with type labels
- [ ] Clicking a version switches the displayed content
- [ ] Current version is highlighted
- [ ] Version creation type is shown (AI Generated, Your Edit, etc.)
- [ ] Timestamps are displayed correctly

### 5. Error Handling
- [ ] Try to resume already completed thread
- [ ] Verify appropriate error message
- [ ] Try to regenerate without feedback
- [ ] Verify validation error appears

### 6. Session Persistence
- [ ] Start HITL workflow
- [ ] Refresh the page
- [ ] Verify HITL state is restored
- [ ] Complete the workflow
```

---

## Task 5: Performance Testing

### 5.1 Load Test Script

**File**: `apps/api/src/agent2agent/hitl/__tests__/hitl-load-test.ts`

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:6100/api';
const AUTH_TOKEN = 'your-test-token';
const CONCURRENT_USERS = 10;
const ITERATIONS = 5;

async function runHitlFlow(userId: number, iteration: number) {
  const start = Date.now();

  try {
    // Start task
    const startResponse = await axios.post(
      `${API_URL}/agent2agent/tasks`,
      {
        agentSlug: 'extended-post-writer',
        message: `Load test ${userId}-${iteration}`,
        mode: 'build',
      },
      { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
    );

    const taskId = startResponse.data.payload.taskId;

    // Resume with approve via A2A endpoint
    await axios.post(
      `${API_URL}/agent-to-agent/${orgSlug}/${agentSlug}/tasks`,
      {
        jsonrpc: '2.0',
        method: 'hitl.resume',
        params: { taskId, decision: 'approve' },
        id: Date.now(),
      },
      { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
    );

    const duration = Date.now() - start;
    console.log(`User ${userId} iteration ${iteration}: ${duration}ms`);

    return { success: true, duration };
  } catch (error) {
    console.error(`User ${userId} iteration ${iteration} failed:`, error);
    return { success: false, duration: Date.now() - start };
  }
}

async function runLoadTest() {
  console.log(`Starting load test: ${CONCURRENT_USERS} users, ${ITERATIONS} iterations`);

  const results: { success: boolean; duration: number }[] = [];

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const promises = [];
    for (let userId = 0; userId < CONCURRENT_USERS; userId++) {
      promises.push(runHitlFlow(userId, iteration));
    }

    const iterationResults = await Promise.all(promises);
    results.push(...iterationResults);

    console.log(`Iteration ${iteration + 1} complete`);
  }

  // Calculate statistics
  const successful = results.filter(r => r.success);
  const durations = successful.map(r => r.duration);

  console.log('\n=== Results ===');
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${results.length - successful.length}`);
  console.log(`Avg duration: ${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)}ms`);
  console.log(`Min duration: ${Math.min(...durations)}ms`);
  console.log(`Max duration: ${Math.max(...durations)}ms`);
}

runLoadTest();
```

---

## Task 6: Documentation and Cleanup

### 6.1 Update API Documentation

Update Swagger/OpenAPI documentation for HITL endpoints.

### 6.2 Remove Old HITL Code

Remove deprecated HITL code that's no longer needed:

```typescript
// Files to review for cleanup:
// - apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts
//   (may have redundant code)
// - Any workflow-specific version tracking code
```

### 6.3 Create HITL Developer Guide

**File**: `docs/hitl-developer-guide.md`

```markdown
# HITL Developer Guide

## Overview
This guide explains how to add HITL (Human-in-the-Loop) review to your LangGraph workflows.

## Architecture
- **API Runner** handles all HITL logic (detection, deliverable creation, versioning)
- **LangGraph** just calls `interrupt()` when review is needed
- **Deliverables** are the version system - no separate tracking needed

## Adding HITL to a New Workflow

### 1. Extend HitlBaseState
```typescript
import { HitlBaseStateAnnotation } from '../../hitl/hitl-base.state';

const MyWorkflowStateAnnotation = Annotation.Root({
  ...HitlBaseStateAnnotation.spec,
  // Add your domain fields
  myContent: Annotation<string>({ ... }),
});
```

### 2. Add HITL Interrupt Node
```typescript
async function hitl_interrupt(state) {
  return interrupt({
    reason: 'human_review',
    nodeName: 'hitl_interrupt',
    content: { myContent: state.myContent },
    message: 'Please review the content',
  });
}
```

### 3. Add Routing After HITL
```typescript
function route_after_hitl(state) {
  switch (state.hitlDecision) {
    case 'approve':
    case 'skip':
    case 'replace':
      return 'next_node';
    case 'reject':
    case 'regenerate':
      return 'generate_node';
  }
}
```

## Decision Types
| Decision | When to Use | Creates Version |
|----------|-------------|-----------------|
| approve | Accept as-is | No |
| regenerate | AI tries again with feedback | Yes (AI_ENHANCEMENT) |
| replace | User provides own content | Yes (MANUAL_EDIT) |
| reject | Start over | Yes (AI_RESPONSE) |
| skip | Auto-approve | No |
```

---

## Success Criteria

### Backend
1. [ ] All E2E tests pass
2. [ ] Validation error tests pass
3. [ ] Authorization tests pass
4. [ ] Concurrency tests pass
5. [ ] Response format matches frontend expectations
6. [ ] Load test shows acceptable performance
7. [ ] Old HITL code cleaned up
8. [ ] All builds pass: `npm run build`

### Frontend
9. [ ] HitlVersionSelector component created and working
10. [ ] HitlApprovalModal displays version history
11. [ ] User can switch between versions in modal
12. [ ] Regenerate button works with feedback
13. [ ] hitlService version methods integrated
14. [ ] Manual testing checklist completed
15. [ ] Documentation updated

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/api/src/agent2agent/hitl/__tests__/hitl-e2e.spec.ts` | E2E tests |
| `apps/api/src/agent2agent/hitl/__tests__/MANUAL_TEST_CHECKLIST.md` | Manual test checklist |
| `apps/api/src/agent2agent/hitl/__tests__/hitl-load-test.ts` | Load test script |
| `apps/web/src/components/hitl/HitlVersionSelector.vue` | Version history selector component |
| `docs/hitl-developer-guide.md` | Developer documentation |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/components/hitl/HitlApprovalModal.vue` | Add version history, regenerate button |
| `apps/web/src/services/hitlService.ts` | Add version history methods |
| Various | Cleanup deprecated HITL code |

---

## Rollout Plan

1. **Week 1**: Deploy behind feature flag, test with internal team
2. **Week 2**: Enable for 10% of new conversations, monitor errors
3. **Week 3**: Enable for 100% of new conversations
4. **Week 4**: Remove feature flag and legacy code paths
