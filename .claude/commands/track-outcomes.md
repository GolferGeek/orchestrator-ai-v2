---
description: "Resolve pending predictions by checking actual outcomes"
category: "prediction"
uses-skills: []
uses-agents: []
related-commands: ["run-prediction-pipeline", "generate-predictions"]
---

# Track Outcomes

Check predictions that have reached their expiration and resolve them as win/loss.

**Usage:** `/track-outcomes`

## What This Does

1. Finds predictions that have expired (expires_at <= NOW)
2. Gets start price (at prediction time) and end price (current)
3. Calculates actual return and determines outcome
4. Updates prediction status and outcome_value
5. Emits observability events for activity feed
6. Logs completion to observability table

## EXECUTE THIS PROCESS

### Step 1: Log Invocation

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'track-outcomes', '1.0.0', 'invoked',
  '{\"triggered_by\": \"user\", \"step\": \"4-outcomes\"}'::jsonb);"
```

### Step 2: Get Predictions Due for Resolution

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT p.id, p.target_id, p.direction, p.confidence, p.magnitude,
       p.predicted_at, p.expires_at, p.reasoning,
       t.symbol, t.name
FROM prediction.predictions p
JOIN prediction.targets t ON t.id = p.target_id
WHERE p.status = 'active'
AND p.expires_at <= NOW()
AND p.is_test = false
ORDER BY p.expires_at ASC
LIMIT 50;"
```

### Step 3: For Each Prediction - Get Price Data

Get the start price (closest to prediction time):
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT value, captured_at
FROM prediction.target_snapshots
WHERE target_id = '{TARGET_ID}'
AND captured_at <= '{PREDICTED_AT}'
ORDER BY captured_at DESC
LIMIT 1;"
```

Get the end price (most recent):
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT value, captured_at
FROM prediction.target_snapshots
WHERE target_id = '{TARGET_ID}'
ORDER BY captured_at DESC
LIMIT 1;"
```

### Step 4: Calculate Outcome

For each prediction:

**Calculate actual return:**
```
actual_return = ((end_price - start_price) / start_price) * 100
```

**Determine outcome:**
- If direction = 'up' and actual_return > 0.5% → WIN
- If direction = 'down' and actual_return < -0.5% → WIN
- If direction = 'flat' and |actual_return| < 0.5% → WIN
- Otherwise → LOSS

**Note:** 0.5% threshold accounts for noise/transaction costs

**Return resolution:**
```json
{
  "prediction_id": "uuid",
  "start_price": 150.25,
  "end_price": 153.50,
  "actual_return": 2.16,
  "direction_predicted": "up",
  "direction_actual": "up",
  "outcome": "win",
  "notes": "Predicted up, actual +2.16% - correct direction call"
}
```

### Step 5: Update Prediction Status AND Emit Events

**Update prediction:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE prediction.predictions
SET status = 'resolved',
    outcome_value = {ACTUAL_RETURN},
    outcome_captured_at = NOW(),
    resolution_notes = '{NOTES}',
    updated_at = NOW()
WHERE id = '{PREDICTION_ID}';"
```

**Emit prediction.resolved observability event:**
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
  'prediction.resolved',
  'track-outcomes-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'track-outcomes',
  'system',
  '{OUTCOME}',
  'Prediction resolved for {TARGET_SYMBOL}: {OUTCOME} ({ACTUAL_RETURN}%)',
  jsonb_build_object(
    'predictionId', '{PREDICTION_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'predictedDirection', '{DIRECTION}',
    'actualReturn', {ACTUAL_RETURN},
    'outcome', '{OUTCOME}',
    'startPrice', {START_PRICE},
    'endPrice', {END_PRICE},
    'timeframeHours', {TIMEFRAME_HOURS}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Emit prediction.evaluated observability event (for accuracy tracking):**
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
  'prediction.evaluated',
  'track-outcomes-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'track-outcomes',
  'system',
  '{CORRECT_OR_INCORRECT}',
  'Prediction evaluated for {TARGET_SYMBOL}: {CORRECT_OR_INCORRECT}',
  jsonb_build_object(
    'predictionId', '{PREDICTION_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'directionCorrect', {DIRECTION_CORRECT},
    'predictedDirection', '{DIRECTION}',
    'actualDirection', '{ACTUAL_DIRECTION}',
    'predictedConfidence', {CONFIDENCE},
    'actualReturn', {ACTUAL_RETURN},
    'magnitudeAccuracy', {MAGNITUDE_ACCURACY}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 6: Handle Missing Price Data

If no price snapshots found, mark as expired (not resolvable):
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE prediction.predictions
SET status = 'expired',
    resolution_notes = 'No price data available for resolution',
    updated_at = NOW()
WHERE id = '{PREDICTION_ID}';"
```

**Emit prediction.expired observability event:**
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
  'prediction.expired',
  'track-outcomes-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'track-outcomes',
  'system',
  'expired',
  'Prediction expired for {TARGET_SYMBOL}: no price data',
  jsonb_build_object(
    'predictionId', '{PREDICTION_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'reason', 'no_price_data',
    'predictedDirection', '{DIRECTION}'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 7: Emit Batch Completion Event

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
  'outcome.tracking.completed',
  'track-outcomes-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'track-outcomes',
  'system',
  'completed',
  'Resolved {N} predictions: {W} wins, {L} losses ({WIN_RATE}% win rate)',
  100,
  jsonb_build_object(
    'predictionsResolved', {N},
    'wins', {W},
    'losses', {L},
    'expired', {E},
    'winRate', {WIN_RATE},
    'avgReturn', {AVG_RETURN}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 8: Log Completion to Artifact Events

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'track-outcomes', '1.0.0', 'completed', true,
  '{\"predictions_resolved\": N, \"wins\": W, \"losses\": L, \"expired\": E}'::jsonb);"
```

### Step 9: Output Summary

Show:
- Total predictions resolved
- Win/Loss breakdown
- Win rate percentage
- Expired (missing data) count
- Sample outcomes with returns

## Outcome Determination

| Predicted | Actual Move | Outcome |
|-----------|-------------|---------|
| up | > +0.5% | WIN |
| up | < +0.5% | LOSS |
| down | < -0.5% | WIN |
| down | > -0.5% | LOSS |
| flat | within ±0.5% | WIN |
| flat | outside ±0.5% | LOSS |

## Resolution Notes Format

```
"Predicted {direction}, actual {actual_return}% - {correct|incorrect} direction"
```

Examples:
- "Predicted up, actual +2.16% - correct direction call"
- "Predicted down, actual +1.5% - incorrect direction call"
- "Predicted flat, actual -0.3% - correct stability call"

## Observability Events Emitted

| Event Type | When | Status | Payload |
|------------|------|--------|---------|
| `prediction.resolved` | Each prediction resolved | win/loss | predictionId, targetSymbol, actualReturn, outcome |
| `prediction.evaluated` | Each prediction scored | correct/incorrect | directionCorrect, magnitudeAccuracy |
| `prediction.expired` | Missing price data | expired | predictionId, targetSymbol, reason |
| `outcome.tracking.completed` | End of batch | completed | predictionsResolved, wins, losses, winRate |

## Notes

- Only resolve predictions that have expired (expires_at <= NOW)
- Need both start and end price snapshots for resolution
- Predictions without price data are marked 'expired' not 'resolved'
- outcome_value stores the percentage return
- Win rate should be tracked over time for model evaluation
- All events appear in the prediction activity feed
