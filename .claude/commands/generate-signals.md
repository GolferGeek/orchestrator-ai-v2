---
description: "Generate trading signals from crawler articles using Claude analysis"
category: "prediction"
uses-skills: []
uses-agents: []
related-commands: ["run-prediction-pipeline", "process-signals"]
---

# Generate Signals

Analyze unprocessed articles from the crawler and create trading signals for active targets.

**Usage:** `/generate-signals`

## What This Does

1. Loads all active targets with their context/metadata
2. Gets unprocessed articles from the last 24 hours
3. For each article, Claude analyzes which targets it's relevant to
4. Creates signals with direction (bullish/bearish/neutral) and strength
5. Emits observability events for activity feed
6. Logs completion to observability table

## EXECUTE THIS PROCESS

### Step 1: Log Invocation

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'generate-signals', '1.0.0', 'invoked',
  '{\"triggered_by\": \"user\", \"step\": \"1-signals\"}'::jsonb);"
```

### Step 2: Get Active Targets

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -t -A -c "
SELECT json_agg(json_build_object(
  'id', t.id,
  'symbol', t.symbol,
  'name', t.name,
  'context', t.context,
  'metadata', t.metadata,
  'universe_name', u.name,
  'domain', u.domain
))
FROM prediction.targets t
JOIN prediction.universes u ON u.id = t.universe_id
WHERE t.is_active = true
AND (t.is_test_data = false OR t.is_test_data IS NULL);"
```

### Step 3: Get Unprocessed Articles (last 24 hours)

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT a.id, a.title, s.name as source_name, LEFT(a.content, 1500) as content,
       a.first_seen_at, a.url
FROM crawler.articles a
JOIN crawler.sources s ON s.id = a.source_id
WHERE a.first_seen_at >= NOW() - INTERVAL '24 hours'
AND a.is_duplicate = false
AND NOT EXISTS (
  SELECT 1 FROM prediction.signals sig
  WHERE sig.metadata->>'crawler_article_id' = a.id::text
)
ORDER BY a.first_seen_at DESC
LIMIT 30;"
```

### Step 4: Analyze Each Article

For each article, determine:
1. **Which targets it's relevant to** - based on content, context, and sector
2. **Signal direction**: bullish (positive), bearish (negative), or neutral
3. **Strength**: 0.0 to 1.0 (how strong is the signal)
4. **Key reasoning**: Brief explanation of why

**Guidelines for analysis:**
- Look for company mentions (direct or indirect)
- Consider sector/industry implications
- Identify sentiment indicators (growth, decline, risk, opportunity)
- Consider macro factors affecting multiple targets

**Return structured signals:**
```json
{
  "signals": [
    {
      "article_id": "uuid-here",
      "target_id": "target-uuid",
      "target_symbol": "AAPL",
      "direction": "bearish",
      "strength": 0.75,
      "reasoning": "Supply chain concerns from China tariffs affecting iPhone production"
    }
  ]
}
```

### Step 5: Insert Signals AND Emit Observability Events

For each signal identified, insert into database AND emit observability event:

**Insert Signal:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO prediction.signals (
  target_id,
  source_id,
  content,
  direction,
  url,
  detected_at,
  disposition,
  metadata,
  created_at,
  updated_at
)
SELECT
  '{TARGET_ID}'::uuid,
  (SELECT id FROM crawler.sources WHERE name = '{SOURCE_NAME}' LIMIT 1),
  '{ARTICLE_TITLE}: {REASONING}',
  '{DIRECTION}',
  '{ARTICLE_URL}',
  '{ARTICLE_FIRST_SEEN}',
  'pending',
  jsonb_build_object(
    'crawler_article_id', '{ARTICLE_ID}',
    'headline', '{ARTICLE_TITLE}',
    'strength', {STRENGTH},
    'claude_analysis', true
  ),
  NOW(),
  NOW()
ON CONFLICT DO NOTHING
RETURNING id, target_id, direction;"
```

**Emit signal.created observability event (for each signal):**
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
  'signal.created',
  'generate-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'generate-signals',
  'system',
  'created',
  'Signal created for {TARGET_SYMBOL}: {DIRECTION}',
  jsonb_build_object(
    'signalId', '{SIGNAL_ID}',
    'targetId', '{TARGET_ID}',
    'targetSymbol', '{TARGET_SYMBOL}',
    'direction', '{DIRECTION}',
    'strength', {STRENGTH},
    'headline', '{ARTICLE_TITLE}',
    'source', '{SOURCE_NAME}',
    'articleId', '{ARTICLE_ID}'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 6: Emit Batch Completion Event

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
  'signal.generation.completed',
  'generate-signals-' || EXTRACT(EPOCH FROM NOW())::bigint,
  'generate-signals',
  'system',
  'completed',
  'Generated {N} signals from {M} articles',
  100,
  jsonb_build_object(
    'articlesProcessed', {M},
    'signalsCreated', {N},
    'targetBreakdown', '{JSON_BREAKDOWN}'
  ),
  EXTRACT(EPOCH FROM NOW()) * 1000
);"
```

### Step 7: Log Completion to Artifact Events

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'generate-signals', '1.0.0', 'completed', true,
  '{\"articles_processed\": N, \"signals_created\": M}'::jsonb);"
```

### Step 8: Output Summary

Show:
- Number of articles analyzed
- Number of signals created
- Breakdown by target/direction
- Sample of signals created

## Signal Direction Guide

| Direction | Indicators | Example |
|-----------|------------|---------|
| **bullish** | Revenue growth, new products, partnerships, beating estimates | "Apple reports record iPhone sales" |
| **bearish** | Layoffs, lawsuits, missing targets, supply issues | "Tesla faces production delays" |
| **neutral** | Mixed news, routine updates, no clear impact | "Google announces office changes" |

## Strength Guide

| Strength | Description |
|----------|-------------|
| 0.9+ | Direct company mention with clear impact |
| 0.7-0.9 | Strong indirect signal (sector, competitor) |
| 0.5-0.7 | Moderate signal, some uncertainty |
| < 0.5 | Weak signal, tangential relevance |

## Observability Events Emitted

| Event Type | When | Payload |
|------------|------|---------|
| `signal.created` | Each signal inserted | signalId, targetSymbol, direction, strength, headline |
| `signal.generation.completed` | End of batch | articlesProcessed, signalsCreated, targetBreakdown |

## Notes

- Only process articles from last 24 hours to avoid duplicates
- Skip articles already processed (check metadata.crawler_article_id)
- One article can generate signals for multiple targets
- Signals start with `disposition='pending'` for `/process-signals` to evaluate
- Each signal emits an observability event for the activity feed
