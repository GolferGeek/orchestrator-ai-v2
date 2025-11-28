# HITL Refactoring Session 3: Testing, Validation & Frontend (v2 - Deliverable-Centric)

## Goal
Validate the complete HITL flow end-to-end, handle edge cases, and create the modal-based frontend components with shared component architecture.

## Prerequisites
- Session 1 completed (transport types with taskId, HitlBaseStateAnnotation, hitl_pending migration)
- Session 2 completed (API Runner HITL method handling, `__interrupt__` detection)
- Supabase running with migration applied
- LangGraph service running
- API service running
- Web frontend running

---

## Overview

This session covers:
1. End-to-end testing of all decision types (using A2A endpoint consistently)
2. Error handling and edge cases
3. Create shared components (ContentViewer, ContentEditor, VersionSelector, etc.)
4. Create HitlReviewModal using shared components
5. Create DeliverablesModal using shared components
6. Create HitlPendingCard and DeliverableCard for conversation history
7. Create HitlPendingList for sidebar (queries **tasks** table via `hitl.pending`)
8. Implement auto-open behavior for modals
9. Manual testing and documentation

**Key Architecture Points**:
- `hitl_pending` is on **tasks** table (not conversations)
- `taskId` is the PRIMARY identifier for pending items
- Deliverables link to tasks via `task_id` column
- hitlPendingStore uses `taskId` as key for add/remove operations

---

## Task 1: End-to-End Test Suite

### 1.0 Test Infrastructure and Fixtures

**IMPORTANT**: Before running E2E tests, we need proper fixtures and mocking for deterministic results.

#### 1.0.1 Test Fixtures Helper

**File**: `apps/api/src/agent2agent/__tests__/fixtures/hitl-test-fixtures.ts`

```typescript
import { DataSource } from 'typeorm';

/**
 * HITL Test Fixtures
 * Creates deterministic test data for E2E tests
 */
export class HitlTestFixtures {
  constructor(private dataSource: DataSource) {}

  /**
   * Seed test organization and user
   */
  async seedTestUser(): Promise<{ userId: string; orgSlug: string; authToken: string }> {
    const userId = 'test-user-' + Date.now();
    const orgSlug = 'test-org';

    // Insert test user via Supabase auth or mock
    await this.dataSource.query(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
      VALUES ($1, $2, 'test', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [userId, `${userId}@test.com`]);

    // Insert organization membership
    await this.dataSource.query(`
      INSERT INTO organizations (slug, name)
      VALUES ($1, 'Test Organization')
      ON CONFLICT (slug) DO NOTHING
    `, [orgSlug]);

    // Generate test auth token (JWT)
    const authToken = await this.generateTestToken(userId);

    return { userId, orgSlug, authToken };
  }

  /**
   * Seed test agent definition
   */
  async seedTestAgent(orgSlug: string): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO agents (slug, name, organization_slug, mode, agent_type, is_active)
      VALUES ('extended-post-writer', 'Extended Post Writer', $1, 'hitl', 'langgraph', true)
      ON CONFLICT (slug, organization_slug) DO NOTHING
    `, [orgSlug]);
  }

  /**
   * Clean up test data after tests
   */
  async cleanup(userId: string): Promise<void> {
    // Delete in order respecting foreign keys
    await this.dataSource.query(`DELETE FROM deliverable_versions WHERE deliverable_id IN (SELECT id FROM deliverables WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1))`, [userId]);
    await this.dataSource.query(`DELETE FROM deliverables WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)`, [userId]);
    await this.dataSource.query(`DELETE FROM tasks WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)`, [userId]);
    await this.dataSource.query(`DELETE FROM conversations WHERE user_id = $1`, [userId]);
  }

  private async generateTestToken(userId: string): Promise<string> {
    // Use test JWT secret or Supabase test token generation
    // This should match your auth setup
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { sub: userId, role: 'authenticated' },
      process.env.SUPABASE_JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  }
}
```

#### 1.0.2 LangGraph Mock Service

**File**: `apps/api/src/agent2agent/__tests__/mocks/langgraph-mock.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import type { LangGraphInterruptResponse } from '@orchestrator-ai/transport-types';

/**
 * Mock LangGraph Service for deterministic E2E tests
 * Simulates LangGraph responses without actual LLM calls
 */
@Injectable()
export class LangGraphMockService {
  private resumeCount = 0;

  /**
   * Mock initial task execution - returns HITL interrupt
   */
  mockInitialExecution(taskId: string, topic: string): LangGraphInterruptResponse {
    return {
      __interrupt__: [{
        value: {
          reason: 'human_review',
          nodeName: 'hitl_interrupt',
          topic,
          content: {
            blogPost: `# Mock Blog Post about ${topic}\n\nThis is generated content for testing.`,
            seoDescription: `Learn about ${topic} in this comprehensive guide.`,
            socialPosts: [`Check out our new post about ${topic}!`],
          },
          message: 'Please review the generated content',
        },
        resumable: true,
        ns: ['extended-post-writer'],
      }],
      values: {
        taskId,
        topic,
        status: 'hitl_waiting',
      },
    };
  }

  /**
   * Mock resume with decision
   */
  mockResume(
    taskId: string,
    decision: string,
    feedback?: string,
  ): LangGraphInterruptResponse | { values: Record<string, unknown> } {
    this.resumeCount++;

    // For regenerate/reject, return another HITL interrupt
    if (decision === 'regenerate' || decision === 'reject') {
      return {
        __interrupt__: [{
          value: {
            reason: 'human_review',
            nodeName: 'hitl_interrupt',
            topic: 'Regenerated',
            content: {
              blogPost: `# Regenerated Blog Post (v${this.resumeCount})\n\nIncorporating feedback: ${feedback || 'N/A'}`,
              seoDescription: 'Regenerated SEO description.',
              socialPosts: ['Regenerated social post!'],
            },
            message: 'Please review the regenerated content',
          },
          resumable: true,
          ns: ['extended-post-writer'],
        }],
        values: {
          taskId,
          status: 'hitl_waiting',
        },
      };
    }

    // For approve/skip/replace, return completion (no __interrupt__)
    return {
      values: {
        taskId,
        status: 'completed',
        completedAt: Date.now(),
      },
    };
  }

  /**
   * Reset mock state between tests
   */
  reset(): void {
    this.resumeCount = 0;
  }
}
```

#### 1.0.3 Test Module Configuration

**File**: `apps/api/src/agent2agent/__tests__/hitl-e2e-test.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { LangGraphMockService } from './mocks/langgraph-mock.service';

/**
 * Test module that swaps real LangGraph calls with mocks
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      // Use test database
      type: 'postgres',
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false, // Use migrations
    }),
    HttpModule,
    // ... other necessary modules
  ],
  providers: [
    {
      provide: 'LANGGRAPH_SERVICE',
      useClass: LangGraphMockService,
    },
  ],
  exports: ['LANGGRAPH_SERVICE'],
})
export class HitlE2ETestModule {}
```

### 1.1 Create E2E Test File

**File**: `apps/api/src/agent2agent/__tests__/hitl-e2e.spec.ts`

**IMPORTANT**: All tests use the A2A endpoint with JSON-RPC methods - NOT separate REST endpoints.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { HitlE2ETestModule } from './hitl-e2e-test.module';
import { HitlTestFixtures } from './fixtures/hitl-test-fixtures';
import { LangGraphMockService } from './mocks/langgraph-mock.service';

describe('HITL E2E Tests (A2A Endpoint)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let fixtures: HitlTestFixtures;
  let langGraphMock: LangGraphMockService;
  let authToken: string;
  let userId: string;
  let taskId: string;
  let deliverableId: string;
  const orgSlug = 'test-org';
  const agentSlug = 'extended-post-writer';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HitlE2ETestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    langGraphMock = moduleFixture.get('LANGGRAPH_SERVICE');
    fixtures = new HitlTestFixtures(dataSource);

    // Seed test data
    const testUser = await fixtures.seedTestUser();
    userId = testUser.userId;
    authToken = testUser.authToken;
    await fixtures.seedTestAgent(orgSlug);
  });

  afterAll(async () => {
    await fixtures.cleanup(userId);
    await app.close();
  });

  beforeEach(() => {
    // Reset mock state between tests
    langGraphMock.reset();
  });

  /**
   * Helper to call A2A endpoint with JSON-RPC
   * ALL HITL operations use this pattern
   */
  const callA2A = (method: string, params: Record<string, unknown>) => {
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

  describe('Complete HITL Flows', () => {
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
      const statusResponse = await callA2A('hitl.status', { taskId });

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
      const historyResponse = await callA2A('hitl.history', { taskId });

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
        content: {
          blogPost: '# My Custom Blog Post\n\nThis is my own content.',
          seoDescription: 'A custom SEO description',
          socialPosts: ['Check out my new post!'],
        },
      });

      expect(replaceResponse.status).toBe(200);
      expect(replaceResponse.body.result.payload.status).toBe('completed');

      // 3. Verify deliverable has two versions (original + replacement)
      const historyResponse = await callA2A('hitl.history', { taskId });

      expect(historyResponse.body.result.payload.versionCount).toBe(2);
    });

    it('should complete REJECT flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about cloud computing' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Reject via A2A
      const rejectResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'reject',
      });

      expect(rejectResponse.status).toBe(200);
      // Should regenerate and return HITL again
      expect(rejectResponse.body.result.payload.status).toBe('hitl_waiting');

      // 3. Approve the new version
      const approveResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(approveResponse.status).toBe(200);
    });

    it('should complete SKIP flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about data science' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Skip via A2A (auto-approve)
      const skipResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'skip',
      });

      expect(skipResponse.status).toBe(200);
      expect(skipResponse.body.result.payload.status).toBe('completed');

      // Should not create new version
      const historyResponse = await callA2A('hitl.history', { taskId });
      expect(historyResponse.body.result.payload.versionCount).toBe(1);
    });
  });

  describe('HITL Pending List', () => {
    it('should return pending HITL items for user (taskId as primary identifier)', async () => {
      // Start a task but don't complete it
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about pending test' },
        mode: 'build',
      });

      const pendingTaskId = startResponse.body.result.payload.taskId;

      // Query pending list - this queries TASKS table, not conversations
      const pendingResponse = await callA2A('hitl.pending', {});

      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.body.result.payload.items).toBeInstanceOf(Array);
      expect(pendingResponse.body.result.payload.items.length).toBeGreaterThan(0);

      // Verify structure of pending item
      // NOTE: taskId is the PRIMARY identifier since hitl_pending is on tasks table
      const pendingItem = pendingResponse.body.result.payload.items.find(
        (item: any) => item.taskId === pendingTaskId
      );
      expect(pendingItem).toBeDefined();
      // taskId is first because it's the primary identifier
      expect(pendingItem.taskId).toBe(pendingTaskId);
      expect(pendingItem.agentSlug).toBe(agentSlug);
      expect(pendingItem.pendingSince).toBeDefined();
      // conversationId is for navigation, not the primary key
      expect(pendingItem.conversationId).toBeDefined();

      // Clean up - approve it
      await callA2A('hitl.resume', {
        taskId: pendingTaskId,
        decision: 'approve',
      });
    });
  });
});
```

### 1.2 Validation Error Tests

```typescript
describe('HITL Validation Errors (A2A Endpoint)', () => {
  it('should reject REGENERATE without feedback', async () => {
    // Start a task
    const startResponse = await callA2A('tasks/send', {
      message: { text: 'Write about validation test' },
      mode: 'build',
    });

    const taskId = startResponse.body.result.payload.taskId;

    // Try to regenerate without feedback
    const response = await callA2A('hitl.resume', {
      taskId,
      decision: 'regenerate',
      // Missing feedback
    });

    expect(response.status).toBe(200);
    expect(response.body.result.success).toBe(false);
    expect(response.body.result.error).toContain('feedback');
  });

  it('should reject REPLACE without content', async () => {
    // Start a task
    const startResponse = await callA2A('tasks/send', {
      message: { text: 'Write about replace test' },
      mode: 'build',
    });

    const taskId = startResponse.body.result.payload.taskId;

    // Try to replace without content
    const response = await callA2A('hitl.resume', {
      taskId,
      decision: 'replace',
      // Missing content
    });

    expect(response.status).toBe(200);
    expect(response.body.result.success).toBe(false);
    expect(response.body.result.error).toContain('content');
  });

  it('should reject missing taskId', async () => {
    const response = await callA2A('hitl.resume', {
      // Missing taskId
      decision: 'approve',
    });

    expect(response.status).toBe(200);
    expect(response.body.result.success).toBe(false);
    expect(response.body.result.error).toContain('taskId');
  });
});
```

### 1.3 Response Format Tests

```typescript
describe('HITL Response Format', () => {
  it('should return correct HITL waiting response format', async () => {
    const response = await callA2A('tasks/send', {
      message: { text: 'Write about APIs' },
      mode: 'build',
    });

    const payload = response.body.result.payload;

    // Verify all required fields for frontend
    expect(payload).toHaveProperty('taskId');
    expect(payload).toHaveProperty('conversationId');
    expect(payload).toHaveProperty('status', 'hitl_waiting');
    expect(payload).toHaveProperty('deliverableId');
    expect(payload).toHaveProperty('currentVersionNumber');
    expect(payload).toHaveProperty('message');
    expect(payload).toHaveProperty('generatedContent');

    // Verify generated content structure
    expect(payload.generatedContent).toHaveProperty('blogPost');
  });

  it('should return correct pending list item format', async () => {
    const response = await callA2A('hitl.pending', {});

    const payload = response.body.result.payload;

    expect(payload).toHaveProperty('items');
    expect(payload).toHaveProperty('totalCount');

    if (payload.items.length > 0) {
      const item = payload.items[0];
      expect(item).toHaveProperty('conversationId');
      expect(item).toHaveProperty('conversationTitle');
      expect(item).toHaveProperty('taskId');
      expect(item).toHaveProperty('agentSlug');
      expect(item).toHaveProperty('pendingSince');
    }
  });
});
```

---

## Task 2: Create Shared Components

### 2.1 ContentViewer Component

**File**: `apps/web/src/components/shared/ContentViewer.vue`

```vue
<template>
  <div class="content-viewer">
    <ion-segment v-model="activeTab" class="content-tabs">
      <ion-segment-button v-if="blogPost" value="blog">
        <ion-label>Blog Post</ion-label>
      </ion-segment-button>
      <ion-segment-button v-if="seoDescription" value="seo">
        <ion-label>SEO</ion-label>
      </ion-segment-button>
      <ion-segment-button v-if="socialPosts?.length" value="social">
        <ion-label>Social</ion-label>
      </ion-segment-button>
    </ion-segment>

    <div class="content-panel" :class="{ 'is-loading': loading }">
      <ion-spinner v-if="loading" name="crescent" />

      <template v-else>
        <!-- Blog Post Tab -->
        <div v-if="activeTab === 'blog'" class="markdown-content">
          <div v-html="renderedBlogPost" />
        </div>

        <!-- SEO Tab -->
        <div v-if="activeTab === 'seo'" class="seo-content">
          <h4>SEO Description</h4>
          <p>{{ seoDescription }}</p>
          <div class="char-count">
            {{ seoDescription?.length || 0 }} / 160 characters
          </div>
        </div>

        <!-- Social Tab -->
        <div v-if="activeTab === 'social'" class="social-content">
          <div
            v-for="(post, index) in socialPosts"
            :key="index"
            class="social-post"
          >
            <div class="post-header">Post {{ index + 1 }}</div>
            <div class="post-content">{{ post }}</div>
            <div class="char-count">{{ post.length }} characters</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonSegment, IonSegmentButton, IonLabel, IonSpinner } from '@ionic/vue';
import { marked } from 'marked';
import type { ContentViewerProps } from './types';

const props = withDefaults(defineProps<ContentViewerProps>(), {
  initialTab: 'blog',
  loading: false,
});

const activeTab = ref(props.initialTab);

// Set initial tab based on available content
watch(
  () => [props.blogPost, props.seoDescription, props.socialPosts],
  () => {
    if (!props.blogPost && props.seoDescription) {
      activeTab.value = 'seo';
    } else if (!props.blogPost && !props.seoDescription && props.socialPosts?.length) {
      activeTab.value = 'social';
    }
  },
  { immediate: true }
);

const renderedBlogPost = computed(() => {
  if (!props.blogPost) return '';
  return marked(props.blogPost);
});
</script>

<style scoped>
.content-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content-tabs {
  margin-bottom: 1rem;
}

.content-panel {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: var(--ion-background-color);
  border-radius: 8px;
  border: 1px solid var(--ion-color-step-100);
}

.content-panel.is-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1) {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.markdown-content :deep(h2) {
  font-size: 1.5rem;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.markdown-content :deep(p) {
  margin-bottom: 1rem;
}

.seo-content h4 {
  margin-bottom: 0.5rem;
  color: var(--ion-color-medium);
}

.char-count {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-top: 0.5rem;
}

.social-post {
  background: var(--ion-color-step-50);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.post-header {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--ion-color-primary);
}

.post-content {
  white-space: pre-wrap;
}
</style>
```

### 2.2 VersionSelector Component

**File**: `apps/web/src/components/shared/VersionSelector.vue`

```vue
<template>
  <div class="version-selector">
    <div class="version-header">
      <ion-icon :icon="timeOutline" />
      <span class="version-label">Version History</span>
      <ion-badge color="medium">{{ versions.length }}</ion-badge>
    </div>

    <ion-spinner v-if="loading" name="dots" />

    <div v-else class="version-list">
      <div
        v-for="version in sortedVersions"
        :key="version.id"
        class="version-item"
        :class="{
          'version-item--current': version.isCurrentVersion,
          'version-item--selected': selectedVersionId === version.id,
        }"
        @click="selectVersion(version)"
      >
        <div class="version-number">v{{ version.versionNumber }}</div>
        <div class="version-info">
          <div class="version-type">
            {{ formatCreationType(version.createdByType) }}
          </div>
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
    <div v-if="showCompareToggle && versions.length > 1" class="compare-toggle">
      <ion-checkbox v-model="showComparison" />
      <span>Compare with previous</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonIcon, IonBadge, IonCheckbox, IonSpinner } from '@ionic/vue';
import { timeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import type { VersionSelectorProps, VersionSelectorEmits } from './types';
import type { DeliverableVersion } from '@/services/deliverablesService';

const props = withDefaults(defineProps<VersionSelectorProps>(), {
  showCompareToggle: false,
  loading: false,
});

const emit = defineEmits<VersionSelectorEmits>();

const showComparison = ref(false);

const sortedVersions = computed(() =>
  [...props.versions].sort((a, b) => b.versionNumber - a.versionNumber)
);

const selectVersion = (version: DeliverableVersion) => {
  emit('select', version);
};

const formatCreationType = (type: string): string => {
  const labels: Record<string, string> = {
    ai_response: 'AI Generated',
    manual_edit: 'Your Edit',
    ai_enhancement: 'AI Regenerated',
    user_request: 'Requested',
    llm_rerun: 'AI Rerun',
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
watch(showComparison, (enabled) => emit('compare', enabled));
</script>

<style scoped>
.version-selector {
  background: var(--ion-color-step-50);
  border-radius: 8px;
  padding: 0.75rem;
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

### 2.3 FeedbackInput Component

**File**: `apps/web/src/components/shared/FeedbackInput.vue`

```vue
<template>
  <div class="feedback-input">
    <ion-label v-if="label" class="feedback-label">{{ label }}</ion-label>
    <ion-textarea
      v-model="internalValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="3"
      :maxlength="maxLength"
      class="feedback-textarea"
      :class="{ 'feedback-textarea--required': required && !internalValue.trim() }"
    />
    <div class="feedback-footer">
      <span v-if="required && !internalValue.trim()" class="required-hint">
        Required for regeneration
      </span>
      <span v-if="maxLength" class="char-count">
        {{ internalValue.length }} / {{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonLabel, IonTextarea } from '@ionic/vue';
import type { FeedbackInputProps, FeedbackInputEmits } from './types';

const props = withDefaults(defineProps<FeedbackInputProps>(), {
  placeholder: 'Enter feedback for regeneration...',
  label: 'Feedback',
  disabled: false,
  required: false,
  maxLength: 500,
});

const emit = defineEmits<FeedbackInputEmits>();

const internalValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});
</script>

<style scoped>
.feedback-input {
  margin-bottom: 1rem;
}

.feedback-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.feedback-textarea {
  --background: var(--ion-color-step-50);
  --border-radius: 8px;
  --padding-start: 12px;
  --padding-end: 12px;
}

.feedback-textarea--required {
  --border-color: var(--ion-color-warning);
}

.feedback-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.required-hint {
  color: var(--ion-color-warning);
}

.char-count {
  color: var(--ion-color-medium);
}
</style>
```

---

## Task 3: Create HITL Review Modal

### 3.1 HitlReviewModal Component

**File**: `apps/web/src/components/hitl/HitlReviewModal.vue`

```vue
<template>
  <ion-modal
    :is-open="isOpen"
    :can-dismiss="!isSubmitting"
    @did-dismiss="handleClose"
    class="hitl-review-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>Review Content</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleClose" :disabled="isSubmitting">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Version Badge -->
      <div class="version-info">
        <VersionBadge
          :version-number="currentVersionNumber"
          :creation-type="currentCreationType"
          :is-current="true"
        />
        <span class="topic-label">{{ topic }}</span>
      </div>

      <!-- Version History (if multiple versions) -->
      <VersionSelector
        v-if="versions.length > 1"
        :versions="versions"
        :selected-version-id="selectedVersionId"
        :loading="isLoadingVersions"
        @select="handleVersionSelect"
        class="version-section"
      />

      <!-- Content Viewer/Editor Toggle -->
      <ion-segment v-model="viewMode" class="view-mode-toggle">
        <ion-segment-button value="view">
          <ion-label>View</ion-label>
        </ion-segment-button>
        <ion-segment-button value="edit">
          <ion-label>Edit</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Content Display -->
      <ContentViewer
        v-if="viewMode === 'view'"
        :blog-post="displayContent.blogPost"
        :seo-description="displayContent.seoDescription"
        :social-posts="displayContent.socialPosts"
        :loading="isLoading"
      />

      <!-- Content Editor -->
      <ContentEditor
        v-else
        v-model:blog-post="editedContent.blogPost"
        v-model:seo-description="editedContent.seoDescription"
        v-model:social-posts="editedContent.socialPosts"
        :disabled="isSubmitting"
        @change="hasEdits = true"
      />

      <!-- Feedback Input (for regenerate) -->
      <FeedbackInput
        v-model="feedback"
        label="Feedback for AI"
        placeholder="Describe what changes you'd like..."
        :required="false"
        :disabled="isSubmitting"
        class="feedback-section"
      />
    </ion-content>

    <ion-footer>
      <ion-toolbar>
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
            v-if="hasEdits"
            fill="outline"
            color="secondary"
            @click="handleReplace"
            :disabled="isSubmitting"
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
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/vue';
import {
  closeOutline,
  closeCircleOutline,
  refreshOutline,
  createOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import ContentViewer from '@/components/shared/ContentViewer.vue';
import ContentEditor from '@/components/shared/ContentEditor.vue';
import VersionSelector from '@/components/shared/VersionSelector.vue';
import VersionBadge from '@/components/shared/VersionBadge.vue';
import FeedbackInput from '@/components/shared/FeedbackInput.vue';
import { hitlService } from '@/services/hitlService';
import { deliverablesService } from '@/services/deliverablesService';
import { useHitlPendingStore } from '@/stores/hitlPendingStore';
import type { HitlGeneratedContent, HitlDeliverableResponse } from '@orchestrator-ai/transport-types';
import type { DeliverableVersion } from '@/services/deliverablesService';

interface Props {
  isOpen: boolean;
  organizationSlug: string;
  agentSlug: string;
  taskId: string;
  conversationId: string;
  deliverableId?: string;
  topic?: string;
  initialContent?: HitlGeneratedContent;
  currentVersionNumber?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  decision: [response: HitlDeliverableResponse];
}>();

const hitlPendingStore = useHitlPendingStore();

// State
const isSubmitting = ref(false);
const isLoading = ref(false);
const isLoadingVersions = ref(false);
const viewMode = ref<'view' | 'edit'>('view');
const feedback = ref('');
const hasEdits = ref(false);
const versions = ref<DeliverableVersion[]>([]);
const selectedVersionId = ref<string | undefined>();

// Content state
const displayContent = reactive<HitlGeneratedContent>({
  blogPost: '',
  seoDescription: '',
  socialPosts: [],
});

const editedContent = reactive<{
  blogPost: string;
  seoDescription: string;
  socialPosts: string;
}>({
  blogPost: '',
  seoDescription: '',
  socialPosts: '',
});

// Computed
const currentCreationType = computed(() => {
  const current = versions.value.find((v) => v.isCurrentVersion);
  return current?.createdByType || 'ai_response';
});

// Initialize content when modal opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      // Set initial content
      if (props.initialContent) {
        displayContent.blogPost = props.initialContent.blogPost || '';
        displayContent.seoDescription = props.initialContent.seoDescription || '';
        displayContent.socialPosts = props.initialContent.socialPosts || [];

        editedContent.blogPost = displayContent.blogPost;
        editedContent.seoDescription = displayContent.seoDescription;
        editedContent.socialPosts = displayContent.socialPosts.join('\n');
      }

      // Load versions if deliverable exists
      if (props.deliverableId) {
        await loadVersions();
      }

      // Reset state
      viewMode.value = 'view';
      feedback.value = '';
      hasEdits.value = false;
    }
  }
);

// Load version history
async function loadVersions() {
  if (!props.deliverableId) return;

  isLoadingVersions.value = true;
  try {
    const history = await deliverablesService.getVersionHistory(props.deliverableId);
    versions.value = history;
    const current = history.find((v) => v.isCurrentVersion);
    selectedVersionId.value = current?.id;
  } catch (error) {
    console.error('Failed to load versions:', error);
  } finally {
    isLoadingVersions.value = false;
  }
}

// Handle version selection
async function handleVersionSelect(version: DeliverableVersion) {
  selectedVersionId.value = version.id;

  // Parse version content
  if (version.content) {
    try {
      const content = JSON.parse(version.content);
      displayContent.blogPost = content.blogPost || '';
      displayContent.seoDescription = content.seoDescription || '';
      displayContent.socialPosts = content.socialPosts || [];

      editedContent.blogPost = displayContent.blogPost;
      editedContent.seoDescription = displayContent.seoDescription;
      editedContent.socialPosts = displayContent.socialPosts.join('\n');
    } catch (e) {
      console.error('Failed to parse version content:', e);
    }
  }
}

// Action handlers
async function handleApprove() {
  await submitDecision('approve');
}

async function handleReject() {
  await submitDecision('reject');
}

async function handleRegenerate() {
  if (!feedback.value.trim()) return;
  await submitDecision('regenerate', { feedback: feedback.value });
}

async function handleReplace() {
  const content: HitlGeneratedContent = {
    blogPost: editedContent.blogPost,
    seoDescription: editedContent.seoDescription,
    socialPosts: editedContent.socialPosts.split('\n').filter((p) => p.trim()),
  };
  await submitDecision('replace', { content });
}

async function submitDecision(
  decision: 'approve' | 'reject' | 'regenerate' | 'replace',
  options?: { feedback?: string; content?: HitlGeneratedContent }
) {
  isSubmitting.value = true;

  try {
    const response = await hitlService.resume(props.organizationSlug, props.agentSlug, {
      taskId: props.taskId,
      decision,
      feedback: options?.feedback,
      content: options?.content,
    });

    // Remove from pending list if completed
    // Note: Use taskId as key since hitl_pending is on tasks table
    if (response.status === 'completed') {
      hitlPendingStore.removePendingItem(props.taskId);
    }

    emit('decision', response);

    // If still pending (e.g., after regenerate), update content
    if (response.status === 'hitl_waiting') {
      displayContent.blogPost = response.generatedContent.blogPost || '';
      displayContent.seoDescription = response.generatedContent.seoDescription || '';
      displayContent.socialPosts = response.generatedContent.socialPosts || [];

      editedContent.blogPost = displayContent.blogPost;
      editedContent.seoDescription = displayContent.seoDescription;
      editedContent.socialPosts = displayContent.socialPosts.join('\n');

      feedback.value = '';
      hasEdits.value = false;
      viewMode.value = 'view';

      // Reload versions
      if (props.deliverableId) {
        await loadVersions();
      }
    } else {
      handleClose();
    }
  } catch (error) {
    console.error('Failed to submit decision:', error);
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.hitl-review-modal {
  --width: 90%;
  --max-width: 800px;
  --height: 90%;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topic-label {
  font-size: 1.1rem;
  font-weight: 500;
}

.version-section {
  margin-bottom: 1rem;
}

.view-mode-toggle {
  margin-bottom: 1rem;
}

.feedback-section {
  margin-top: 1rem;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.5rem;
}

@media (max-width: 600px) {
  .action-buttons {
    flex-wrap: wrap;
  }

  .action-buttons ion-button {
    flex: 1 1 45%;
  }
}
</style>
```

---

## Task 4: Create HitlPendingCard and DeliverableCard

### 4.1 HitlPendingCard Component

**File**: `apps/web/src/components/hitl/HitlPendingCard.vue`

```vue
<template>
  <div class="hitl-pending-card" @click="emit('review')">
    <div class="card-icon">
      <ion-icon :icon="alertCircleOutline" color="warning" />
    </div>
    <div class="card-content">
      <div class="card-title">HITL Review Needed</div>
      <div class="card-topic">{{ topic }}</div>
      <div class="card-meta">
        <span class="agent">{{ agentSlug }}</span>
        <span class="version">v{{ versionNumber }}</span>
        <span class="time">{{ formattedTime }}</span>
      </div>
    </div>
    <ion-button fill="clear" size="small">
      Review
      <ion-icon :icon="arrowForwardOutline" slot="end" />
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import { alertCircleOutline, arrowForwardOutline } from 'ionicons/icons';
import type { HitlPendingCardProps, HitlPendingCardEmits } from '@/components/shared/types';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps<HitlPendingCardProps>();
const emit = defineEmits<HitlPendingCardEmits>();

const formattedTime = computed(() => {
  return formatDistanceToNow(new Date(props.pendingSince), { addSuffix: true });
});
</script>

<style scoped>
.hitl-pending-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-warning-tint);
  border-left: 4px solid var(--ion-color-warning);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.hitl-pending-card:hover {
  background: var(--ion-color-warning-shade);
}

.card-icon ion-icon {
  font-size: 2rem;
}

.card-content {
  flex: 1;
}

.card-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ion-color-warning-shade);
}

.card-topic {
  font-size: 1rem;
  margin: 0.25rem 0;
}

.card-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
</style>
```

### 4.2 DeliverableCard Component

**File**: `apps/web/src/components/deliverables/DeliverableCard.vue`

```vue
<template>
  <div class="deliverable-card" @click="emit('view')">
    <div class="card-icon">
      <ion-icon :icon="documentTextOutline" color="success" />
    </div>
    <div class="card-content">
      <div class="card-title">Deliverable Ready</div>
      <div class="card-topic">{{ title }}</div>
      <div class="card-meta">
        <VersionBadge
          :version-number="currentVersionNumber"
          :creation-type="creationType"
          :is-current="true"
          size="small"
        />
        <span class="time">{{ formattedTime }}</span>
      </div>
    </div>
    <ion-button fill="clear" size="small">
      View
      <ion-icon :icon="arrowForwardOutline" slot="end" />
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import { documentTextOutline, arrowForwardOutline } from 'ionicons/icons';
import VersionBadge from '@/components/shared/VersionBadge.vue';
import type { DeliverableCardProps, DeliverableCardEmits } from '@/components/shared/types';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps<DeliverableCardProps>();
const emit = defineEmits<DeliverableCardEmits>();

const formattedTime = computed(() => {
  return formatDistanceToNow(new Date(props.updatedAt), { addSuffix: true });
});
</script>

<style scoped>
.deliverable-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-success-tint);
  border-left: 4px solid var(--ion-color-success);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.deliverable-card:hover {
  background: var(--ion-color-success-shade);
}

.card-icon ion-icon {
  font-size: 2rem;
}

.card-content {
  flex: 1;
}

.card-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ion-color-success-shade);
}

.card-topic {
  font-size: 1rem;
  margin: 0.25rem 0;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
</style>
```

---

## Task 5: Create HitlPendingList for Sidebar

### 5.1 HitlPendingList Component

**File**: `apps/web/src/components/hitl/HitlPendingList.vue`

```vue
<template>
  <div class="hitl-pending-list">
    <div class="list-header" @click="toggleExpanded">
      <ion-icon :icon="alertCircleOutline" color="warning" />
      <span class="header-label">HITL Reviews</span>
      <ion-badge v-if="count > 0" color="warning">{{ count }}</ion-badge>
      <ion-icon
        :icon="expanded ? chevronUpOutline : chevronDownOutline"
        class="expand-icon"
      />
    </div>

    <div v-if="expanded" class="list-content">
      <ion-spinner v-if="loading" name="dots" />

      <div v-else-if="!hasItems" class="empty-state">
        No pending reviews
      </div>

      <div v-else class="pending-items">
        <div
          v-for="item in sortedItems"
          :key="item.taskId"
          class="pending-item"
          @click="handleItemClick(item)"
        >
          <div class="item-title">{{ item.deliverableTitle || item.conversationTitle }}</div>
          <div class="item-meta">
            <span class="agent">{{ item.agentSlug }}</span>
            <span class="time">{{ formatTime(item.pendingSince) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { IonIcon, IonBadge, IonSpinner } from '@ionic/vue';
import { alertCircleOutline, chevronUpOutline, chevronDownOutline } from 'ionicons/icons';
import { useHitlPendingStore } from '@/stores/hitlPendingStore';
import { formatDistanceToNow } from 'date-fns';
import type { HitlPendingItem } from '@orchestrator-ai/transport-types';

const emit = defineEmits<{
  select: [item: HitlPendingItem];
}>();

const hitlPendingStore = useHitlPendingStore();
const { count, hasItems, sortedItems, loading } = storeToRefs(hitlPendingStore);

const expanded = ref(true);

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

const handleItemClick = (item: HitlPendingItem) => {
  emit('select', item);
};

const formatTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
};

// Fetch pending reviews on mount
onMounted(() => {
  hitlPendingStore.fetchPendingReviews();
});
</script>

<style scoped>
.hitl-pending-list {
  background: var(--ion-color-step-50);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  font-weight: 600;
}

.list-header ion-icon:first-child {
  font-size: 1.25rem;
}

.header-label {
  flex: 1;
}

.expand-icon {
  font-size: 1rem;
  color: var(--ion-color-medium);
}

.list-content {
  padding: 0 0.75rem 0.75rem;
}

.empty-state {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  padding: 1rem;
}

.pending-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pending-item {
  padding: 0.5rem 0.75rem;
  background: var(--ion-background-color);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.pending-item:hover {
  background: var(--ion-color-step-100);
}

.item-title {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}
</style>
```

---

## Task 6: Manual Testing Checklist

**File**: `docs/hitl-manual-testing-checklist.md`

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
- [ ] Verify HITL Review Modal auto-opens
- [ ] Verify blog post content is displayed
- [ ] Click "Approve" button
- [ ] Verify workflow completes
- [ ] Verify Deliverables Modal auto-opens
- [ ] Verify DeliverableCard appears in conversation

### 2. REGENERATE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Enter feedback: "Make it shorter and more engaging"
- [ ] Click "Regenerate" button
- [ ] Verify new content is generated
- [ ] Verify HITL Modal updates with new content
- [ ] Verify version history shows 2 versions
- [ ] Approve and complete

### 3. REPLACE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Switch to "Edit" mode
- [ ] Edit the content manually
- [ ] Click "Use My Edits" button
- [ ] Verify workflow completes with user content
- [ ] Verify version history shows MANUAL_EDIT type

### 4. HITL Pending List (Sidebar)
- [ ] Start 2-3 tasks but don't complete them
- [ ] Verify sidebar shows "HITL Reviews (N)"
- [ ] Expand the list
- [ ] Verify all pending items are shown
- [ ] Click an item
- [ ] Verify conversation loads and HITL Modal opens
- [ ] Complete the review
- [ ] Verify item removed from sidebar list

### 5. Version History in Modal
- [ ] After multiple regenerations, versions appear in modal
- [ ] Version selector shows all versions with type labels
- [ ] Clicking a version switches the displayed content
- [ ] Current version is highlighted

### 6. Cards in Conversation
- [ ] HitlPendingCard appears when HITL is waiting
- [ ] Clicking card opens HITL Modal
- [ ] DeliverableCard replaces HitlPendingCard after completion
- [ ] Clicking DeliverableCard opens Deliverables Modal

### 7. Error Handling
- [ ] Try to regenerate without feedback
- [ ] Verify validation error appears
- [ ] Try to replace without making edits
- [ ] Verify appropriate error

### 8. Session Persistence
- [ ] Start HITL workflow
- [ ] Refresh the page
- [ ] Verify HITL Pending List still shows the item
- [ ] Click item and verify modal opens with correct content
- [ ] Complete the workflow
```

---

## Success Criteria

### Backend
1. [ ] All E2E tests pass using A2A endpoint
2. [ ] Validation error tests pass
3. [ ] Response format matches frontend expectations (taskId as primary identifier)
4. [ ] `hitl.pending` queries **tasks table** (not conversations)
5. [ ] All builds pass: `npm run build`

### Frontend
6. [ ] Shared components created (ContentViewer, VersionSelector, FeedbackInput, etc.)
7. [ ] HitlReviewModal created and working with all decisions
8. [ ] DeliverablesModal created and working
9. [ ] HitlPendingCard and DeliverableCard created
10. [ ] HitlPendingList uses `taskId` as v-for key
11. [ ] hitlPendingStore uses `taskId` for add/remove operations
12. [ ] Auto-open behavior works for both modals
13. [ ] Version history integration works
14. [ ] hitlService uses A2A JSON-RPC correctly
15. [ ] Manual testing checklist completed
16. [ ] Documentation updated

---

## Files Created

### Shared Components
| File | Purpose |
|------|---------|
| `apps/web/src/components/shared/ContentViewer.vue` | Markdown preview with tabs |
| `apps/web/src/components/shared/ContentEditor.vue` | Editable content areas |
| `apps/web/src/components/shared/VersionSelector.vue` | Version history list |
| `apps/web/src/components/shared/VersionBadge.vue` | Version type badge |
| `apps/web/src/components/shared/FeedbackInput.vue` | Regeneration feedback |

### HITL Components
| File | Purpose |
|------|---------|
| `apps/web/src/components/hitl/HitlReviewModal.vue` | HITL review modal |
| `apps/web/src/components/hitl/HitlPendingCard.vue` | Card in conversation |
| `apps/web/src/components/hitl/HitlPendingList.vue` | Sidebar pending list |

### Deliverable Components
| File | Purpose |
|------|---------|
| `apps/web/src/components/deliverables/DeliverablesModal.vue` | Deliverables modal |
| `apps/web/src/components/deliverables/DeliverableCard.vue` | Card in conversation |

### Test Infrastructure
| File | Purpose |
|------|---------|
| `apps/api/src/agent2agent/__tests__/fixtures/hitl-test-fixtures.ts` | Test data seeding and cleanup |
| `apps/api/src/agent2agent/__tests__/mocks/langgraph-mock.service.ts` | Mock LangGraph for deterministic tests |
| `apps/api/src/agent2agent/__tests__/hitl-e2e-test.module.ts` | Test module with mock providers |
| `apps/api/src/agent2agent/__tests__/hitl-e2e.spec.ts` | E2E tests using A2A endpoint |
| `docs/hitl-manual-testing-checklist.md` | Manual test checklist |
