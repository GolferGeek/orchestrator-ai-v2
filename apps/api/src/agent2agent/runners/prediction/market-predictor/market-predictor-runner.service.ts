/**
 * Market Predictor Runner Service
 *
 * Domain-specific prediction runner for Polymarket prediction markets.
 * Extends BasePredictionRunnerService with market-specific:
 * - Tools: Polymarket CLOB, Gamma API, Resolution Tracker, News API (optional)
 * - Pre-filter thresholds: 5% odds shift threshold
 * - Risk profiles: researcher, speculator
 * - Specialists: Market Analyst, Event Analyst, Info Analyst, Contrarian Analyst
 * - Evaluators: Source Verification, Timing Analysis, Outcome Likelihood
 *
 * ARCHITECTURE:
 * - Inherits LangGraph pipeline from BasePredictionRunnerService
 * - Overrides abstract methods to provide market-specific implementations
 * - Tools are instantiated at construction time
 * - Specialist prompts are domain-specific for prediction market analysis
 *
 * @module market-predictor-runner.service
 */

import { Injectable } from '@nestjs/common';
import {
  BasePredictionRunnerService,
  PredictionTool,
  SpecialistContext,
  TriageContext,
  EvaluatorContext,
} from '../base/base-prediction-runner.service';
import { PostgresCheckpointerService } from '../base/postgres-checkpointer.service';
import { IClaimProcessor } from '../base/claim-processor.interface';
import { DefaultClaimProcessor } from '../base/default-claim-processor';
import {
  PredictionRunnerType,
  RiskProfile,
  EnrichedClaimBundle,
  Recommendation,
  SpecialistAnalysis,
} from '../base/base-prediction.types';
import { RegisterRunner } from '../runner.registry';
import { PolymarketOddsTool } from './tools/polymarket-odds.tool';
import { GammaApiTool } from './tools/gamma-api.tool';
import { ResolutionTrackerTool } from './tools/resolution-tracker.tool';
import { createNewsApiTool } from './tools/news-api.tool';
import { ObservabilityEventsService } from '../../../../observability/observability-events.service';

/**
 * Market-specific risk profiles
 */
const MARKET_RISK_PROFILES: RiskProfile[] = [
  'researcher', // Conservative, evidence-based betting
  'speculator', // Aggressive, opportunistic betting
];

/**
 * Market Predictor Runner Service
 *
 * Implements the prediction pipeline for Polymarket prediction markets.
 * Uses Polymarket CLOB API as primary data source with optional News API.
 *
 * @example
 * ```typescript
 * // Runner is instantiated via RunnerFactoryService
 * const runner = runnerFactory.getRunner('market-predictor');
 * const output = await runner.execute(input);
 * ```
 */
@RegisterRunner({
  type: 'market-predictor',
  name: 'Market Predictor',
  description:
    'Predicts Polymarket prediction market outcomes using odds analysis and event tracking',
  requiredTools: ['polymarket-odds'],
  defaultPollIntervalMs: 60000, // 1 minute
  supportedRiskProfiles: MARKET_RISK_PROFILES,
})
@Injectable()
export class MarketPredictorRunnerService extends BasePredictionRunnerService {
  readonly runnerType: PredictionRunnerType = 'market-predictor';
  readonly runnerName = 'Market Predictor';

  private readonly tools: PredictionTool[];

  constructor(
    checkpointerService: PostgresCheckpointerService,
    claimProcessor: IClaimProcessor,
  ) {
    super(checkpointerService, claimProcessor);
    this.tools = this.initializeTools();
  }

  /**
   * Factory method for creating with dependencies.
   */
  static create(
    checkpointerService: PostgresCheckpointerService,
    observabilityService: ObservabilityEventsService,
  ): MarketPredictorRunnerService {
    const claimProcessor = new DefaultClaimProcessor(observabilityService);
    return new MarketPredictorRunnerService(
      checkpointerService,
      claimProcessor,
    );
  }

  // ===========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Get market-specific data collection tools.
   * Primary: Polymarket CLOB API (free, no key required)
   * Optional: News API (requires API key)
   */
  protected getTools(): PredictionTool[] {
    return this.tools;
  }

  /**
   * Get specialist contexts for market analysis.
   * Each specialist focuses on a different aspect of market evaluation.
   */
  protected getSpecialistContexts(): SpecialistContext[] {
    return [
      this.getMarketAnalystContext(),
      this.getEventAnalystContext(),
      this.getInfoAnalystContext(),
      this.getContrarianAnalystContext(),
    ];
  }

  /**
   * Get triage contexts for market pre-filtering.
   * Determines if odds movements warrant deeper analysis.
   */
  protected getTriageContexts(): TriageContext[] {
    return [
      this.getOddsMovementTriageContext(),
      this.getResolutionProximityTriageContext(),
    ];
  }

  /**
   * Get evaluator contexts for red-teaming market recommendations.
   * Each evaluator challenges recommendations from a different angle.
   */
  protected getEvaluatorContexts(): EvaluatorContext[] {
    return [
      this.getSourceVerificationEvaluatorContext(),
      this.getTimingAnalysisEvaluatorContext(),
      this.getOutcomeLikelihoodEvaluatorContext(),
    ];
  }

  /**
   * Get supported risk profiles for market betting.
   */
  protected getRiskProfiles(): RiskProfile[] {
    return MARKET_RISK_PROFILES;
  }

  // ===========================================================================
  // TOOL INITIALIZATION
  // ===========================================================================

  /**
   * Initialize data collection tools.
   */
  private initializeTools(): PredictionTool[] {
    const tools: PredictionTool[] = [];

    // Always include Polymarket CLOB API (free, no key required)
    tools.push(new PolymarketOddsTool());

    // Always include Gamma API for metadata
    tools.push(new GammaApiTool());

    // Always include Resolution Tracker
    tools.push(new ResolutionTrackerTool());

    // Optionally include News API if API key is configured
    const newsApi = createNewsApiTool();
    if (newsApi) {
      tools.push(newsApi);
      this.logger.log('News API tool enabled with API key');
    } else {
      this.logger.debug(
        'News API tool disabled (no NEWSAPI_API_KEY configured)',
      );
    }

    return tools;
  }

  // ===========================================================================
  // SPECIALIST CONTEXTS
  // ===========================================================================

  private getMarketAnalystContext(): SpecialistContext {
    return {
      specialist: 'market-analyst',
      systemPrompt: `You are a market analyst specializing in Polymarket prediction markets.

Your expertise includes:
- Market liquidity analysis (order book depth, spread)
- Volume patterns and trends
- Odds movements and probability shifts
- Market microstructure (bid/ask dynamics)
- Liquidity provider behavior

When analyzing a market:
1. Evaluate current odds relative to historical movements
2. Assess market liquidity and trading activity
3. Identify unusual order flow patterns
4. Consider market maker positioning

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed market analysis",
  "suggestedAction": "bet_yes" | "bet_no" | "wait" | null,
  "riskFactors": ["list", "of", "market", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const oddsClaims = bundle.currentClaims.filter((c) =>
          ['odds', 'probability'].includes(c.type),
        );
        const volumeClaims = bundle.currentClaims.filter(
          (c) => c.type === 'volume',
        );
        const liquidityClaims = bundle.currentClaims.filter(
          (c) => c.metadata?.claimSubtype === 'liquidity',
        );

        return `Analyze the following market data for ${bundle.instrument}:

Current Odds/Probabilities:
${JSON.stringify(oddsClaims, null, 2)}

Volume Data:
${JSON.stringify(volumeClaims, null, 2)}

Liquidity Data:
${JSON.stringify(liquidityClaims, null, 2)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- New Claims: ${bundle.claimsDiff.newClaims.length}

Provide your market analysis.`;
      },
    };
  }

  private getEventAnalystContext(): SpecialistContext {
    return {
      specialist: 'event-analyst',
      systemPrompt: `You are an event analyst specializing in real-world events that affect prediction markets.

Your expertise includes:
- News event analysis and impact assessment
- Event timing and catalysts
- Information flow and market reaction
- Event-driven probability shifts
- Resolution likelihood based on events

When analyzing events:
1. Assess the materiality of recent events to market resolution
2. Evaluate if market has priced in event information
3. Identify potential upcoming catalysts
4. Consider event-resolution correlation

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed event analysis",
  "suggestedAction": "bet_yes" | "bet_no" | "wait" | null,
  "riskFactors": ["list", "of", "event-related", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const eventClaims = bundle.currentClaims.filter((c) =>
          ['event', 'news'].includes(c.type),
        );

        return `Analyze the following event data for ${bundle.instrument}:

Event/News Claims:
${JSON.stringify(eventClaims.length > 0 ? eventClaims : 'No recent events tracked', null, 2)}

Odds Context:
${JSON.stringify(
  bundle.currentClaims.filter((c) => ['odds', 'probability'].includes(c.type)),
  null,
  2,
)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- New Events: ${bundle.claimsDiff.newClaims.filter((c) => c.type === 'event').length}

Based on event data and odds movements, provide your analysis.`;
      },
    };
  }

  private getInfoAnalystContext(): SpecialistContext {
    return {
      specialist: 'info-analyst',
      systemPrompt: `You are an information analyst specializing in resolution sources and information asymmetry.

Your expertise includes:
- Resolution source tracking and verification
- Information quality assessment
- Information timing advantages
- Market information efficiency
- Early resolution signal detection

When analyzing information sources:
1. Evaluate quality and reliability of available information
2. Assess if market is informationally efficient
3. Identify potential information advantages
4. Look for early resolution hints

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed information analysis",
  "suggestedAction": "bet_yes" | "bet_no" | "wait" | null,
  "riskFactors": ["list", "of", "information", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const resolutionClaims = bundle.currentClaims.filter(
          (c) => c.type === 'resolution',
        );
        const newsClaims = bundle.currentClaims.filter(
          (c) => c.type === 'news',
        );

        return `Analyze the following information sources for ${bundle.instrument}:

Resolution Data:
${JSON.stringify(resolutionClaims.length > 0 ? resolutionClaims : 'No resolution data yet', null, 2)}

News Sources:
${JSON.stringify(newsClaims.length > 0 ? newsClaims : 'No news tracked', null, 2)}

Market Odds:
${JSON.stringify(
  bundle.currentClaims.filter((c) => c.type === 'probability'),
  null,
  2,
)}

Assess information quality and potential resolution hints.`;
      },
    };
  }

  private getContrarianAnalystContext(): SpecialistContext {
    return {
      specialist: 'contrarian-analyst',
      systemPrompt: `You are a contrarian analyst specializing in finding mispriced prediction markets.

Your expertise includes:
- Identifying overreactions to news
- Spotting herd behavior and crowding
- Finding value in unpopular positions
- Cognitive bias detection in market pricing
- Base rate analysis

When analyzing markets:
1. Question the consensus odds
2. Look for overreactions to recent events
3. Identify cognitive biases affecting pricing
4. Consider base rates and historical patterns
5. Find value where others see none

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed contrarian analysis",
  "suggestedAction": "bet_yes" | "bet_no" | "wait" | null,
  "riskFactors": ["list", "of", "contrarian", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const oddsClaims = bundle.currentClaims.filter(
          (c) => c.type === 'probability',
        );
        const volumeClaims = bundle.currentClaims.filter(
          (c) => c.type === 'volume',
        );

        return `Look for mispricing opportunities in ${bundle.instrument}:

Current Odds:
${JSON.stringify(oddsClaims, null, 2)}

Volume/Activity:
${JSON.stringify(volumeClaims, null, 2)}

Recent Changes:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Odds Shifts: ${bundle.claimsDiff.changedClaims.filter((c) => ['odds', 'probability'].includes(c.claim.type)).length}

Is the market overreacting or missing something? Provide your contrarian perspective.`;
      },
    };
  }

  // ===========================================================================
  // TRIAGE CONTEXTS
  // ===========================================================================

  private getOddsMovementTriageContext(): TriageContext {
    return {
      agent: 'odds-movement-triage',
      systemPrompt: `You are an odds movement triage agent that evaluates if a market's odds shifts warrant deeper analysis.

Consider:
- Significant odds movements (> 5% probability shift)
- Large volume changes
- Unusual liquidity patterns
- Rapid odds changes

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const oddsChanges = bundle.claimsDiff.changedClaims.filter((c) =>
          ['odds', 'probability'].includes(c.claim.type),
        );

        return `Should we proceed with detailed analysis for ${bundle.instrument}?

Odds Changes:
${JSON.stringify(oddsChanges, null, 2)}

Claims Summary:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- New Claims: ${bundle.claimsDiff.newClaims.length}

Make an odds movement triage decision.`;
      },
    };
  }

  private getResolutionProximityTriageContext(): TriageContext {
    return {
      agent: 'resolution-proximity-triage',
      systemPrompt: `You are a resolution proximity triage agent that identifies markets approaching resolution.

Look for:
- Markets near resolution date
- Resolution sources becoming available
- Event completion signals
- Early resolution opportunities

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const resolutionClaims = bundle.claimsDiff.newClaims.filter(
          (c) => c.type === 'resolution',
        );
        const eventClaims = bundle.claimsDiff.newClaims.filter(
          (c) => c.type === 'event',
        );

        return `Is ${bundle.instrument} approaching resolution?

New Resolution/Event Data:
- Resolution Claims: ${resolutionClaims.length}
- Event Claims: ${eventClaims.length}

Claims:
${JSON.stringify([...resolutionClaims, ...eventClaims], null, 2)}

Should we analyze for potential resolution-based opportunities?`;
      },
    };
  }

  // ===========================================================================
  // EVALUATOR CONTEXTS
  // ===========================================================================

  private getSourceVerificationEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'source-verification',
      challengeType: 'contrarian',
      systemPrompt: `You are a source verification evaluator that validates the evidence quality of recommendations.

Your role:
- Verify information source reliability
- Check for confirmation bias in evidence selection
- Identify missing counter-evidence
- Assess information completeness

Output JSON:
{
  "passed": boolean,
  "challenge": "Your source verification concerns",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Verify the source quality of the following recommendations:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Are the information sources reliable and complete?`;
      },
    };
  }

  private getTimingAnalysisEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'timing-analysis',
      challengeType: 'timing',
      systemPrompt: `You are a timing analysis evaluator that validates bet timing recommendations.

Your role:
- Evaluate optimal entry timing
- Assess liquidity for position sizing
- Consider time until resolution
- Identify better entry opportunities

Output JSON:
{
  "passed": boolean,
  "challenge": "Your timing analysis",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Assess the timing of the following recommendations:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Is this the optimal time to enter these positions?`;
      },
    };
  }

  private getOutcomeLikelihoodEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'outcome-likelihood',
      challengeType: 'historical_pattern',
      systemPrompt: `You are an outcome likelihood evaluator that validates probability assessments.

Your role:
- Evaluate base rates for similar events
- Compare market odds to fundamental probability
- Identify probability estimation errors
- Challenge overconfident predictions

Output JSON:
{
  "passed": boolean,
  "challenge": "Your outcome likelihood assessment",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Evaluate the outcome likelihood of the following recommendations:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Are the probability assessments reasonable given base rates and evidence?`;
      },
    };
  }
}
