/**
 * News Analyst Specialist
 *
 * Provides news/event analysis context for LLM prompts.
 * Analyzes market-moving news and event-driven opportunities.
 *
 * For traditional assets only (stocks/ETFs).
 *
 * @module specialists/news-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * News Analyst specialist context.
 * For traditional assets only (stocks/ETFs).
 */
export function getNewsAnalystContext(): SpecialistContext {
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
