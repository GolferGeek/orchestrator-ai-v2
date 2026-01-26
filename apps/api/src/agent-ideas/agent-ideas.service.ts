import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '@/supabase/supabase.service';
import { SubmitInterestDto, AgentRecommendation } from './dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Response from LangGraph Business Automation Advisor
 */
interface LangGraphRecommendationsResponse {
  status: 'success' | 'partial' | 'error';
  message: string;
  data?: {
    industry: string;
    industryDescription: string;
    recommendationCount: number;
    isFallback: boolean;
    recommendations: AgentRecommendation[];
    processingTimeMs: number;
  };
  error?: string;
}

/**
 * Response for recommendations endpoint
 */
export interface RecommendationsResponse {
  status: 'success' | 'partial' | 'error';
  message: string;
  data?: {
    industry: string;
    industryDescription: string;
    recommendationCount: number;
    isFallback: boolean;
    recommendations: AgentRecommendation[];
    processingTimeMs: number;
  };
  error?: string;
}

/**
 * Response for submit endpoint
 */
export interface SubmissionResponse {
  success: boolean;
  submissionId: string;
  message: string;
}

/**
 * Fallback recommendations when LangGraph is unavailable
 */
const FALLBACK_RECOMMENDATIONS: AgentRecommendation[] = [
  {
    name: 'Smart Appointment Scheduler',
    tagline: 'Automate booking, reminders, and calendar management',
    description:
      'Handles appointment scheduling across multiple calendars, sends automated reminders via email and SMS, and manages rescheduling requests without manual intervention.',
    use_case_example:
      'When a client requests an appointment via email or web form, this agent checks availability, books the slot, sends confirmation, and sets up automated reminders.',
    time_saved: '3-5 hours per week',
    wow_factor:
      'Learns optimal scheduling patterns based on your historical booking data',
    category: 'Admin',
  },
  {
    name: 'Invoice Chaser Pro',
    tagline: 'Never manually follow up on unpaid invoices again',
    description:
      'Automatically tracks invoice payment status and sends personalized, progressively urgent follow-up messages to clients with outstanding balances.',
    use_case_example:
      'When an invoice is 7 days overdue, sends a friendly reminder. At 14 days, escalates tone. At 30 days, alerts you for personal intervention.',
    time_saved: '4-6 hours per week',
    wow_factor:
      'Adjusts communication style based on client payment history and relationship',
    category: 'Finance',
  },
  {
    name: 'Lead Response Lightning',
    tagline: 'Engage new leads within 60 seconds automatically',
    description:
      'Instantly responds to new lead inquiries with personalized messages, qualifies prospects with intelligent questions, and routes hot leads to your sales team immediately.',
    use_case_example:
      'When someone fills out your contact form, instantly sends a personalized email, asks qualifying questions, and alerts your team if they are a high-value prospect.',
    time_saved: '10+ hours per week',
    wow_factor:
      'Increases conversion rates by 30-40% through instant response times',
    category: 'Sales',
  },
  {
    name: 'Meeting Notes & Action Tracker',
    tagline: 'Turn every meeting into actionable next steps automatically',
    description:
      'Records meetings, generates summaries, extracts action items, assigns tasks to team members, and sends follow-up reminders to ensure nothing falls through the cracks.',
    use_case_example:
      'After each client call, automatically sends a summary email with key points discussed, action items with owners and due dates, and schedules follow-up reminders.',
    time_saved: '2-3 hours per week',
    wow_factor:
      'Integrates with your project management tools to create tasks automatically',
    category: 'Operations',
  },
  {
    name: 'Social Media Content Recycler',
    tagline: 'Keep your social presence active without daily effort',
    description:
      'Analyzes your best-performing content, repurposes it for different platforms, and schedules posts automatically to maintain consistent social media presence.',
    use_case_example:
      'When you publish a blog post, creates 10 social media variations optimized for LinkedIn, Twitter, and Instagram, and schedules them over the next month.',
    time_saved: '5-8 hours per week',
    wow_factor:
      'Learns which content types perform best and optimizes posting times',
    category: 'Marketing',
  },
  {
    name: 'Customer Onboarding Autopilot',
    tagline: 'Welcome new customers with a flawless automated experience',
    description:
      'Guides new customers through setup, sends helpful resources at the right time, checks in on progress, and escalates to your team only when needed.',
    use_case_example:
      'When someone signs up, sends welcome email immediately, setup guide after 1 day, tips after 3 days, and checks in after 1 week with personalized help.',
    time_saved: '6-10 hours per week',
    wow_factor:
      'Personalizes the journey based on customer type and engagement level',
    category: 'Customer Service',
  },
  {
    name: 'Expense Report Auto-Processor',
    tagline: 'Turn receipt photos into categorized expense reports instantly',
    description:
      'Scans receipts via photo or email, extracts data using OCR, categorizes expenses, checks policy compliance, and submits reports for approval automatically.',
    use_case_example:
      'When you snap a photo of a receipt, agent extracts amount, vendor, date, categorizes it (meals, travel, etc.), and adds it to your monthly expense report.',
    time_saved: '2-4 hours per week',
    wow_factor:
      'Flags policy violations before submission to prevent approval delays',
    category: 'Finance',
  },
  {
    name: 'Email Newsletter Auto-Curator',
    tagline:
      'Generate engaging newsletters from your content library automatically',
    description:
      'Analyzes your blog posts, social media, and industry news, curates the most relevant content, writes compelling copy, and schedules newsletter distribution.',
    use_case_example:
      'Each month, scans your content, picks top 5 articles, writes summaries with your brand voice, designs layout, and sends to your email list.',
    time_saved: '4-6 hours per month',
    wow_factor: 'A/B tests subject lines and content to maximize open rates',
    category: 'Marketing',
  },
];

@Injectable()
export class AgentIdeasService {
  private readonly logger = new Logger(AgentIdeasService.name);
  private readonly langgraphBaseUrl: string;
  private readonly LANGGRAPH_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.langgraphBaseUrl =
      this.configService.get<string>('LANGGRAPH_BASE_URL') ||
      'http://localhost:6200';
  }

  /**
   * Get agent recommendations for an industry
   *
   * Calls the LangGraph Business Automation Advisor workflow.
   * Falls back to static recommendations if LangGraph is unavailable.
   */
  async getRecommendations(industry: string): Promise<RecommendationsResponse> {
    const startTime = Date.now();

    this.logger.log(`Getting recommendations for industry: ${industry}`);

    try {
      // Build a minimal ExecutionContext for the LangGraph call
      // Since this is a public endpoint, we use placeholder values
      const context = {
        orgSlug: 'public',
        userId: 'landing-page-visitor',
        conversationId: uuidv4(),
        taskId: uuidv4(),
        planId: '',
        deliverableId: '',
        agentSlug: 'business-automation-advisor',
        agentType: 'langgraph',
        provider: 'openai',
        model: 'gpt-4o',
      };

      const url = `${this.langgraphBaseUrl}/business-automation-advisor/generate`;

      this.logger.debug(`Calling LangGraph: ${url}`);

      const response = await firstValueFrom(
        this.httpService.post<LangGraphRecommendationsResponse>(
          url,
          {
            context,
            industry,
          },
          {
            timeout: this.LANGGRAPH_TIMEOUT,
          },
        ),
      );

      const result = response.data;

      this.logger.log(
        `LangGraph returned ${result.data?.recommendationCount || 0} recommendations (isFallback: ${result.data?.isFallback})`,
      );

      return result;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      this.logger.warn(
        `LangGraph call failed, using fallback recommendations: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Return fallback recommendations
      return {
        status: 'partial',
        message:
          'AI generation unavailable, showing general recommendations',
        data: {
          industry: industry,
          industryDescription: `Business in the ${industry} industry`,
          recommendationCount: FALLBACK_RECOMMENDATIONS.length,
          isFallback: true,
          recommendations: FALLBACK_RECOMMENDATIONS,
          processingTimeMs,
        },
      };
    }
  }

  /**
   * Submit interest in selected agents
   *
   * Stores the lead submission in the database.
   */
  async submitInterest(dto: SubmitInterestDto): Promise<SubmissionResponse> {
    this.logger.log(
      `Storing lead submission: email=${dto.email}, selectedAgents=${dto.selectedAgents.length}`,
    );

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .schema('leads')
        .from('agent_idea_submissions')
        .insert({
          email: dto.email,
          name: dto.name || null,
          company: dto.company || null,
          phone: dto.phone || null,
          industry_input: dto.industryInput,
          normalized_industry: dto.normalizedIndustry || null,
          industry_description: dto.industryDescription || null,
          selected_agents: dto.selectedAgents,
          all_recommendations: dto.allRecommendations || null,
          is_fallback: dto.isFallback || false,
          processing_time_ms: dto.processingTimeMs || null,
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error(`Failed to store submission: ${error.message}`);
        throw new Error(`Failed to store submission: ${error.message}`);
      }

      this.logger.log(`Lead submission stored: id=${data.id}`);

      return {
        success: true,
        submissionId: data.id,
        message:
          "Thank you for your interest! We'll build these agents and email you when they're ready to try.",
      };
    } catch (error) {
      this.logger.error(
        `Failed to submit interest: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
