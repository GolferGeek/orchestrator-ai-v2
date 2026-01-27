/**
 * Debate Service
 *
 * Orchestrates the Red Team / Blue Team adversarial debate system.
 * Blue Agent defends the risk assessment, Red Agent challenges it,
 * and Arbiter Agent synthesizes a final verdict with potential score adjustment.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService } from '@/llms/llm.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { RiskSubject } from '../interfaces/subject.interface';
import { RiskCompositeScore } from '../interfaces/composite-score.interface';
import { RiskAssessment } from '../interfaces/assessment.interface';
import { RiskAnalysisConfig } from '../interfaces/scope.interface';
import {
  RiskDebate,
  BlueAssessment,
  RedChallenges,
  ArbiterSynthesis,
  DebateMessage,
  RiskDebateContext,
  RedTeamChallenge,
  AlternativeScenario,
} from '../interfaces/debate.interface';
import { DebateRepository } from '../repositories/debate.repository';
import { CompositeScoreRepository } from '../repositories/composite-score.repository';
import { ScoreAggregationService } from './score-aggregation.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

export interface DebateInput {
  subject: RiskSubject;
  compositeScore: RiskCompositeScore;
  assessments: RiskAssessment[];
  scopeId: string;
  context: ExecutionContext;
}

export interface DebateResult {
  debate: RiskDebate;
  adjustedScore: number;
  adjustment: number;
}

@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly debateRepo: DebateRepository,
    private readonly compositeScoreRepo: CompositeScoreRepository,
    private readonly scoreAggregation: ScoreAggregationService,
    @Optional()
    private readonly observabilityEvents?: ObservabilityEventsService,
  ) {}

  /**
   * Emit a progress event for real-time UI updates
   */
  private emitProgress(
    context: ExecutionContext,
    step: string,
    message: string,
    progress: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.observabilityEvents) return;

    void this.observabilityEvents.push({
      context,
      source_app: 'risk-debate',
      hook_event_type: 'risk.debate.progress',
      status: 'in_progress',
      message,
      progress,
      step,
      payload: {
        mode: 'debate',
        ...metadata,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Run a full debate cycle for a subject's risk assessment
   *
   * Flow:
   * 1. Create pending debate record
   * 2. Run Blue Agent (defender) to present the case
   * 3. Run Red Agent (challenger) to find blind spots
   * 4. Run Arbiter Agent to synthesize and determine adjustments
   * 5. Apply score adjustment to composite score
   */
  async runDebate(input: DebateInput): Promise<DebateResult> {
    const { subject, compositeScore, assessments, scopeId, context } = input;

    this.logger.log(
      `Starting debate for subject ${subject.identifier} with score ${compositeScore.overall_score}`,
    );

    // Emit: Debate starting
    this.emitProgress(
      context,
      'debate-starting',
      `Starting Red vs Blue debate for ${subject.identifier}`,
      0,
      {
        subjectId: subject.id,
        subjectIdentifier: subject.identifier,
        originalScore: compositeScore.overall_score,
      },
    );

    // 1. Create pending debate record
    const debate = await this.debateRepo.create({
      subject_id: subject.id,
      composite_score_id: compositeScore.id,
      task_id: context.taskId,
      original_score: compositeScore.overall_score,
      status: 'pending',
      transcript: [],
    });

    try {
      // Update status to in_progress
      await this.debateRepo.update(debate.id, { status: 'in_progress' });

      // Emit: Loading contexts
      this.emitProgress(
        context,
        'loading-contexts',
        'Loading debate agent configurations...',
        10,
        {
          subjectIdentifier: subject.identifier,
        },
      );

      // Get debate contexts for each role
      const [blueContext, redContext, arbiterContext] = await Promise.all([
        this.debateRepo.findActiveContextByRole(scopeId, 'blue'),
        this.debateRepo.findActiveContextByRole(scopeId, 'red'),
        this.debateRepo.findActiveContextByRole(scopeId, 'arbiter'),
      ]);

      if (!blueContext || !redContext || !arbiterContext) {
        throw new Error(
          'Missing debate contexts. Please configure debate prompts for all roles (blue, red, arbiter).',
        );
      }

      const transcript: DebateMessage[] = [];

      // 2. Run Blue Agent (Defender)
      this.emitProgress(
        context,
        'running-blue-agent',
        'Blue Team defending the assessment...',
        20,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'blue',
        },
      );

      this.logger.debug(`Running Blue Agent for ${subject.identifier}`);
      const blueAssessment = await this.runBlueAgent(
        subject,
        compositeScore,
        assessments,
        blueContext,
        context,
      );
      transcript.push({
        role: 'blue',
        timestamp: new Date().toISOString(),
        content: JSON.stringify(blueAssessment),
      });

      // Emit: Blue complete
      this.emitProgress(
        context,
        'blue-complete',
        'Blue Team defense complete',
        40,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'blue',
          keyFindings: blueAssessment.key_findings?.length || 0,
        },
      );

      // 3. Run Red Agent (Challenger)
      this.emitProgress(
        context,
        'running-red-agent',
        'Red Team challenging the assessment...',
        45,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'red',
        },
      );

      this.logger.debug(`Running Red Agent for ${subject.identifier}`);
      const redChallenges = await this.runRedAgent(
        subject,
        compositeScore,
        assessments,
        blueAssessment,
        redContext,
        context,
      );
      transcript.push({
        role: 'red',
        timestamp: new Date().toISOString(),
        content: JSON.stringify(redChallenges),
      });

      // Emit: Red complete
      this.emitProgress(
        context,
        'red-complete',
        'Red Team challenges complete',
        65,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'red',
          challengeCount: redChallenges.challenges?.length || 0,
          blindSpotCount: redChallenges.blind_spots?.length || 0,
        },
      );

      // 4. Run Arbiter Agent (Synthesizer)
      this.emitProgress(
        context,
        'running-arbiter',
        'Arbiter synthesizing perspectives...',
        70,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'arbiter',
        },
      );

      this.logger.debug(`Running Arbiter Agent for ${subject.identifier}`);
      const arbiterSynthesis = await this.runArbiterAgent(
        subject,
        compositeScore,
        blueAssessment,
        redChallenges,
        arbiterContext,
        context,
      );
      transcript.push({
        role: 'arbiter',
        timestamp: new Date().toISOString(),
        content: JSON.stringify(arbiterSynthesis),
      });

      // Emit: Arbiter complete
      this.emitProgress(
        context,
        'arbiter-complete',
        'Arbiter verdict delivered',
        90,
        {
          subjectIdentifier: subject.identifier,
          agentRole: 'arbiter',
          recommendedAdjustment: arbiterSynthesis.recommended_adjustment,
        },
      );

      // 5. Calculate score adjustment
      const adjustment = this.calculateAdjustment(arbiterSynthesis);
      const finalScore = this.scoreAggregation.applyDebateAdjustment(
        compositeScore.overall_score,
        adjustment,
      );

      // 6. Update debate record with results
      const completedDebate = await this.debateRepo.update(debate.id, {
        blue_assessment: blueAssessment,
        red_challenges: redChallenges,
        arbiter_synthesis: arbiterSynthesis,
        final_score: finalScore,
        score_adjustment: adjustment,
        transcript,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // 7. Update composite score with debate adjustment
      await this.compositeScoreRepo.update(compositeScore.id, {
        debate_adjustment: adjustment,
        // If significant adjustment, mark as needing review
        ...(Math.abs(adjustment) >= 10 ? { status: 'active' } : {}),
      });

      this.logger.log(
        `Debate completed for ${subject.identifier}: ${compositeScore.overall_score} → ${finalScore} (${adjustment >= 0 ? '+' : ''}${adjustment})`,
      );

      // Emit: Debate complete
      this.emitProgress(
        context,
        'debate-complete',
        `Debate complete: score adjusted ${compositeScore.overall_score} → ${finalScore}`,
        100,
        {
          subjectId: subject.id,
          subjectIdentifier: subject.identifier,
          originalScore: compositeScore.overall_score,
          finalScore,
          adjustment,
          acceptedChallenges: arbiterSynthesis.accepted_challenges?.length || 0,
          rejectedChallenges: arbiterSynthesis.rejected_challenges?.length || 0,
        },
      );

      return {
        debate: completedDebate,
        adjustedScore: finalScore,
        adjustment,
      };
    } catch (error) {
      // Mark debate as failed
      await this.debateRepo.update(debate.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      });

      // Emit: Debate failed
      this.emitProgress(
        context,
        'debate-failed',
        `Debate failed: ${error instanceof Error ? error.message : String(error)}`,
        0,
        {
          subjectIdentifier: subject.identifier,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      this.logger.error(
        `Debate failed for ${subject.identifier}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Run Blue Agent - Defender of the risk assessment
   */
  private async runBlueAgent(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    assessments: RiskAssessment[],
    debateContext: RiskDebateContext,
    context: ExecutionContext,
  ): Promise<BlueAssessment> {
    const prompt = this.buildBluePrompt(subject, compositeScore, assessments);

    const response = await this.llmService.generateResponse(
      debateContext.system_prompt,
      prompt,
      {
        executionContext: context,
        callerType: 'api',
        callerName: 'debate-blue-agent',
      },
    );

    return this.parseBlueResponse(
      typeof response === 'string' ? response : response.content,
    );
  }

  /**
   * Run Red Agent - Challenger finding blind spots
   */
  private async runRedAgent(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    assessments: RiskAssessment[],
    blueAssessment: BlueAssessment,
    debateContext: RiskDebateContext,
    context: ExecutionContext,
  ): Promise<RedChallenges> {
    const prompt = this.buildRedPrompt(
      subject,
      compositeScore,
      assessments,
      blueAssessment,
    );

    const response = await this.llmService.generateResponse(
      debateContext.system_prompt,
      prompt,
      {
        executionContext: context,
        callerType: 'api',
        callerName: 'debate-red-agent',
      },
    );

    return this.parseRedResponse(
      typeof response === 'string' ? response : response.content,
    );
  }

  /**
   * Run Arbiter Agent - Synthesizes both perspectives
   */
  private async runArbiterAgent(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    blueAssessment: BlueAssessment,
    redChallenges: RedChallenges,
    debateContext: RiskDebateContext,
    context: ExecutionContext,
  ): Promise<ArbiterSynthesis> {
    const prompt = this.buildArbiterPrompt(
      subject,
      compositeScore,
      blueAssessment,
      redChallenges,
    );

    const response = await this.llmService.generateResponse(
      debateContext.system_prompt,
      prompt,
      {
        executionContext: context,
        callerType: 'api',
        callerName: 'debate-arbiter-agent',
      },
    );

    return this.parseArbiterResponse(
      typeof response === 'string' ? response : response.content,
    );
  }

  /**
   * Build prompt for Blue Agent
   */
  private buildBluePrompt(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    assessments: RiskAssessment[],
  ): string {
    const dimensionSummary = assessments
      .map(
        (a) =>
          `- ${a.dimension_id}: Score ${a.score}, Confidence ${a.confidence}\n  Reasoning: ${a.reasoning}`,
      )
      .join('\n');

    return `You are the Blue Team agent defending the risk assessment for ${subject.identifier}.

Subject: ${subject.identifier} (${subject.name || 'Unknown'})
Subject Type: ${subject.subject_type}
Overall Risk Score: ${compositeScore.overall_score}/100
Composite Confidence: ${compositeScore.confidence}

Dimension Assessments:
${dimensionSummary}

Your task:
1. Present a compelling defense of the current risk assessment
2. Highlight the key findings that support this score
3. Cite specific evidence from the dimension analyses
4. Explain why the confidence level is appropriate

Respond in JSON format:
{
  "summary": "<comprehensive defense narrative>",
  "key_findings": ["<finding 1>", "<finding 2>", ...],
  "evidence_cited": ["<evidence 1>", "<evidence 2>", ...],
  "confidence_explanation": "<why the confidence level is justified>"
}`;
  }

  /**
   * Build prompt for Red Agent
   */
  private buildRedPrompt(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    assessments: RiskAssessment[],
    blueAssessment: BlueAssessment,
  ): string {
    const dimensionSummary = assessments
      .map(
        (a) =>
          `- ${a.dimension_id}: Score ${a.score}, Confidence ${a.confidence}\n  Reasoning: ${a.reasoning}`,
      )
      .join('\n');

    return `You are the Red Team agent challenging the risk assessment for ${subject.identifier}.

Subject: ${subject.identifier} (${subject.name || 'Unknown'})
Subject Type: ${subject.subject_type}
Overall Risk Score: ${compositeScore.overall_score}/100

Dimension Assessments:
${dimensionSummary}

Blue Team's Defense:
${JSON.stringify(blueAssessment, null, 2)}

Your task:
1. Challenge the assessment - what did they miss?
2. Identify blind spots in the analysis
3. Propose alternative scenarios that could change the risk picture
4. Highlight any overstated or understated risks
5. For each challenge, suggest a specific score adjustment

Respond in JSON format:
{
  "challenges": [
    {
      "dimension": "<dimension affected>",
      "challenge": "<specific challenge to the assessment>",
      "evidence": ["<supporting evidence>"],
      "suggested_adjustment": <-20 to +20 score adjustment>
    }
  ],
  "blind_spots": ["<overlooked risk factor 1>", ...],
  "alternative_scenarios": [
    {
      "name": "<scenario name>",
      "description": "<what could happen>",
      "probability": <0.0-1.0>,
      "impact_on_score": <-30 to +30>
    }
  ],
  "overstated_risks": ["<risk that may be exaggerated>", ...],
  "understated_risks": ["<risk that needs more attention>", ...]
}`;
  }

  /**
   * Build prompt for Arbiter Agent
   */
  private buildArbiterPrompt(
    subject: RiskSubject,
    compositeScore: RiskCompositeScore,
    blueAssessment: BlueAssessment,
    redChallenges: RedChallenges,
  ): string {
    return `You are the Arbiter agent providing final synthesis for ${subject.identifier}.

Subject: ${subject.identifier} (${subject.name || 'Unknown'})
Subject Type: ${subject.subject_type}
Current Risk Score: ${compositeScore.overall_score}/100

Blue Team's Defense:
${JSON.stringify(blueAssessment, null, 2)}

Red Team's Challenges:
${JSON.stringify(redChallenges, null, 2)}

Your task:
1. Review both perspectives objectively
2. Determine which challenges are valid and should adjust the score
3. Determine which challenges should be rejected and why
4. Provide a final score adjustment recommendation (-30 to +30)
5. Explain your reasoning

Respond in JSON format:
{
  "final_assessment": "<balanced conclusion synthesizing both views>",
  "accepted_challenges": ["<challenge ID/summary that is valid>", ...],
  "rejected_challenges": ["<challenge ID/summary that is invalid>", ...],
  "adjustment_reasoning": "<why the score should be adjusted (or not)>",
  "recommended_adjustment": <-30 to +30>,
  "confidence_level": <0.0-1.0>,
  "key_takeaways": ["<important insight 1>", ...]
}`;
  }

  /**
   * Parse Blue Agent response
   */
  private parseBlueResponse(content: string): BlueAssessment {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return {
        summary:
          typeof parsed.summary === 'string'
            ? parsed.summary
            : 'No summary provided',
        key_findings: Array.isArray(parsed.key_findings)
          ? (parsed.key_findings as string[])
          : [],
        evidence_cited: Array.isArray(parsed.evidence_cited)
          ? (parsed.evidence_cited as string[])
          : [],
        confidence_explanation:
          typeof parsed.confidence_explanation === 'string'
            ? parsed.confidence_explanation
            : 'No explanation provided',
      };
    } catch {
      this.logger.warn('Failed to parse Blue Agent response as JSON');
      return {
        summary: content.slice(0, 500),
        key_findings: [],
        evidence_cited: [],
        confidence_explanation: 'Parse error',
      };
    }
  }

  /**
   * Parse Red Agent response
   */
  private parseRedResponse(content: string): RedChallenges {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return {
        challenges: this.parseChallenges(parsed.challenges),
        blind_spots: Array.isArray(parsed.blind_spots)
          ? (parsed.blind_spots as string[])
          : [],
        alternative_scenarios: this.parseAlternativeScenarios(
          parsed.alternative_scenarios,
        ),
        overstated_risks: Array.isArray(parsed.overstated_risks)
          ? (parsed.overstated_risks as string[])
          : [],
        understated_risks: Array.isArray(parsed.understated_risks)
          ? (parsed.understated_risks as string[])
          : [],
      };
    } catch {
      this.logger.warn('Failed to parse Red Agent response as JSON');
      return {
        challenges: [],
        blind_spots: [content.slice(0, 200)],
        alternative_scenarios: [],
        overstated_risks: [],
        understated_risks: [],
      };
    }
  }

  /**
   * Parse challenges array from Red Agent
   */
  private parseChallenges(challenges: unknown): RedTeamChallenge[] {
    if (!Array.isArray(challenges)) {
      return [];
    }

    return challenges.map((c: unknown) => {
      const challenge = c as Record<string, unknown>;
      return {
        dimension:
          typeof challenge.dimension === 'string'
            ? challenge.dimension
            : 'unknown',
        challenge:
          typeof challenge.challenge === 'string' ? challenge.challenge : '',
        evidence: Array.isArray(challenge.evidence)
          ? (challenge.evidence as string[])
          : [],
        suggested_adjustment: this.clampAdjustment(
          Number(challenge.suggested_adjustment) || 0,
        ),
      };
    });
  }

  /**
   * Parse alternative scenarios from Red Agent
   */
  private parseAlternativeScenarios(scenarios: unknown): AlternativeScenario[] {
    if (!Array.isArray(scenarios)) {
      return [];
    }

    return scenarios.map((s: unknown) => {
      const scenario = s as Record<string, unknown>;
      return {
        name:
          typeof scenario.name === 'string'
            ? scenario.name
            : 'Unknown scenario',
        description:
          typeof scenario.description === 'string' ? scenario.description : '',
        probability: Math.max(
          0,
          Math.min(1, Number(scenario.probability) || 0.5),
        ),
        impact_on_score: this.clampAdjustment(
          Number(scenario.impact_on_score) || 0,
        ),
      };
    });
  }

  /**
   * Parse Arbiter Agent response
   */
  private parseArbiterResponse(content: string): ArbiterSynthesis {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return {
        final_assessment:
          typeof parsed.final_assessment === 'string'
            ? parsed.final_assessment
            : 'No assessment provided',
        accepted_challenges: Array.isArray(parsed.accepted_challenges)
          ? (parsed.accepted_challenges as string[])
          : [],
        rejected_challenges: Array.isArray(parsed.rejected_challenges)
          ? (parsed.rejected_challenges as string[])
          : [],
        adjustment_reasoning:
          typeof parsed.adjustment_reasoning === 'string'
            ? parsed.adjustment_reasoning
            : 'No reasoning provided',
        confidence_level: Math.max(
          0,
          Math.min(1, Number(parsed.confidence_level) || 0.5),
        ),
        key_takeaways: Array.isArray(parsed.key_takeaways)
          ? (parsed.key_takeaways as string[])
          : [],
        recommended_adjustment: this.clampAdjustment(
          Number(parsed.recommended_adjustment) || 0,
        ),
      };
    } catch {
      this.logger.warn('Failed to parse Arbiter Agent response as JSON');
      return {
        final_assessment: content.slice(0, 500),
        accepted_challenges: [],
        rejected_challenges: [],
        adjustment_reasoning: 'Parse error',
        confidence_level: 0.3,
        key_takeaways: [],
        recommended_adjustment: 0,
      };
    }
  }

  /**
   * Calculate final score adjustment from Arbiter synthesis
   */
  private calculateAdjustment(arbiterSynthesis: ArbiterSynthesis): number {
    // Use the arbiter's recommended adjustment, clamped to safe range
    const adjustment = arbiterSynthesis.recommended_adjustment ?? 0;
    return this.clampAdjustment(adjustment);
  }

  /**
   * Clamp adjustment to valid range (-30 to +30)
   */
  private clampAdjustment(adjustment: number): number {
    return Math.max(-30, Math.min(30, Math.round(adjustment)));
  }

  /**
   * Check if debate should be triggered based on scope config
   */
  shouldTriggerDebate(
    compositeScore: RiskCompositeScore,
    analysisConfig: RiskAnalysisConfig,
  ): boolean {
    const redTeamConfig = analysisConfig.redTeam;

    if (!redTeamConfig?.enabled) {
      return false;
    }

    // Check if score exceeds threshold
    const threshold = redTeamConfig.threshold ?? 50;
    if (compositeScore.overall_score >= threshold) {
      return true;
    }

    // Check if confidence is low (might need debate)
    const lowConfidenceThreshold = redTeamConfig.lowConfidenceThreshold ?? 0.5;
    if (compositeScore.confidence < lowConfidenceThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Get the latest debate for a subject
   */
  async getLatestDebate(subjectId: string): Promise<RiskDebate | null> {
    return this.debateRepo.findLatestBySubject(subjectId);
  }

  /**
   * Get all debates for a subject
   */
  async getDebatesBySubject(subjectId: string): Promise<RiskDebate[]> {
    return this.debateRepo.findBySubject(subjectId);
  }

  /**
   * Get a specific debate by ID
   */
  async getDebateById(debateId: string): Promise<RiskDebate | null> {
    return this.debateRepo.findById(debateId);
  }
}
