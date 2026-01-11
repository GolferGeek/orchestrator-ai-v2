/**
 * DeFi Analyst Specialist
 *
 * Provides DeFi protocol analysis context for LLM prompts.
 * Analyzes protocol metrics and liquidity.
 *
 * For crypto assets only.
 *
 * @module specialists/defi-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * DeFi Analyst specialist context.
 * For crypto assets only.
 */
export function getDeFiAnalystContext(): SpecialistContext {
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
