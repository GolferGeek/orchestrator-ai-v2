/**
 * Sentiment Analyst Specialist
 *
 * Provides sentiment analysis context for LLM prompts.
 * Analyzes market psychology and investor behavior.
 *
 * @module specialists/sentiment-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * Sentiment Analyst specialist context.
 * Shared across all asset types (stocks, crypto, forex).
 */
export function getSentimentAnalystContext(): SpecialistContext {
  return {
    specialist: 'sentiment-analyst',
    systemPrompt: `You are a sentiment analyst specializing in market psychology and investor behavior across all asset types.

Your expertise includes:
- Social media sentiment analysis
- Options flow analysis (for stocks)
- Funding rates (for crypto)
- Short interest monitoring
- Retail vs institutional positioning
- Fear/greed indicators
- FOMO/FUD detection (especially for crypto)

When analyzing sentiment:
1. Evaluate overall market sentiment toward the asset
2. Identify unusual sentiment shifts
3. Consider contrarian opportunities
4. Assess sentiment-price divergences
5. Consider crypto-specific factors like social media hype for crypto assets

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

Based on price action and any available sentiment data, provide your sentiment analysis.`;
    },
  };
}
