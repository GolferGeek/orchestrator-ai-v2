---
description: "Generate predictions from active predictors using Claude reasoning"
category: "prediction"
uses-skills: []
uses-agents: []
related-commands: ["run-prediction-pipeline", "process-signals", "track-outcomes"]
---

# Generate Predictions

Evaluate predictor thresholds and generate predictions for targets with sufficient evidence.

**Usage:** `/generate-predictions`

## What This Does

1. Finds targets with >= 2 active predictors with 100% consensus (or >= 3 with 60%+ consensus)
2. Analyzes predictor consensus and strength
3. Generates predictions with confidence and reasoning
4. Marks consumed predictors
5. Emits observability events for activity feed
6. Logs completion to observability table

## EXECUTE THIS PROCESS

### Step 1: Log Invocation

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'generate-predictions', '1.0.0', 'invoked',
  '{\"triggered_by\": \"user\", \"step\": \"3-predictions\"}'::jsonb);"
```

### Step 2: Get Targets Meeting Predictor Threshold

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT t.id, t.symbol, t.name,
       COUNT(p.id) as predictor_count,
       ROUND(AVG(p.strength)::numeric, 2) as avg_strength,
       ROUND(AVG(p.confidence)::numeric, 2) as avg_confidence,
       SUM(CASE WHEN p.direction = 'bullish' THEN 1 ELSE 0 END) as bullish_count,
       SUM(CASE WHEN p.direction = 'bearish' THEN 1 ELSE 0 END) as bearish_count,
       SUM(CASE WHEN p.direction = 'neutral' THEN 1 ELSE 0 END) as neutral_count
FROM prediction.targets t
JOIN prediction.predictors p ON p.target_id = t.id
WHERE t.is_active = true
AND p.status = 'active'
AND p.expires_at > NOW()
AND p.is_test = false
GROUP BY t.id, t.symbol, t.name
HAVING COUNT(p.id) >= 2
ORDER BY COUNT(p.id) DESC, AVG(p.strength) DESC;"
```

### Step 3: For Each Qualifying Target - Get Predictor Details

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT p.id, p.direction, p.strength, p.confidence, p.reasoning,
       p.analyst_slug, p.created_at
FROM prediction.predictors p
WHERE p.target_id = '{TARGET_ID}'
AND p.status = 'active'
AND p.expires_at > NOW()
ORDER BY p.strength DESC, p.confidence DESC;"
```

### Step 4: Emit predictor.ready Event (When Threshold Met)

For each target meeting threshold:
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO public.observability_events (
  source_app,
  hook_event_type,
  task_id,
  agent_slug,
  organization_slug,
  status,
  message,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'predictor.ready',
  'generate-predictions-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'generate-predictions',
  'system',
  'threshold_met',
  'Predictor threshold met for {TARGET_SYMBOL}: {PREDICTOR_COUNT} predictors, {CONSENSUS}% consensus',
  jsonb_build_object(
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'activeCount', {PREDICTOR_COUNT},
    'combinedStrength', {AVG_STRENGTH},
    'directionConsensus', {CONSENSUS},
    'dominantDirection', '{DOMINANT_DIRECTION}',
    'bullishCount', {BULLISH_COUNT},
    'bearishCount', {BEARISH_COUNT},
    'neutralCount', {NEUTRAL_COUNT},
    'avgConfidence', {AVG_CONFIDENCE}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 5: Claude Generates Prediction

For each qualifying target, analyze the predictors and generate a prediction:

**Evaluation criteria:**
1. **Direction Consensus**: What % agree on direction?
2. **Strength Consensus**: Average strength of predictors
3. **Confidence Level**: Combined confidence score

**Direction calculation:**
- If 100% agree on one direction (even with 2 predictors) → use that direction
- If bullish_ratio > 0.6 → direction = 'up'
- If bearish_ratio > 0.6 → direction = 'down'
- Otherwise → direction = 'flat'

**Confidence calculation:**
```
consensus = max(bullish_ratio, bearish_ratio, neutral_ratio)
confidence = (consensus * 0.4) + (avg_predictor_confidence * 0.4) + (avg_strength/10 * 0.2)
```

**Magnitude estimation:**
- Based on predictor strength and count
- 'small' (< 2% expected), 'medium' (2-5%), 'large' (> 5%)

**Return prediction:**
```json
{
  "target_id": "uuid",
  "target_symbol": "AAPL",
  "direction": "up",
  "confidence": 0.72,
  "magnitude": "medium",
  "timeframe_hours": 24,
  "reasoning": "4 of 5 predictors bullish (80% consensus), avg strength 7.2. Recent earnings beat and positive guidance support upward movement.",
  "predictor_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Step 6: Insert Prediction AND Emit Event

**Insert Prediction:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO prediction.predictions (
  target_id,
  direction,
  confidence,
  magnitude,
  reasoning,
  timeframe_hours,
  predicted_at,
  expires_at,
  analyst_ensemble,
  llm_ensemble,
  status,
  created_at,
  updated_at
)
VALUES (
  '{TARGET_ID}'::uuid,
  '{DIRECTION}',
  {CONFIDENCE},
  '{MAGNITUDE}',
  '{REASONING}',
  {TIMEFRAME_HOURS},
  NOW(),
  NOW() + INTERVAL '{TIMEFRAME_HOURS} hours',
  '{ANALYST_ENSEMBLE_JSON}'::jsonb,
  '{\"model\": \"claude-opus-4-5-20251101\", \"provider\": \"anthropic\", \"command\": \"generate-predictions\"}'::jsonb,
  'active',
  NOW(),
  NOW()
)
RETURNING id, target_id, direction, confidence;"
```

**Emit prediction.created observability event:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO public.observability_events (
  source_app,
  hook_event_type,
  task_id,
  agent_slug,
  organization_slug,
  status,
  message,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'prediction.created',
  'generate-predictions-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'generate-predictions',
  'system',
  'created',
  'Prediction created for {TARGET_SYMBOL}: {DIRECTION} ({CONFIDENCE} confidence)',
  jsonb_build_object(
    'predictionId', '{PREDICTION_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'direction', '{DIRECTION}',
    'magnitude', '{MAGNITUDE}',
    'confidence', {CONFIDENCE},
    'timeframeHours', {TIMEFRAME_HOURS},
    'expiresAt', '{EXPIRES_AT}',
    'predictorCount', {PREDICTOR_COUNT},
    'combinedStrength', {AVG_STRENGTH},
    'directionConsensus', {CONSENSUS}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 7: Mark Predictors as Consumed

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE prediction.predictors
SET status = 'consumed',
    consumed_at = NOW(),
    consumed_by_prediction_id = '{PREDICTION_ID}'::uuid,
    updated_at = NOW()
WHERE id IN ({PREDICTOR_IDS});"
```

### Step 7B: Create Prediction Snapshot (for Lineage/Deep Dive)

**IMPORTANT**: This step is required for the prediction lineage tree to work in the UI.

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO prediction.snapshots (
  prediction_id,
  predictors,
  rejected_signals,
  analyst_predictions,
  llm_ensemble,
  learnings_applied,
  threshold_evaluation,
  timeline,
  is_test_data,
  created_at
)
VALUES (
  '{PREDICTION_ID}'::uuid,
  -- predictors: array of predictor details
  '[
    {
      \"predictor_id\": \"{PREDICTOR_1_ID}\",
      \"signal_id\": \"{SIGNAL_1_ID}\",
      \"direction\": \"{DIRECTION_1}\",
      \"strength\": {STRENGTH_1},
      \"confidence\": {CONFIDENCE_1},
      \"analyst_slug\": \"{ANALYST_1}\",
      \"signal_content\": \"{SIGNAL_1_CONTENT}\",
      \"created_at\": \"{PREDICTOR_1_CREATED_AT}\"
    }
  ]'::jsonb,
  -- rejected_signals: empty for now
  '[]'::jsonb,
  -- analyst_predictions: use analyst_ensemble data
  '{ANALYST_ENSEMBLE}'::jsonb,
  -- llm_ensemble: use llm_ensemble data
  '{LLM_ENSEMBLE}'::jsonb,
  -- learnings_applied: empty for now
  '[]'::jsonb,
  -- threshold_evaluation
  jsonb_build_object(
    'min_predictors', 2,
    'actual_predictors', {PREDICTOR_COUNT},
    'min_combined_strength', 4,
    'actual_combined_strength', {AVG_STRENGTH},
    'min_consensus', 0.6,
    'actual_consensus', {CONSENSUS},
    'passed', true
  ),
  -- timeline
  jsonb_build_array(
    jsonb_build_object(
      'event', 'prediction_created',
      'timestamp', NOW()::text,
      'details', jsonb_build_object('direction', '{DIRECTION}', 'confidence', {CONFIDENCE})
    )
  ),
  false,
  NOW()
);"
```

**Note**: The `predictors` array should include ALL predictors that were consumed for this prediction. Build this JSON array dynamically based on the predictor details collected in Step 3.

### Step 8: Emit Batch Completion Event

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO public.observability_events (
  source_app,
  hook_event_type,
  task_id,
  agent_slug,
  organization_slug,
  status,
  message,
  progress,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'prediction.generation.completed',
  'generate-predictions-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'generate-predictions',
  'system',
  'completed',
  'Generated {M} predictions from {P} predictors across {N} targets',
  100,
  jsonb_build_object(
    'targetsEvaluated', {N},
    'predictionsCreated', {M},
    'predictorsConsumed', {P},
    'directionBreakdown', jsonb_build_object('up', {UP_COUNT}, 'down', {DOWN_COUNT}, 'flat', {FLAT_COUNT})
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 9: Log Completion to Artifact Events

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'generate-predictions', '1.0.0', 'completed', true,
  '{\"targets_evaluated\": N, \"predictions_created\": M, \"predictors_consumed\": P}'::jsonb);"
```

### Step 10: Output Summary

Show:
- Targets evaluated
- Predictions created
- Breakdown by direction (up/down/flat)
- Predictors consumed
- Sample predictions with reasoning

## Threshold Requirements

| Requirement | Default | Description |
|-------------|---------|-------------|
| min_predictors | 2 | Minimum active predictors needed (with 100% consensus) |
| min_predictors_mixed | 3 | Minimum if consensus < 100% |
| min_consensus | 0.6 | Minimum direction agreement (60%) |
| min_avg_strength | 4 | Minimum average predictor strength |

## Direction Mapping

| Predictor Direction | Prediction Direction |
|--------------------|---------------------|
| bullish | up |
| bearish | down |
| neutral | flat |

## Magnitude Categories

| Magnitude | Expected Move | Typical Scenarios |
|-----------|---------------|-------------------|
| small | < 2% | Routine news, minor updates |
| medium | 2-5% | Earnings, product launches |
| large | > 5% | Major news, sector shifts |

## Observability Events Emitted

| Event Type | When | Payload |
|------------|------|---------|
| `predictor.ready` | Target meets threshold | targetSymbol, activeCount, directionConsensus, dominantDirection |
| `prediction.created` | Each prediction generated | predictionId, targetSymbol, direction, magnitude, confidence |
| `prediction.generation.completed` | End of batch | targetsEvaluated, predictionsCreated, predictorsConsumed |

## Notes

- Targets with 2 predictors qualify if they have 100% consensus
- Consumed predictors can't be used again
- Predictions default to 24-hour timeframe
- Each prediction tracks which predictors it consumed for lineage
- All events appear in the prediction activity feed
