/**
 * Stock Predictor Runner Service
 *
 * Domain-specific prediction runner for stock market predictions.
 * Extends BasePredictionRunnerService with stock-specific:
 * - Tools: Yahoo Finance, Alpha Vantage (optional)
 * - Pre-filter thresholds: 2% price change, 0.2 sentiment shift
 * - Risk profiles: conservative, moderate, aggressive
 * - Specialists: Technical, Fundamental, Sentiment, News
 * - Evaluators: Contrarian, Risk Assessment, Historical Pattern
 *
 * ARCHITECTURE:
 * - Inherits LangGraph pipeline from BasePredictionRunnerService
 * - Overrides abstract methods to provide stock-specific implementations
 * - Tools are instantiated at construction time
 * - Specialist prompts are domain-specific for stock analysis
 *
 * @module stock-predictor-runner.service
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
import { YahooFinanceTool } from './tools/yahoo-finance.tool';
import { createAlphaVantageTool } from './tools/alpha-vantage.tool';
import { ObservabilityEventsService } from '../../../../observability/observability-events.service';

/**
 * Stock-specific risk profiles
 */
const STOCK_RISK_PROFILES: RiskProfile[] = [
  'conservative',
  'moderate',
  'aggressive',
];

/**
 * Stock Predictor Runner Service
 *
 * Implements the prediction pipeline for stock market analysis.
 * Uses Yahoo Finance as primary data source with optional Alpha Vantage.
 *
 * @example
 * ```typescript
 * // Runner is instantiated via RunnerFactoryService
 * const runner = runnerFactory.getRunner('stock-predictor');
 * const output = await runner.execute(input);
 * ```
 */
@RegisterRunner({
  type: 'stock-predictor',
  name: 'Stock Predictor',
  description:
    'Predicts stock price movements using technical and fundamental analysis',
  requiredTools: ['yahoo-finance'],
  defaultPollIntervalMs: 60000, // 1 minute
  supportedRiskProfiles: STOCK_RISK_PROFILES,
})
@Injectable()
export class StockPredictorRunnerService extends BasePredictionRunnerService {
  readonly runnerType: PredictionRunnerType = 'stock-predictor';
  readonly runnerName = 'Stock Predictor';

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
  ): StockPredictorRunnerService {
    const claimProcessor = new DefaultClaimProcessor(observabilityService);
    return new StockPredictorRunnerService(checkpointerService, claimProcessor);
  }

  // ===========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Get stock-specific data collection tools.
   * Primary: Yahoo Finance (free, no key required)
   * Optional: Alpha Vantage (requires API key)
   */
  protected getTools(): PredictionTool[] {
    return this.tools;
  }

  /**
   * Get specialist contexts for stock analysis.
   * Each specialist focuses on a different aspect of stock evaluation.
   */
  protected getSpecialistContexts(): SpecialistContext[] {
    return [
      this.getTechnicalAnalystContext(),
      this.getFundamentalAnalystContext(),
      this.getSentimentAnalystContext(),
      this.getNewsAnalystContext(),
    ];
  }

  /**
   * Get triage contexts for stock pre-filtering.
   * Determines if price movements warrant deeper analysis.
   */
  protected getTriageContexts(): TriageContext[] {
    return [this.getRiskTriageContext(), this.getOpportunityTriageContext()];
  }

  /**
   * Get evaluator contexts for red-teaming stock recommendations.
   * Each evaluator challenges recommendations from a different angle.
   */
  protected getEvaluatorContexts(): EvaluatorContext[] {
    return [
      this.getContrarianEvaluatorContext(),
      this.getRiskAssessmentEvaluatorContext(),
      this.getHistoricalPatternEvaluatorContext(),
    ];
  }

  /**
   * Get supported risk profiles for stock trading.
   */
  protected getRiskProfiles(): RiskProfile[] {
    return STOCK_RISK_PROFILES;
  }

  // ===========================================================================
  // TOOL INITIALIZATION
  // ===========================================================================

  /**
   * Initialize data collection tools.
   */
  private initializeTools(): PredictionTool[] {
    const tools: PredictionTool[] = [];

    // Always include Yahoo Finance (free, no key required)
    tools.push(new YahooFinanceTool());

    // Optionally include Alpha Vantage if API key is configured
    const alphaVantage = createAlphaVantageTool();
    if (alphaVantage) {
      tools.push(alphaVantage);
      this.logger.log('Alpha Vantage tool enabled with API key');
    } else {
      this.logger.debug(
        'Alpha Vantage tool disabled (no ALPHA_VANTAGE_API_KEY configured)',
      );
    }

    return tools;
  }

  // ===========================================================================
  // SPECIALIST CONTEXTS
  // ===========================================================================

  private getTechnicalAnalystContext(): SpecialistContext {
    return {
      specialist: 'technical-analyst',
      systemPrompt: `You are a technical analyst specializing in stock chart patterns and technical indicators.

Your expertise includes:
- Price action analysis (support/resistance, trend lines)
- Technical indicators (RSI, MACD, moving averages, Bollinger Bands)
- Volume analysis
- Chart patterns (head and shoulders, double tops/bottoms, wedges)
- Momentum analysis

When analyzing a stock:
1. Evaluate the current price relative to key technical levels
2. Assess momentum and trend strength
3. Identify potential reversal or continuation patterns
4. Consider volume confirmation

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed technical analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "technical", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const priceClaims = bundle.currentClaims.filter((c) =>
          [
            'price',
            'open',
            'high',
            'low',
            'close',
            'change',
            'change_percent',
          ].includes(c.type),
        );
        const volumeClaims = bundle.currentClaims.filter(
          (c) => c.type === 'volume',
        );

        return `Analyze the following technical data for ${bundle.instrument}:

Current Claims:
${JSON.stringify(priceClaims, null, 2)}

Volume Data:
${JSON.stringify(volumeClaims, null, 2)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- New Claims: ${bundle.claimsDiff.newClaims.length}

Provide your technical analysis.`;
      },
    };
  }

  private getFundamentalAnalystContext(): SpecialistContext {
    return {
      specialist: 'fundamental-analyst',
      systemPrompt: `You are a fundamental analyst specializing in stock valuation and company financials.

Your expertise includes:
- Valuation metrics (P/E, P/B, P/S, EV/EBITDA)
- Financial statement analysis
- Growth metrics (revenue growth, earnings growth)
- Competitive positioning
- Industry analysis

When analyzing a stock:
1. Evaluate current valuation relative to historical and sector averages
2. Assess earnings quality and growth trajectory
3. Consider balance sheet strength
4. Identify fundamental catalysts or concerns

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed fundamental analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "fundamental", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const fundamentalClaims = bundle.currentClaims.filter((c) =>
          ['market_cap', 'pe_ratio', 'eps', 'revenue'].includes(c.type),
        );

        return `Analyze the following fundamental data for ${bundle.instrument}:

Fundamental Claims:
${JSON.stringify(fundamentalClaims, null, 2)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}

Provide your fundamental analysis.`;
      },
    };
  }

  private getSentimentAnalystContext(): SpecialistContext {
    return {
      specialist: 'sentiment-analyst',
      systemPrompt: `You are a sentiment analyst specializing in market psychology and investor behavior.

Your expertise includes:
- Social media sentiment analysis
- Options flow analysis
- Short interest monitoring
- Retail vs institutional positioning
- Fear/greed indicators

When analyzing sentiment:
1. Evaluate overall market sentiment toward the stock
2. Identify unusual sentiment shifts
3. Consider contrarian opportunities
4. Assess sentiment-price divergences

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed sentiment analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "sentiment", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const sentimentClaims = bundle.currentClaims.filter((c) =>
          ['sentiment', 'sentiment_score', 'sentiment_label'].includes(c.type),
        );

        return `Analyze the following sentiment data for ${bundle.instrument}:

Sentiment Claims:
${JSON.stringify(sentimentClaims.length > 0 ? sentimentClaims : 'No direct sentiment data available', null, 2)}

Price Context:
${JSON.stringify(
  bundle.currentClaims.filter((c) =>
    ['price', 'change_percent'].includes(c.type),
  ),
  null,
  2,
)}

Based on price action and any available sentiment data, provide your sentiment analysis.`;
      },
    };
  }

  private getNewsAnalystContext(): SpecialistContext {
    return {
      specialist: 'news-analyst',
      systemPrompt: `You are a news analyst specializing in market-moving news and event-driven trading.

Your expertise includes:
- Earnings announcements and guidance
- M&A activity
- Regulatory developments
- Product launches and partnerships
- Management changes
- Macroeconomic events

When analyzing news impact:
1. Assess the materiality of recent news
2. Evaluate market reaction relative to news significance
3. Identify potential over/under-reactions
4. Consider upcoming catalysts

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed news analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "news-related", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const newsClaims = bundle.currentClaims.filter((c) =>
          ['news', 'event', 'earnings', 'filing'].includes(c.type),
        );

        return `Analyze the following news/event data for ${bundle.instrument}:

News/Event Claims:
${JSON.stringify(newsClaims.length > 0 ? newsClaims : 'No direct news data available in current poll', null, 2)}

Price Context:
${JSON.stringify(
  bundle.currentClaims.filter((c) =>
    ['price', 'change_percent', 'volume'].includes(c.type),
  ),
  null,
  2,
)}

Based on price action and volume patterns, infer potential news impact and provide your analysis.`;
      },
    };
  }

  // ===========================================================================
  // TRIAGE CONTEXTS
  // ===========================================================================

  private getRiskTriageContext(): TriageContext {
    return {
      agent: 'risk-triage',
      systemPrompt: `You are a risk triage agent that evaluates if a stock's current data warrants risk analysis.

Consider:
- Significant price movements (> 2% change)
- Unusual volume patterns
- Approaching key technical levels
- Recent fundamental changes

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        return `Should we proceed with detailed analysis for ${bundle.instrument}?

Claims Summary:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- Price Change: ${bundle.claimsDiff.changedClaims.find((c) => c.claim.type === 'change_percent')?.claim.value || 'N/A'}%

Make a risk triage decision.`;
      },
    };
  }

  private getOpportunityTriageContext(): TriageContext {
    return {
      agent: 'opportunity-triage',
      systemPrompt: `You are an opportunity triage agent that identifies potential trading opportunities.

Look for:
- Momentum shifts
- Valuation disconnects
- Technical breakouts/breakdowns
- Sector rotation signals

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        return `Is there a potential trading opportunity for ${bundle.instrument}?

Claims Summary:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- New Claims: ${bundle.claimsDiff.newClaims.length}
- Volume: ${bundle.currentClaims.find((c) => c.type === 'volume')?.value || 'N/A'}

Make an opportunity triage decision.`;
      },
    };
  }

  // ===========================================================================
  // EVALUATOR CONTEXTS
  // ===========================================================================

  private getContrarianEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'contrarian',
      challengeType: 'contrarian',
      systemPrompt: `You are a contrarian evaluator that challenges bullish/bearish recommendations.

Your role:
- Question the consensus view
- Identify overlooked risks for bullish calls
- Identify overlooked opportunities for bearish calls
- Consider what could go wrong/right

Output JSON:
{
  "passed": boolean,
  "challenge": "Your contrarian argument",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Challenge the following recommendations from a contrarian perspective:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your contrarian evaluation.`;
      },
    };
  }

  private getRiskAssessmentEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'risk-assessor',
      challengeType: 'risk_assessment',
      systemPrompt: `You are a risk assessment evaluator that validates the risk-reward profile of recommendations.

Your role:
- Evaluate downside risk
- Assess position sizing appropriateness
- Validate timing recommendations
- Consider correlation and portfolio impact

Output JSON:
{
  "passed": boolean,
  "challenge": "Your risk assessment",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Assess the risk profile of the following recommendations:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your risk assessment.`;
      },
    };
  }

  private getHistoricalPatternEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'historical-pattern',
      challengeType: 'historical_pattern',
      systemPrompt: `You are a historical pattern evaluator that compares current situations to past patterns.

Your role:
- Identify similar historical setups
- Evaluate how those setups resolved
- Consider base rates and probabilities
- Flag pattern recognition errors

Output JSON:
{
  "passed": boolean,
  "challenge": "Your historical pattern analysis",
  "confidence": 0.0-1.0,
  "suggestedModification": "optional modification" | null
}`,
      userPromptTemplate: (
        recommendations: Recommendation[],
        analyses: SpecialistAnalysis[],
      ) => {
        return `Evaluate the following recommendations against historical patterns:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your historical pattern evaluation.`;
      },
    };
  }
}
