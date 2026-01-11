/**
 * On-Chain Analyst Specialist
 *
 * Provides on-chain analysis context for LLM prompts.
 * Analyzes blockchain data and whale movements.
 *
 * For crypto assets only.
 *
 * @module specialists/onchain-analyst
 */

import { SpecialistContext } from '../../base/base-prediction-runner.service';
import { EnrichedClaimBundle } from '../../base/base-prediction.types';

/**
 * On-Chain Analyst specialist context.
 * For crypto assets only.
 */
export function getOnChainAnalystContext(): SpecialistContext {
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
