/**
 * Technical Analyst Specialist
 *
 * Provides technical analysis context for LLM prompts.
 * Analyzes chart patterns, indicators, and price action.
 *
 * @module specialists/technical-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * Technical Analyst specialist context.
 * Shared across all asset types (stocks, crypto, forex).
 */
export function getTechnicalAnalystContext(): SpecialistContext {
  return {
    specialist: 'technical-analyst',
    systemPrompt: `You are a technical analyst specializing in chart patterns and technical indicators for all asset types (stocks, crypto, forex).

Your expertise includes:
- Price action analysis (support/resistance, trend lines)
- Technical indicators (RSI, MACD, moving averages, Bollinger Bands)
- Volume analysis
- Chart patterns (head and shoulders, double tops/bottoms, wedges)
- Momentum analysis
- 24/7 market dynamics for crypto assets

When analyzing an asset:
1. Evaluate the current price relative to key technical levels
2. Assess momentum and trend strength
3. Identify potential reversal or continuation patterns
4. Consider volume confirmation
5. Account for asset-specific volatility (crypto is more volatile than stocks)

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
