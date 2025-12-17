/**
 * Marketing Controller Tests
 *
 * Tests the Marketing Swarm configuration endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MarketingModule } from './marketing.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createClient } from '@supabase/supabase-js';
import { App } from 'supertest/types';

// Type definitions for test responses
interface ContentType {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

interface LlmConfig {
  id: string;
  agentId: string;
  llmProvider: string;
  llmModel: string;
  isActive?: boolean;
}

interface Agent {
  id: string;
  slug: string;
  name: string;
  role: 'writer' | 'editor' | 'evaluator';
  llmConfigs?: LlmConfig[];
}

interface ConfigResponse {
  contentTypes: ContentType[];
  writers: Agent[];
  editors: Agent[];
  evaluators: Agent[];
}

describe('MarketingController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  // Environment variables
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:6010';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const testEmail =
    process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';

  beforeAll(async () => {
    // Only initialize Supabase if keys are available
    if (supabaseKey && anonKey) {
      // Authenticate to get token
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: authData, error: authError } =
        await anonClient.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });

      if (authError) {
        console.warn('Auth failed, tests may fail:', authError.message);
      } else if (authData?.session?.access_token) {
        authToken = authData.session.access_token;
      }
    } else {
      // Use a mock token if Supabase is not configured
      authToken = 'mock-token-for-testing';
      console.warn('Supabase keys not configured, using mock authentication');
    }

    // Create NestJS app with actual module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MarketingModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true, // Mock auth guard for testing
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /marketing/config', () => {
    it('should return full swarm configuration', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as ConfigResponse;
      expect(body).toHaveProperty('contentTypes');
      expect(body).toHaveProperty('writers');
      expect(body).toHaveProperty('editors');
      expect(body).toHaveProperty('evaluators');
      expect(Array.isArray(body.contentTypes)).toBe(true);
      expect(Array.isArray(body.writers)).toBe(true);
      expect(Array.isArray(body.editors)).toBe(true);
      expect(Array.isArray(body.evaluators)).toBe(true);

      // Verify content types have required fields
      if (body.contentTypes.length > 0) {
        const contentType = body.contentTypes[0];
        expect(contentType).toHaveProperty('id');
        expect(contentType).toHaveProperty('slug');
        expect(contentType).toHaveProperty('name');
        expect(contentType).toHaveProperty('isActive');
      }

      // Verify agents have required fields
      if (body.writers.length > 0) {
        const writer = body.writers[0];
        expect(writer).toHaveProperty('id');
        expect(writer).toHaveProperty('slug');
        expect(writer).toHaveProperty('name');
        expect(writer).toHaveProperty('role');
        expect(writer.role).toBe('writer');
        expect(writer).toHaveProperty('llmConfigs');
        expect(Array.isArray(writer.llmConfigs)).toBe(true);
      }
    });
  });

  describe('GET /marketing/content-types', () => {
    it('should return all content types', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/content-types')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as ContentType[];
      expect(Array.isArray(body)).toBe(true);

      if (body.length > 0) {
        const contentType = body[0];
        expect(contentType).toHaveProperty('id');
        expect(contentType).toHaveProperty('slug');
        expect(contentType).toHaveProperty('name');
        expect(contentType).toHaveProperty('isActive');
      }
    });
  });

  describe('GET /marketing/content-types/:slug', () => {
    it('should return a specific content type by slug', async () => {
      // First get all content types to find a valid slug
      const allTypesResponse = await request(app.getHttpServer() as App)
        .get('/marketing/content-types')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const allTypes = allTypesResponse.body as ContentType[];
      if (allTypes.length > 0) {
        const slug = allTypes[0].slug;

        const response = await request(app.getHttpServer() as App)
          .get(`/marketing/content-types/${slug}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body = response.body as ContentType;
        expect(body).toHaveProperty('slug', slug);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
      }
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer() as App)
        .get('/marketing/content-types/non-existent-slug-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /marketing/agents', () => {
    it('should return all agents', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as Agent[];
      expect(Array.isArray(body)).toBe(true);

      if (body.length > 0) {
        const agent = body[0];
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('slug');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(['writer', 'editor', 'evaluator']).toContain(agent.role);
      }
    });

    it('should filter agents by role', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/agents?role=writer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as Agent[];
      expect(Array.isArray(body)).toBe(true);

      if (body.length > 0) {
        body.forEach((agent: Agent) => {
          expect(agent.role).toBe('writer');
        });
      }
    });

    it('should include LLM configs when requested', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/agents?includeConfigs=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as Agent[];
      expect(Array.isArray(body)).toBe(true);

      if (body.length > 0) {
        const agent = body[0];
        expect(agent).toHaveProperty('llmConfigs');
        expect(Array.isArray(agent.llmConfigs)).toBe(true);

        if (agent.llmConfigs && agent.llmConfigs.length > 0) {
          const config = agent.llmConfigs[0];
          expect(config).toHaveProperty('id');
          expect(config).toHaveProperty('llmProvider');
          expect(config).toHaveProperty('llmModel');
        }
      }
    });
  });

  describe('GET /marketing/agents/:slug', () => {
    it('should return a specific agent by slug', async () => {
      // First get all agents to find a valid slug
      const allAgentsResponse = await request(app.getHttpServer() as App)
        .get('/marketing/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const allAgents = allAgentsResponse.body as Agent[];
      if (allAgents.length > 0) {
        const slug = allAgents[0].slug;

        const response = await request(app.getHttpServer() as App)
          .get(`/marketing/agents/${slug}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body = response.body as Agent;
        expect(body).toHaveProperty('slug', slug);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
        expect(body).toHaveProperty('role');
      }
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer() as App)
        .get('/marketing/agents/non-existent-agent-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /marketing/llm-configs', () => {
    it('should return all LLM configs', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/marketing/llm-configs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as LlmConfig[];
      expect(Array.isArray(body)).toBe(true);

      if (body.length > 0) {
        const config = body[0];
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('agentId');
        expect(config).toHaveProperty('llmProvider');
        expect(config).toHaveProperty('llmModel');
        expect(config).toHaveProperty('isActive');
      }
    });
  });

  describe('GET /marketing/agents/:agentId/llm-configs', () => {
    it('should return LLM configs for a specific agent', async () => {
      // First get all agents to find a valid agent ID
      const allAgentsResponse = await request(app.getHttpServer() as App)
        .get('/marketing/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const allAgents = allAgentsResponse.body as Agent[];
      if (allAgents.length > 0) {
        const agentId = allAgents[0].id;

        const response = await request(app.getHttpServer() as App)
          .get(`/marketing/agents/${agentId}/llm-configs`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body = response.body as LlmConfig[];
        expect(Array.isArray(body)).toBe(true);

        if (body.length > 0) {
          body.forEach((config: LlmConfig) => {
            expect(config).toHaveProperty('agentId', agentId);
            expect(config).toHaveProperty('llmProvider');
            expect(config).toHaveProperty('llmModel');
          });
        }
      }
    });
  });
});
