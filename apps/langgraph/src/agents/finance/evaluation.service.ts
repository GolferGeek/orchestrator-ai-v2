import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { FinanceDbService } from "./finance-db.service";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ExecutionContext } from "@orchestrator-ai/transport-types";
import { createMarketDataChain } from "./connectors";

interface PendingRecommendation {
  id: string;
  run_id: string;
  instrument: string;
  action: string;
  timing_window: string;
  intended_price?: number;
  rationale: string;
  created_at: string;
}

export interface EvaluationResult {
  recommendationId: string;
  outcome: {
    id: string;
    realizedReturnMetrics: Record<string, number>;
    winLoss: "win" | "loss" | "neutral";
    evaluationNotes: string;
    evaluatedAt: string;
  };
  postmortem?: {
    id: string;
    whatHappened: string;
    whyItHappened: string;
    linkedAgendaEvents: string[];
    lessons: string[];
  };
}

/**
 * EvaluationService
 *
 * Implements the learning loop evaluation pipeline.
 * Runs after market close to:
 * 1. Fetch pending recommendations
 * 2. Get realized prices
 * 3. Compute outcomes
 * 4. Generate postmortem explanations via LLM
 * 5. Store results for future learning
 */
@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly marketDataChain = createMarketDataChain();

  constructor(
    private readonly financeDb: FinanceDbService,
    private readonly llmClient: LLMHttpClientService,
  ) {}

  /**
   * Run evaluation for all pending recommendations
   */
  async evaluatePendingRecommendations(
    context: ExecutionContext,
    lookbackHours: number = 48,
  ): Promise<EvaluationResult[]> {
    this.logger.log(`Starting evaluation for pending recommendations`);

    // Get pending recommendations (those without outcomes)
    const pending = await this.getPendingRecommendations(lookbackHours);
    this.logger.log(`Found ${pending.length} pending recommendations`);

    if (pending.length === 0) {
      return [];
    }

    const results: EvaluationResult[] = [];

    for (const rec of pending) {
      try {
        const result = await this.evaluateRecommendation(rec, context);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to evaluate recommendation ${rec.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Completed evaluation of ${results.length} recommendations`,
    );
    return results;
  }

  /**
   * Get pending recommendations that need evaluation
   */
  private async getPendingRecommendations(
    lookbackHours: number,
  ): Promise<PendingRecommendation[]> {
    // This would query the database for recommendations without outcomes
    // For now, return from the db service
    return await this.financeDb.getPendingRecommendations(lookbackHours);
  }

  /**
   * Evaluate a single recommendation
   */
  private async evaluateRecommendation(
    rec: PendingRecommendation,
    context: ExecutionContext,
  ): Promise<EvaluationResult> {
    // Get current price for the instrument
    const quotes = await this.marketDataChain.fetchQuotes([rec.instrument]);
    const currentQuote = quotes.find((q) => q.instrument === rec.instrument);

    if (!currentQuote) {
      return this.createNeutralOutcome(rec, "Could not fetch current price");
    }

    // Calculate return
    const entryPrice = rec.intended_price || currentQuote.open;
    const exitPrice = currentQuote.close;
    const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

    // Determine win/loss based on action and return
    let winLoss: "win" | "loss" | "neutral";
    if (rec.action === "buy") {
      winLoss = returnPct > 0.5 ? "win" : returnPct < -0.5 ? "loss" : "neutral";
    } else if (rec.action === "sell") {
      winLoss = returnPct < -0.5 ? "win" : returnPct > 0.5 ? "loss" : "neutral";
    } else {
      winLoss = Math.abs(returnPct) < 1 ? "win" : "loss"; // Hold wins if stable
    }

    const outcome = {
      id: uuidv4(),
      realizedReturnMetrics: {
        returnPct,
        entryPrice,
        exitPrice,
        holdingPeriodHours:
          (Date.now() - new Date(rec.created_at).getTime()) / (60 * 60 * 1000),
      },
      winLoss,
      evaluationNotes: `${rec.action.toUpperCase()} ${rec.instrument}: ${returnPct.toFixed(2)}% return. ${winLoss.toUpperCase()}.`,
      evaluatedAt: new Date().toISOString(),
    };

    // Store outcome
    await this.financeDb.storeOutcome({
      ...outcome,
      recommendationId: rec.id,
    });

    // Generate postmortem via LLM
    const postmortem = await this.generatePostmortem(rec, outcome, context);

    if (postmortem) {
      await this.financeDb.storePostmortem({
        ...postmortem,
        recommendationId: rec.id,
      });
    }

    return {
      recommendationId: rec.id,
      outcome,
      postmortem,
    };
  }

  /**
   * Create neutral outcome when evaluation isn't possible
   */
  private createNeutralOutcome(
    rec: PendingRecommendation,
    reason: string,
  ): EvaluationResult {
    return {
      recommendationId: rec.id,
      outcome: {
        id: uuidv4(),
        realizedReturnMetrics: {},
        winLoss: "neutral",
        evaluationNotes: reason,
        evaluatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate postmortem explanation via LLM
   */
  private async generatePostmortem(
    rec: PendingRecommendation,
    outcome: EvaluationResult["outcome"],
    context: ExecutionContext,
  ): Promise<EvaluationResult["postmortem"] | undefined> {
    const systemMessage = `You are a financial analyst generating postmortem explanations for trading recommendations.

Analyze the recommendation and its outcome, then provide:
1. What happened: Factual description of price movement
2. Why it happened: Analysis of market factors, news, and patterns that led to the outcome
3. Lessons: Actionable insights for future recommendations

Format your response as JSON with fields: whatHappened, whyItHappened, lessons (array).`;

    const userMessage = `Analyze this recommendation outcome:

Recommendation:
- Instrument: ${rec.instrument}
- Action: ${rec.action}
- Timing: ${rec.timing_window}
- Rationale: ${rec.rationale}
- Created: ${rec.created_at}

Outcome:
- Result: ${outcome.winLoss}
- Return: ${outcome.realizedReturnMetrics.returnPct?.toFixed(2)}%
- Entry Price: ${outcome.realizedReturnMetrics.entryPrice}
- Exit Price: ${outcome.realizedReturnMetrics.exitPrice}
- Notes: ${outcome.evaluationNotes}

Provide analysis of what happened and why.`;

    try {
      const response = await this.llmClient.callLLM({
        context,
        systemMessage,
        userMessage,
        temperature: 0.3,
        callerName: "finance-research:postmortem",
      });

      const parsed = JSON.parse(response.text);
      return {
        id: uuidv4(),
        whatHappened: parsed.whatHappened || "",
        whyItHappened: parsed.whyItHappened || "",
        linkedAgendaEvents: [], // Could be populated by matching against stored agenda events
        lessons: parsed.lessons || [],
      };
    } catch (error) {
      this.logger.error("Failed to generate postmortem:", error);
      return undefined;
    }
  }

  /**
   * Get learning context for future recommendations
   * Aggregates lessons from recent postmortems
   */
  async getLearningContext(
    instruments: string[],
    limit: number = 10,
  ): Promise<string> {
    // This would query recent postmortems for the given instruments
    // and format them as learning context for the recommendation LLM
    // For now, return a placeholder
    return `Recent lessons for ${instruments.join(", ")}:\n- Consider market volatility before aggressive positions\n- News-driven moves often revert within 24-48 hours`;
  }
}
