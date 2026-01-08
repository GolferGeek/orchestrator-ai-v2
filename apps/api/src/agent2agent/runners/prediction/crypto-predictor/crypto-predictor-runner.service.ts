/**
 * Crypto Predictor Runner Service
 *
 * Domain-specific prediction runner for cryptocurrency predictions.
 * Extends BasePredictionRunnerService with crypto-specific:
 * - Tools: Binance, CoinGecko, Etherscan, Whale Alert, DefiLlama
 * - Pre-filter thresholds: 5% price change (crypto is more volatile)
 * - Risk profiles: hodler, trader, degen
 * - Specialists: OnChain, DeFi, Market Sentiment, Technical
 * - Evaluators: Contrarian, Risk Assessment, Historical Pattern
 *
 * ARCHITECTURE:
 * - Inherits LangGraph pipeline from BasePredictionRunnerService
 * - Overrides abstract methods to provide crypto-specific implementations
 * - Tools are instantiated at construction time
 * - Specialist prompts are domain-specific for crypto analysis
 * - Default poll interval: 30s (crypto markets move faster than stocks)
 *
 * @module crypto-predictor-runner.service
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
import { BinanceTool } from './tools/binance.tool';
import { CoinGeckoTool } from './tools/coingecko.tool';
import { createEtherscanTool } from './tools/etherscan.tool';
import { WhaleAlertTool } from './tools/whale-alerts.tool';
import { DefiLlamaTool } from './tools/defillama.tool';
import { ObservabilityEventsService } from '../../../../observability/observability-events.service';

/**
 * Crypto-specific risk profiles
 */
const CRYPTO_RISK_PROFILES: RiskProfile[] = ['hodler', 'trader', 'degen'];

/**
 * Crypto Predictor Runner Service
 *
 * Implements the prediction pipeline for cryptocurrency analysis.
 * Uses Binance and CoinGecko as primary data sources with optional
 * Etherscan, Whale Alert, and DefiLlama for enhanced analysis.
 *
 * @example
 * ```typescript
 * // Runner is instantiated via RunnerFactoryService
 * const runner = runnerFactory.getRunner('crypto-predictor');
 * const output = await runner.execute(input);
 * ```
 */
@RegisterRunner({
  type: 'crypto-predictor',
  name: 'Crypto Predictor',
  description:
    'Predicts cryptocurrency price movements using on-chain and market analysis',
  requiredTools: ['binance', 'coingecko'],
  defaultPollIntervalMs: 30000, // 30 seconds - crypto markets are faster
  supportedRiskProfiles: CRYPTO_RISK_PROFILES,
})
@Injectable()
export class CryptoPredictorRunnerService extends BasePredictionRunnerService {
  readonly runnerType: PredictionRunnerType = 'crypto-predictor';
  readonly runnerName = 'Crypto Predictor';

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
  ): CryptoPredictorRunnerService {
    const claimProcessor = new DefaultClaimProcessor(observabilityService);
    return new CryptoPredictorRunnerService(
      checkpointerService,
      claimProcessor,
    );
  }

  // ===========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Get crypto-specific data collection tools.
   * Primary: Binance (price/volume), CoinGecko (market cap/supply)
   * Optional: Etherscan (gas prices), Whale Alert (whale movements), DefiLlama (TVL)
   */
  protected getTools(): PredictionTool[] {
    return this.tools;
  }

  /**
   * Get specialist contexts for crypto analysis.
   * Each specialist focuses on a different aspect of crypto evaluation.
   */
  protected getSpecialistContexts(): SpecialistContext[] {
    return [
      this.getOnChainAnalystContext(),
      this.getDeFiAnalystContext(),
      this.getMarketSentimentContext(),
      this.getTechnicalAnalystContext(),
    ];
  }

  /**
   * Get triage contexts for crypto pre-filtering.
   * Determines if price movements warrant deeper analysis.
   */
  protected getTriageContexts(): TriageContext[] {
    return [this.getRiskTriageContext(), this.getOpportunityTriageContext()];
  }

  /**
   * Get evaluator contexts for red-teaming crypto recommendations.
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
   * Get supported risk profiles for crypto trading.
   */
  protected getRiskProfiles(): RiskProfile[] {
    return CRYPTO_RISK_PROFILES;
  }

  // ===========================================================================
  // TOOL INITIALIZATION
  // ===========================================================================

  /**
   * Initialize data collection tools.
   */
  private initializeTools(): PredictionTool[] {
    const tools: PredictionTool[] = [];

    // Always include Binance (free, no key required)
    tools.push(new BinanceTool());

    // Always include CoinGecko (free, no key required)
    tools.push(new CoinGeckoTool());

    // Optionally include Etherscan if API key is configured
    const etherscan = createEtherscanTool();
    if (etherscan) {
      tools.push(etherscan);
      this.logger.log('Etherscan tool enabled with API key');
    } else {
      this.logger.debug(
        'Etherscan tool disabled (no ETHERSCAN_API_KEY configured)',
      );
    }

    // Always include Whale Alert (uses mock data if no API key)
    tools.push(new WhaleAlertTool());

    // Always include DefiLlama (free, no key required)
    tools.push(new DefiLlamaTool());

    return tools;
  }

  // ===========================================================================
  // SPECIALIST CONTEXTS
  // ===========================================================================

  private getOnChainAnalystContext(): SpecialistContext {
    return {
      specialist: 'onchain-analyst',
      systemPrompt: `You are an on-chain analyst specializing in blockchain data and whale movements.

Your expertise includes:
- Whale transaction analysis (large transfers, exchange flows)
- Gas price trends (network congestion indicators)
- Exchange inflow/outflow patterns
- Network activity metrics
- Holder distribution analysis

When analyzing a cryptocurrency:
1. Evaluate whale movements and their implications
2. Assess gas prices as network demand indicator
3. Identify exchange flow patterns (accumulation vs distribution)
4. Consider on-chain metrics as price catalysts

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed on-chain analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "onchain", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const whaleClaims = bundle.currentClaims.filter((c) =>
          ['whale_transaction', 'gas_price'].includes(c.type),
        );
        const volumeClaims = bundle.currentClaims.filter(
          (c) => c.type === 'volume',
        );

        return `Analyze the following on-chain data for ${bundle.instrument}:

Whale/Gas Claims:
${JSON.stringify(whaleClaims.length > 0 ? whaleClaims : 'No whale/gas data available', null, 2)}

Volume Data:
${JSON.stringify(volumeClaims, null, 2)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- New Claims: ${bundle.claimsDiff.newClaims.length}

Provide your on-chain analysis.`;
      },
    };
  }

  private getDeFiAnalystContext(): SpecialistContext {
    return {
      specialist: 'defi-analyst',
      systemPrompt: `You are a DeFi analyst specializing in protocol metrics and liquidity analysis.

Your expertise includes:
- Total Value Locked (TVL) trends
- Protocol revenue and fees
- Liquidity depth and distribution
- Yield farming dynamics
- Token utility and tokenomics

When analyzing a cryptocurrency:
1. Evaluate TVL changes and protocol health
2. Assess revenue generation and sustainability
3. Consider liquidity as a price stability factor
4. Identify DeFi-specific catalysts or risks

Output your analysis as JSON with the following structure:
{
  "conclusion": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "analysis": "Your detailed DeFi analysis",
  "suggestedAction": "buy" | "sell" | "hold" | null,
  "riskFactors": ["list", "of", "defi", "risks"]
}`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const defiClaims = bundle.currentClaims.filter((c) =>
          ['tvl', 'protocol_revenue'].includes(c.type),
        );
        const marketCapClaims = bundle.currentClaims.filter(
          (c) => c.type === 'market_cap',
        );

        return `Analyze the following DeFi data for ${bundle.instrument}:

DeFi Protocol Claims:
${JSON.stringify(defiClaims.length > 0 ? defiClaims : 'No direct DeFi data available', null, 2)}

Market Cap Data:
${JSON.stringify(marketCapClaims, null, 2)}

Historical Context:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}

Provide your DeFi analysis.`;
      },
    };
  }

  private getMarketSentimentContext(): SpecialistContext {
    return {
      specialist: 'market-sentiment',
      systemPrompt: `You are a crypto market sentiment analyst specializing in social dynamics and market psychology.

Your expertise includes:
- Social media sentiment (Twitter, Reddit, Discord)
- Fear & Greed Index
- Funding rates and perpetual swap dynamics
- Retail vs institutional positioning
- Hype cycles and FOMO/FUD detection

When analyzing sentiment:
1. Evaluate overall market sentiment toward the crypto
2. Identify extreme sentiment shifts (contrarian opportunities)
3. Assess social momentum vs price action
4. Consider sentiment as a reversal or continuation signal

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
    ['price', 'change_percent', 'volume'].includes(c.type),
  ),
  null,
  2,
)}

Based on price action, volume patterns, and any available sentiment data, provide your sentiment analysis.
Consider crypto-specific factors like social media hype, fear/greed cycles, and retail sentiment.`;
      },
    };
  }

  private getTechnicalAnalystContext(): SpecialistContext {
    return {
      specialist: 'technical-analyst',
      systemPrompt: `You are a technical analyst specializing in cryptocurrency chart patterns and indicators.

Your expertise includes:
- Crypto-specific price action (volatile, 24/7 markets)
- Technical indicators (RSI, MACD, Bollinger Bands)
- Support/resistance levels
- Chart patterns (bull flags, wedges, head & shoulders)
- Volume confirmation in crypto markets

When analyzing a cryptocurrency:
1. Evaluate current price relative to key technical levels
2. Assess momentum and trend strength
3. Identify potential reversal or continuation patterns
4. Consider 24/7 market dynamics and volatility

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

Provide your technical analysis for this cryptocurrency.`;
      },
    };
  }

  // ===========================================================================
  // TRIAGE CONTEXTS
  // ===========================================================================

  private getRiskTriageContext(): TriageContext {
    return {
      agent: 'risk-triage',
      systemPrompt: `You are a risk triage agent that evaluates if a crypto's current data warrants risk analysis.

Consider:
- Significant price movements (> 5% change - crypto is more volatile than stocks)
- Unusual volume patterns or whale movements
- Gas price spikes (network congestion)
- TVL changes (protocol health)

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        return `Should we proceed with detailed analysis for ${bundle.instrument}?

Claims Summary:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- Changed Claims: ${bundle.claimsDiff.changedClaims.length}
- Price Change: ${bundle.claimsDiff.changedClaims.find((c) => c.claim.type === 'change_percent')?.claim.value || 'N/A'}%

Make a risk triage decision for this cryptocurrency.`;
      },
    };
  }

  private getOpportunityTriageContext(): TriageContext {
    return {
      agent: 'opportunity-triage',
      systemPrompt: `You are an opportunity triage agent that identifies potential crypto trading opportunities.

Look for:
- Strong momentum shifts (crypto moves fast)
- Whale accumulation/distribution patterns
- DeFi protocol growth (TVL increases)
- Technical breakouts with volume
- Network activity spikes

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        return `Is there a potential trading opportunity for ${bundle.instrument}?

Claims Summary:
- Significance Score: ${bundle.claimsDiff.significanceScore}
- New Claims: ${bundle.claimsDiff.newClaims.length}
- Volume: ${bundle.currentClaims.find((c) => c.type === 'volume')?.value || 'N/A'}

Make an opportunity triage decision for this cryptocurrency.`;
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
      systemPrompt: `You are a contrarian evaluator that challenges crypto trading recommendations.

Your role:
- Question the hype and FOMO
- Identify overlooked risks for bullish calls
- Identify overlooked opportunities for bearish calls
- Consider crypto-specific risks (regulation, hacks, rug pulls)

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
        return `Challenge the following crypto recommendations from a contrarian perspective:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your contrarian evaluation for this cryptocurrency.`;
      },
    };
  }

  private getRiskAssessmentEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'risk-assessor',
      challengeType: 'risk_assessment',
      systemPrompt: `You are a risk assessment evaluator that validates the risk-reward profile of crypto recommendations.

Your role:
- Evaluate downside risk (crypto is highly volatile)
- Assess position sizing appropriateness
- Validate timing recommendations
- Consider crypto-specific risks (smart contract bugs, regulatory changes)

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
        return `Assess the risk profile of the following crypto recommendations:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your risk assessment for this cryptocurrency.`;
      },
    };
  }

  private getHistoricalPatternEvaluatorContext(): EvaluatorContext {
    return {
      evaluator: 'historical-pattern',
      challengeType: 'historical_pattern',
      systemPrompt: `You are a historical pattern evaluator that compares current crypto situations to past patterns.

Your role:
- Identify similar historical crypto setups
- Evaluate how those setups resolved (bull runs, crashes, etc.)
- Consider crypto market cycles and seasonality
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
        return `Evaluate the following crypto recommendations against historical patterns:

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Supporting Analyses:
${JSON.stringify(analyses, null, 2)}

Provide your historical pattern evaluation for this cryptocurrency.`;
      },
    };
  }
}
