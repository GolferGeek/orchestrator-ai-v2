import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Agent recommendation structure
 */
export interface AgentRecommendation {
  name: string;
  tagline: string;
  description: string;
  use_case_example: string;
  time_saved: string;
  wow_factor: string;
  category: string;
}

/**
 * Submit interest request
 */
export interface SubmitInterestRequest {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  industryInput: string;
  normalizedIndustry?: string;
  industryDescription?: string;
  selectedAgents: AgentRecommendation[];
  allRecommendations?: AgentRecommendation[];
  isFallback?: boolean;
  processingTimeMs?: number;
}

/**
 * Submission response
 */
export interface SubmissionResponse {
  success: boolean;
  submissionId: string;
  message: string;
}

@Injectable()
export class BusinessAutomationAdvisorDbService {
  private readonly logger = new Logger(BusinessAutomationAdvisorDbService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any, "leads">;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) throw new Error("SUPABASE_URL environment variable is required");
    if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      // Use the leads schema for all queries
      db: { schema: "leads" },
    });
  }

  /**
   * Submit interest in selected agents
   *
   * Stores the lead submission in the database.
   */
  async submitInterest(
    request: SubmitInterestRequest,
  ): Promise<SubmissionResponse> {
    this.logger.log(
      `Storing lead submission: email=${request.email}, selectedAgents=${request.selectedAgents.length}`,
    );

    const { data, error } = await this.supabase
      .from("agent_idea_submissions")
      .insert({
        email: request.email,
        name: request.name || null,
        company: request.company || null,
        phone: request.phone || null,
        industry_input: request.industryInput,
        normalized_industry: request.normalizedIndustry || null,
        industry_description: request.industryDescription || null,
        selected_agents: request.selectedAgents,
        all_recommendations: request.allRecommendations || null,
        is_fallback: request.isFallback || false,
        processing_time_ms: request.processingTimeMs || null,
      })
      .select("id")
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
  }
}
