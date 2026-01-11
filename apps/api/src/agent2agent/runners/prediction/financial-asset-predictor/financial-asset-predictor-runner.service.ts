/**
 * Financial Asset Predictor Runner Service
 *
 * Unified prediction runner for all financial asset types:
 * - Stocks (AAPL, TSLA, etc.)
 * - ETFs (SPY, QQQ, etc.)
 * - Cryptocurrencies (BTC, ETH, etc.)
 * - Forex (EUR/USD, etc.)
 *
 * ARCHITECTURE:
 * - Inherits LangGraph pipeline from BasePredictionRunnerService
 * - Conditionally includes tools and specialists based on instrument types
 * - Supports both traditional (conservative, moderate, aggressive) and
 *   crypto (hodler, trader, degen) risk profiles
 *
 * @module financial-asset-predictor-runner.service
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
  Recommendation,
  SpecialistAnalysis,
  EnrichedClaimBundle,
  TargetType,
} from '../base/base-prediction.types';
import { RegisterRunner } from '../runner.registry';
import { YahooFinanceTool } from './tools/yahoo-finance.tool';
import { createAlphaVantageTool } from './tools/alpha-vantage.tool';
import { BinanceTool } from './tools/binance.tool';
import { CoinGeckoTool } from './tools/coingecko.tool';
import { createEtherscanTool } from './tools/etherscan.tool';
import { WhaleAlertTool } from './tools/whale-alerts.tool';
import { DefiLlamaTool } from './tools/defillama.tool';
import { ObservabilityEventsService } from '../../../../observability/observability-events.service';

// Specialist context providers
import {
  getTechnicalAnalystContext,
  getSentimentAnalystContext,
  getFundamentalAnalystContext,
  getNewsAnalystContext,
  getOnChainAnalystContext,
  getDeFiAnalystContext,
} from './specialists';

/**
 * Unified risk profiles supporting both traditional and crypto terminology
 */
const FINANCIAL_ASSET_RISK_PROFILES: RiskProfile[] = [
  // Traditional profiles
  'conservative',
  'moderate',
  'aggressive',
  // Crypto profiles (map to similar risk levels)
  'hodler', // Maps to conservative
  'trader', // Maps to moderate
  'degen', // Maps to aggressive
];

/**
 * Supported target types for this runner
 */
const SUPPORTED_TARGET_TYPES: TargetType[] = [
  'stock',
  'etf',
  'crypto',
  'forex',
];

/**
 * Known crypto symbols for auto-detection
 */
const CRYPTO_SYMBOLS = new Set([
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'ADA',
  'SOL',
  'DOGE',
  'DOT',
  'AVAX',
  'MATIC',
  'LINK',
  'UNI',
  'ATOM',
  'LTC',
  'BCH',
  'NEAR',
  'ALGO',
  'VET',
  'ICP',
  'FIL',
  'SHIB',
  'AAVE',
  'SAND',
  'MANA',
  'APE',
  'CRV',
  'MKR',
  'SNX',
  'COMP',
  'YFI',
  'SUSHI',
  'RUNE',
  'LDO',
  'ARB',
  'OP',
]);

/**
 * Financial Asset Predictor Runner Service
 *
 * Unified runner for stocks, ETFs, crypto, and forex predictions.
 * Automatically detects instrument type and applies appropriate tools/specialists.
 *
 * @example
 * ```typescript
 * // Runner is instantiated via RunnerFactoryService
 * const runner = runnerFactory.getRunner('financial-asset-predictor');
 * const output = await runner.execute(input);
 * ```
 */
@RegisterRunner({
  type: 'financial-asset-predictor',
  name: 'Financial Asset Predictor',
  description:
    'Unified predictor for stocks, ETFs, crypto, and forex using technical, fundamental, and on-chain analysis',
  requiredTools: ['yahoo-finance'],
  defaultPollIntervalMs: 60000, // 1 minute for stocks, can be overridden
  supportedRiskProfiles: FINANCIAL_ASSET_RISK_PROFILES,
  supportedTargetTypes: SUPPORTED_TARGET_TYPES,
})
@Injectable()
export class FinancialAssetPredictorRunnerService extends BasePredictionRunnerService {
  readonly runnerType: PredictionRunnerType = 'financial-asset-predictor';
  readonly runnerName = 'Financial Asset Predictor';

  private readonly stockTools: PredictionTool[];
  private readonly cryptoTools: PredictionTool[];
  private currentInstruments: string[] = [];

  constructor(
    checkpointerService: PostgresCheckpointerService,
    claimProcessor: IClaimProcessor,
  ) {
    super(checkpointerService, claimProcessor);
    this.stockTools = this.initializeStockTools();
    this.cryptoTools = this.initializeCryptoTools();
  }

  /**
   * Factory method for creating with dependencies.
   */
  static create(
    checkpointerService: PostgresCheckpointerService,
    observabilityService: ObservabilityEventsService,
  ): FinancialAssetPredictorRunnerService {
    const claimProcessor = new DefaultClaimProcessor(observabilityService);
    return new FinancialAssetPredictorRunnerService(
      checkpointerService,
      claimProcessor,
    );
  }

  // ===========================================================================
  // INSTRUMENT TYPE DETECTION
  // ===========================================================================

  /**
   * Set the current instruments being processed.
   * Called before getTools() and getSpecialistContexts().
   */
  setCurrentInstruments(instruments: string[]): void {
    this.currentInstruments = instruments;
  }

  /**
   * Check if any instrument is a crypto asset.
   */
  hasCryptoInstruments(): boolean {
    return this.currentInstruments.some((instrument) =>
      this.isCryptoInstrument(instrument),
    );
  }

  /**
   * Check if any instrument is a traditional asset (stock/ETF/forex).
   */
  hasTraditionalInstruments(): boolean {
    return this.currentInstruments.some(
      (instrument) => !this.isCryptoInstrument(instrument),
    );
  }

  /**
   * Detect if an instrument is a cryptocurrency.
   */
  private isCryptoInstrument(instrument: string): boolean {
    const upperSymbol = instrument.toUpperCase().replace(/-.*/, '');
    return (
      CRYPTO_SYMBOLS.has(upperSymbol) ||
      instrument.includes('USDT') ||
      instrument.includes('BUSD') ||
      instrument.toLowerCase().includes('bitcoin') ||
      instrument.toLowerCase().includes('ethereum')
    );
  }

  // ===========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Get tools based on current instrument types.
   * Combines stock and crypto tools as needed.
   */
  protected getTools(): PredictionTool[] {
    const tools: PredictionTool[] = [];

    // Add stock tools if we have traditional instruments
    if (this.hasTraditionalInstruments()) {
      tools.push(...this.stockTools);
    }

    // Add crypto tools if we have crypto instruments
    if (this.hasCryptoInstruments()) {
      tools.push(...this.cryptoTools);
    }

    // If no instruments set yet, return all tools
    if (tools.length === 0) {
      return [...this.stockTools, ...this.cryptoTools];
    }

    return tools;
  }

  /**
   * Get specialist contexts based on current instrument types.
   * Conditionally includes crypto-specific specialists.
   */
  protected getSpecialistContexts(): SpecialistContext[] {
    const contexts: SpecialistContext[] = [
      // Always include these for all asset types
      getTechnicalAnalystContext(),
      getSentimentAnalystContext(),
    ];

    // Add traditional specialists for stocks/ETFs
    if (this.hasTraditionalInstruments()) {
      contexts.push(getFundamentalAnalystContext());
      contexts.push(getNewsAnalystContext());
    }

    // Add crypto-specific specialists
    if (this.hasCryptoInstruments()) {
      contexts.push(getOnChainAnalystContext());
      contexts.push(getDeFiAnalystContext());
    }

    return contexts;
  }

  /**
   * Get triage contexts for pre-filtering.
   */
  protected getTriageContexts(): TriageContext[] {
    return [this.getRiskTriageContext(), this.getOpportunityTriageContext()];
  }

  /**
   * Get evaluator contexts for red-teaming recommendations.
   */
  protected getEvaluatorContexts(): EvaluatorContext[] {
    return [
      this.getContrarianEvaluatorContext(),
      this.getRiskAssessmentEvaluatorContext(),
      this.getHistoricalPatternEvaluatorContext(),
    ];
  }

  /**
   * Get supported risk profiles for all asset types.
   */
  protected getRiskProfiles(): RiskProfile[] {
    return FINANCIAL_ASSET_RISK_PROFILES;
  }

  // ===========================================================================
  // TOOL INITIALIZATION
  // ===========================================================================

  /**
   * Initialize stock/ETF data collection tools.
   */
  private initializeStockTools(): PredictionTool[] {
    const tools: PredictionTool[] = [];

    // Always include Yahoo Finance (free, no key required)
    tools.push(new YahooFinanceTool());

    // Optionally include Alpha Vantage if API key is configured
    const alphaVantage = createAlphaVantageTool();
    if (alphaVantage) {
      tools.push(alphaVantage);
      this.logger.log('Alpha Vantage tool enabled with API key');
    }

    return tools;
  }

  /**
   * Initialize crypto data collection tools.
   */
  private initializeCryptoTools(): PredictionTool[] {
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
    }

    // Always include Whale Alert (uses mock data if no API key)
    tools.push(new WhaleAlertTool());

    // Always include DefiLlama (free, no key required)
    tools.push(new DefiLlamaTool());

    return tools;
  }

  // ===========================================================================
  // TRIAGE CONTEXTS
  // ===========================================================================

  private getRiskTriageContext(): TriageContext {
    return {
      agent: 'risk-triage',
      systemPrompt: `You are a risk triage agent that evaluates if an asset's current data warrants risk analysis.

Consider:
- Significant price movements (> 2% for stocks, > 5% for crypto)
- Unusual volume patterns
- Approaching key technical levels
- Recent fundamental changes (stocks) or on-chain activity (crypto)

Output JSON: { "proceed": boolean, "confidence": 0.0-1.0, "reason": "explanation" }`,
      userPromptTemplate: (bundle: EnrichedClaimBundle) => {
        const isCrypto = this.isCryptoInstrument(bundle.instrument);
        const threshold = isCrypto ? 5 : 2;

        return `Should we proceed with detailed analysis for ${bundle.instrument}?

Asset Type: ${isCrypto ? 'Cryptocurrency' : 'Stock/ETF'}
Significance Threshold: ${threshold}% price change

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
- Valuation disconnects (stocks) or TVL changes (crypto)
- Technical breakouts/breakdowns
- Sector rotation signals (stocks) or DeFi trends (crypto)

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
- For crypto: Challenge FOMO/FUD narratives

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
- Evaluate downside risk (crypto is more volatile than stocks)
- Assess position sizing appropriateness
- Validate timing recommendations
- Consider correlation and portfolio impact
- For crypto: Consider regulatory and smart contract risks

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
- For crypto: Consider market cycles and seasonality

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
