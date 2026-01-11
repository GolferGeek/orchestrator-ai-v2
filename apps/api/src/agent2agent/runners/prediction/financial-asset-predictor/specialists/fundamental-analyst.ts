/**
 * Fundamental Analyst Specialist
 *
 * Provides fundamental analysis context for LLM prompts.
 * Analyzes company financials and valuation metrics.
 *
 * For traditional assets only (stocks/ETFs).
 *
 * @module specialists/fundamental-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * Fundamental Analyst specialist context.
 * For traditional assets only (stocks/ETFs).
 */
export function getFundamentalAnalystContext(): SpecialistContext {
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
