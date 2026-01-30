---
description: "Process pending signals through Tier 1 detection to create predictors"
category: "prediction"
uses-skills: []
uses-agents: []
related-commands: ["run-prediction-pipeline", "generate-signals", "generate-predictions"]
---

# Process Signals

Evaluate pending signals and create predictors for those that pass quality thresholds.

**Usage:** `/process-signals`

## What This Does

1. Gets pending signals that haven't been processed
2. Claude evaluates each signal for quality and trading potential
3. Approved signals become predictors with strength and confidence
4. Rejected signals are marked with reason
5. Emits observability events for activity feed
6. Logs completion to observability table

## EXECUTE THIS PROCESS

### Step 1: Log Invocation

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'process-signals', '1.0.0', 'invoked',
  '{\"triggered_by\": \"user\", \"step\": \"2-process\"}'::jsonb);"
```

### Step 2: Get Pending Signals

Focus on Claude-analyzed signals first (high quality):
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT s.id, s.target_id, s.content, s.direction, s.url,
       s.detected_at, s.metadata,
       t.symbol, t.name as target_name
FROM prediction.signals s
JOIN prediction.targets t ON t.id = s.target_id
WHERE s.disposition = 'pending'
AND s.metadata->>'claude_analysis' = 'true'
AND s.created_at >= NOW() - INTERVAL '7 days'
ORDER BY s.created_at DESC
LIMIT 50;"
```

### Step 3: Evaluate Each Signal

For each pending signal, Claude evaluates:

1. **Signal Quality** (0.0 - 1.0)
   - Is the content actionable?
   - Is the source reliable?
   - Is the information timely?

2. **Trading Potential**
   - Clear direction indicator?
   - Sufficient magnitude expected?
   - Reasonable timeframe?

3. **Decision**: Approve or Reject

**Approval criteria:**
- Quality score >= 0.5
- Clear directional signal
- Reasonable confidence in outcome

**Return evaluation:**
```json
{
  "signal_id": "uuid",
  "decision": "approve" | "reject",
  "confidence": 0.75,
  "reasoning": "Strong earnings beat with raised guidance supports bullish thesis",
  "strength": 7,
  "expires_hours": 24
}
```

### Step 4A: For Approved Signals - Create Predictor AND Emit Events

**Insert Predictor:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO prediction.predictors (
  signal_id,
  target_id,
  direction,
  strength,
  confidence,
  reasoning,
  analyst_slug,
  analyst_assessment,
  status,
  expires_at,
  created_at,
  updated_at
)
VALUES (
  '{SIGNAL_ID}'::uuid,
  '{TARGET_ID}'::uuid,
  '{DIRECTION}',
  {STRENGTH},
  {CONFIDENCE},
  '{REASONING}',
  'claude-signal-processor',
  '{\"decision\": \"approve\", \"quality_score\": {QUALITY}, \"source\": \"{SOURCE}\", \"catalyst\": \"{CATALYST}\"}'::jsonb,
  'active',
  NOW() + INTERVAL '{EXPIRES_HOURS} hours',
  NOW(),
  NOW()
)
RETURNING id, target_id, direction, strength;"
```

**Emit signal.detected observability event (approved):**
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
  'signal.detected',
  'process-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'process-signals',
  'system',
  'approved',
  'Signal approved for {TARGET_SYMBOL}: {DIRECTION} (confidence: {CONFIDENCE})',
  jsonb_build_object(
    'signalId', '{SIGNAL_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'direction', '{DIRECTION}',
    'confidence', {CONFIDENCE},
    'strength', {STRENGTH},
    'shouldCreatePredictor', true,
    'reasoning', '{REASONING}'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Emit predictor.created observability event:**
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
  'predictor.created',
  'process-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'process-signals',
  'system',
  'created',
  'Predictor created for {TARGET_SYMBOL}: {DIRECTION} strength {STRENGTH}',
  jsonb_build_object(
    'predictorId', '{PREDICTOR_ID}',
    'signalId', '{SIGNAL_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'direction', '{DIRECTION}',
    'strength', {STRENGTH},
    'confidence', {CONFIDENCE},
    'expiresAt', '{EXPIRES_AT}',
    'analystSlug', 'claude-signal-processor'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 4B: Update Signal Disposition

For approved signals:
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE prediction.signals
SET disposition = 'predictor_created',
    evaluation_result = jsonb_build_object(
      'decision', 'approve',
      'confidence', {CONFIDENCE},
      'reasoning', '{REASONING}',
      'processed_by', 'claude-signal-processor',
      'processed_at', NOW()::text
    ),
    updated_at = NOW()
WHERE id = '{SIGNAL_ID}';"
```

For rejected signals:
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE prediction.signals
SET disposition = 'rejected',
    evaluation_result = jsonb_build_object(
      'decision', 'reject',
      'reason', '{REJECTION_REASON}',
      'explanation', '{EXPLANATION}',
      'processed_by', 'claude-signal-processor',
      'processed_at', NOW()::text
    ),
    updated_at = NOW()
WHERE id = '{SIGNAL_ID}';"
```

**Emit signal.detected observability event (rejected):**
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
  'signal.detected',
  'process-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'process-signals',
  'system',
  'rejected',
  'Signal rejected for {TARGET_SYMBOL}: {REJECTION_REASON}',
  jsonb_build_object(
    'signalId', '{SIGNAL_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'direction', '{DIRECTION}',
    'shouldCreatePredictor', false,
    'rejectionReason', '{REJECTION_REASON}',
    'explanation', '{EXPLANATION}'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 5: Emit Batch Completion Event

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
  'signal.processing.completed',
  'process-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'process-signals',
  'system',
  'completed',
  'Processed {N} signals: {M} approved, {R} rejected',
  100,
  jsonb_build_object(
    'signalsProcessed', {N},
    'predictorsCreated', {M},
    'signalsRejected', {R},
    'approvalRate', ROUND({M}::numeric / NULLIF({N}, 0) * 100, 1)
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 6: Log Completion to Artifact Events

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'process-signals', '1.0.0', 'completed', true,
  '{\"signals_processed\": N, \"predictors_created\": M, \"rejected\": R}'::jsonb);"
```

### Step 7: Output Summary

Show:
- Signals processed
- Predictors created (with breakdown by direction)
- Signals rejected (with common reasons)
- Active predictor count by target

## Strength Scale (1-10)

Strength = ROUND(confidence * 10)

| Strength | Confidence | Interpretation |
|----------|------------|----------------|
| 9-10 | 0.90+ | Very high conviction signal |
| 7-8 | 0.70-0.89 | Strong signal, good confidence |
| 5-6 | 0.50-0.69 | Moderate signal |
| 3-4 | 0.30-0.49 | Weak signal (usually reject) |
| 1-2 | < 0.30 | Very weak (always reject) |

## Rejection Reasons

Common reasons to reject a signal:
- **low_quality**: Content is vague or unreliable
- **stale_news**: Information is too old
- **no_clear_direction**: Can't determine bullish/bearish
- **low_relevance**: Not materially related to target
- **duplicate**: Similar signal already exists

## Observability Events Emitted

| Event Type | When | Status | Payload |
|------------|------|--------|---------|
| `signal.detected` | Each signal evaluated | approved/rejected | signalId, targetSymbol, direction, confidence, reasoning |
| `predictor.created` | Each predictor created | created | predictorId, signalId, targetSymbol, strength, expiresAt |
| `signal.processing.completed` | End of batch | completed | signalsProcessed, predictorsCreated, approvalRate |

## Notes

- Predictors expire after 24 hours by default
- One signal = one predictor (1:1 relationship)
- Predictors are consumed when used in predictions
- Use `analyst_slug='claude-signal-processor'` for tracking
- Each signal/predictor emits observability events for the activity feed
