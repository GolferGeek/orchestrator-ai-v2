---
description: "Run complete prediction pipeline (3x daily via cron)"
category: "prediction"
uses-skills: []
uses-agents: []
related-commands: ["generate-signals", "process-signals", "generate-predictions", "track-outcomes"]
---

# Run Prediction Pipeline

Execute the complete prediction pipeline in order. Designed to run 3x daily via external cron.

**Usage:** `/run-prediction-pipeline`

## Pipeline Steps (IN ORDER)

1. **Generate Signals** - Analyze crawler articles → create signals
2. **Process Signals** - Evaluate signals → create predictors
3. **Generate Predictions** - Aggregate predictors → create predictions
4. **Track Outcomes** - Resolve expired predictions → record results

## EXECUTE THIS PROCESS

### Step 1: Log Pipeline Start

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'run-prediction-pipeline', '1.0.0', 'started',
  '{\"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Emit pipeline.started observability event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.started',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'started',
  'Prediction pipeline started',
  0,
  'initialize',
  0,
  4,
  jsonb_build_object(
    'pipelineType', 'prediction',
    'steps', jsonb_build_array('generate-signals', 'process-signals', 'generate-predictions', 'track-outcomes')
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 2: Run /generate-signals

Execute the generate-signals command:
- Load active targets
- Get unprocessed articles from last 24 hours
- Analyze each article for trading signals
- Insert signals into database

**Emit step progress event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.step',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'running',
  'Step 1: Generating signals from articles',
  25,
  'generate-signals',
  1,
  4,
  jsonb_build_object('step', 'generate-signals'),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Expected output:** N articles processed, M signals created

### Step 3: Run /process-signals

Execute the process-signals command:
- Get pending signals
- Evaluate each for quality and trading potential
- Create predictors for approved signals
- Mark rejected signals

**Emit step progress event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.step',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'running',
  'Step 2: Processing signals to create predictors',
  50,
  'process-signals',
  2,
  4,
  jsonb_build_object('step', 'process-signals'),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Expected output:** N signals processed, M predictors created, R rejected

### Step 4: Run /generate-predictions

Execute the generate-predictions command:
- Find targets with >= 2 active predictors (100% consensus) or >= 3 (60%+ consensus)
- Analyze predictor consensus
- Generate predictions with confidence scores
- Consume used predictors

**Emit step progress event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.step',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'running',
  'Step 3: Generating predictions from predictors',
  75,
  'generate-predictions',
  3,
  4,
  jsonb_build_object('step', 'generate-predictions'),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Expected output:** N targets evaluated, M predictions created

### Step 5: Run /track-outcomes

Execute the track-outcomes command:
- Find expired predictions
- Calculate actual returns
- Determine win/loss outcomes
- Update prediction status

**Emit step progress event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.step',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'running',
  'Step 4: Tracking outcomes for expired predictions',
  90,
  'track-outcomes',
  4,
  4,
  jsonb_build_object('step', 'track-outcomes'),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

**Expected output:** N predictions resolved, W wins, L losses

### Step 6: Log Pipeline Completion

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'run-prediction-pipeline', '1.0.0', 'completed', true,
  '{\"steps_completed\": 4, \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'::jsonb);"
```

**Emit pipeline.completed observability event:**
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
  step,
  sequence,
  total_steps,
  payload,
  timestamp
)
VALUES (
  'claude-command',
  'pipeline.completed',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'completed',
  'Prediction pipeline completed: {SIGNALS} signals, {PREDICTORS} predictors, {PREDICTIONS} predictions',
  100,
  'complete',
  4,
  4,
  jsonb_build_object(
    'signalsCreated', {SIGNALS_CREATED},
    'predictorsCreated', {PREDICTORS_CREATED},
    'predictionsCreated', {PREDICTIONS_CREATED},
    'predictionsResolved', {PREDICTIONS_RESOLVED},
    'winRate', {WIN_RATE},
    'durationMs', {DURATION_MS}
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 7: Final Summary

Output a summary of the entire pipeline run:

```
========================================
PREDICTION PIPELINE COMPLETE
========================================
Timestamp: [UTC time]

Step 1 - Generate Signals:
  - Articles processed: N
  - Signals created: M

Step 2 - Process Signals:
  - Signals evaluated: N
  - Predictors created: M
  - Rejected: R

Step 3 - Generate Predictions:
  - Targets evaluated: N
  - Predictions created: M

Step 4 - Track Outcomes:
  - Predictions resolved: N
  - Win rate: X%

========================================
```

## Cron Schedule (3x daily)

Recommended schedule:
- 6:00 AM - Morning run (captures overnight news)
- 2:00 PM - Afternoon run (captures market-hours news)
- 10:00 PM - Evening run (captures after-market news)

```cron
0 6 * * * /path/to/run-prediction-pipeline.sh
0 14 * * * /path/to/run-prediction-pipeline.sh
0 22 * * * /path/to/run-prediction-pipeline.sh
```

## Observability Events Emitted

| Event Type | When | Payload |
|------------|------|---------|
| `pipeline.started` | Pipeline begins | pipelineType, steps array |
| `pipeline.step` | Each step starts | step name, progress %, sequence |
| `signal.created` | Each signal (from generate-signals) | signalId, targetSymbol, direction |
| `signal.detected` | Each signal processed | approved/rejected, confidence |
| `predictor.created` | Each predictor created | predictorId, strength |
| `predictor.ready` | Threshold met | targetSymbol, activeCount, consensus |
| `prediction.created` | Each prediction | predictionId, direction, confidence |
| `prediction.resolved` | Each outcome tracked | outcome, actualReturn |
| `pipeline.completed` | Pipeline ends | totals for all steps, duration |

## Error Handling

If any step fails:
1. Log the error
2. Continue to next step (graceful degradation)
3. Report partial results in summary
4. Mark pipeline as completed with warnings

```bash
# On error, emit error event
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
  'pipeline.error',
  'prediction-pipeline-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'run-prediction-pipeline',
  'system',
  'error',
  'Pipeline step failed: {STEP_NAME}',
  jsonb_build_object('step', '{STEP_NAME}', 'error', '{ERROR_MESSAGE}'),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

## Notes

- Each step runs sequentially (order matters)
- Pipeline uses Claude Code subscription (not API calls)
- All activity logged to both artifact_events and observability_events
- Individual events appear in the prediction activity feed
- Can run individual steps manually for debugging
- If crawler is running separately, Step 1 may find no new articles (normal)
