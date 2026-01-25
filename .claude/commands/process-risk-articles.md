---
description: "Process crawler articles and map them to subject/dimension pairs for risk analysis"
category: "risk"
uses-skills: []
uses-agents: []
related-commands: []
---

# Process Risk Articles

Process new articles from the crawler and determine which (subject, dimension) pairs each article is relevant to. Then trigger reanalysis for any subject/dimensions that received new articles.

**Usage:** `/process-risk-articles`

## What This Does

1. **Load the matrix**: Get all active subjects (with dimension context) and dimensions
2. **Get unprocessed articles**: Find articles not yet mapped to subject/dimensions
3. **For each article**: Use Claude to determine which (subject, dimension) pairs it's relevant to
4. **Store mappings**: Insert into `risk.subject_dimension_articles` table
5. **Trigger reanalysis**: For any subject/dimension with new articles since last analysis

## EXECUTE THIS PROCESS

### Step 1: Load Subjects with Context

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -t -A -c "
SELECT json_agg(json_build_object(
  'id', id,
  'identifier', identifier,
  'name', name,
  'subject_type', subject_type,
  'dimension_context', metadata->'dimension_context'
))
FROM risk.subjects WHERE is_active = true;"
```

### Step 2: Load Dimensions

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -t -A -c "
SELECT json_agg(json_build_object(
  'id', id,
  'slug', slug,
  'name', name,
  'description', LEFT(description, 200)
))
FROM risk.dimensions WHERE is_active = true ORDER BY display_order;"
```

### Step 3: Get Unprocessed Articles

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT a.id, a.title, LEFT(a.content, 500) as content
FROM crawler.articles a
WHERE NOT EXISTS (
  SELECT 1 FROM risk.subject_dimension_articles sda WHERE sda.article_id = a.id
)
AND a.first_seen_at >= NOW() - INTERVAL '7 days'
ORDER BY a.first_seen_at DESC
LIMIT 20;"
```

### Step 4: For Each Article - Analyze with Claude

For each unprocessed article, analyze which (subject, dimension) pairs it is relevant to.

**IMPORTANT**: Use the `dimension_context` from each subject's metadata to understand indirect relevance.

Example: An article about "Trump tariffs on China" is relevant to:
- AAPL/geopolitical (Apple manufactures >90% of iPhones in China)
- TSLA/geopolitical (Tesla has Shanghai Gigafactory)
- BTC/regulatory (Trump admin policy affects crypto)

**Claude should return JSON like:**
```json
{
  "mappings": [
    {
      "subject_identifier": "AAPL",
      "dimension_slug": "geopolitical",
      "relevance_score": 0.95,
      "reasoning": "China tariffs directly impact Apple's manufacturing costs"
    },
    {
      "subject_identifier": "TSLA",
      "dimension_slug": "geopolitical",
      "relevance_score": 0.85,
      "reasoning": "Tesla Shanghai factory exposed to US-China tensions"
    }
  ]
}
```

### Step 5: Insert Mappings

For each mapping, insert into database:

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO risk.subject_dimension_articles (subject_id, dimension_id, article_id, relevance_score, reasoning)
SELECT s.id, d.id, '{ARTICLE_ID}'::uuid, {SCORE}, '{REASONING}'
FROM risk.subjects s, risk.dimensions d
WHERE s.identifier = '{SUBJECT}' AND d.slug = '{DIMENSION}'
ON CONFLICT DO NOTHING;"
```

### Step 6: Find Subject/Dimensions Needing Reanalysis

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT s.identifier, d.slug, COUNT(*) as new_articles
FROM risk.subject_dimension_articles sda
JOIN risk.subjects s ON s.id = sda.subject_id
JOIN risk.dimensions d ON d.id = sda.dimension_id
LEFT JOIN risk.assessments a ON a.subject_id = sda.subject_id AND a.dimension_id = sda.dimension_id
WHERE sda.created_at > COALESCE(a.created_at, '1970-01-01')
GROUP BY s.identifier, d.slug
ORDER BY new_articles DESC;"
```

### Step 7: Output Summary

Show:
- Number of articles processed
- Number of mappings created
- Subject/dimensions needing reanalysis
- Sample of mappings created

## Active Subjects

Current subjects with dimension context:
- **AAPL** (Apple): China manufacturing, EU regulatory, Services growth
- **TSLA** (Tesla): China factory, EV competition, Musk governance
- **GOOGL** (Google): DOJ antitrust, AI competition, Cloud growth
- **MSFT** (Microsoft): Azure AI, OpenAI partnership, Enterprise moat
- **BTC** (Bitcoin): ETF flows, Halving cycles, Regulatory clarity

## Dimension Keywords to Consider

| Dimension | Key Signals |
|-----------|-------------|
| geopolitical | tariff, China, trade war, sanctions, supply chain, Trump |
| regulatory | fine, lawsuit, SEC, DOJ, antitrust, compliance, DMA, EU |
| financial-health | revenue, earnings, margin, cash flow, profit, quarterly |
| growth-sustainability | growth, adoption, market share, new product, innovation |
| valuation | P/E, multiple, overvalued, premium, bubble, expensive |
| sentiment | analyst, upgrade, downgrade, bullish, bearish, Wall Street |
| correlation | sector, Mag 7, FAANG, moves together, tech stocks |
| market-volatility | volatility, swing, uncertainty, turbulent |
| credit | bond, debt, credit rating, default, AA+, issuance |
| liquidity | volume, trading, liquid, bid-ask, daily volume |

## Notes

- Use subject's `dimension_context` to understand indirect relevance
- An article about "China" affects AAPL, TSLA even without naming them
- An article about "Mag 7" affects all tech stocks
- Relevance scores: 0.9+ = direct mention, 0.7-0.9 = indirect but clear, 0.5-0.7 = tangential

## Database Schema

```sql
CREATE TABLE risk.subject_dimension_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES risk.subjects(id),
  dimension_id UUID NOT NULL REFERENCES risk.dimensions(id),
  article_id UUID NOT NULL REFERENCES crawler.articles(id),
  relevance_score FLOAT NOT NULL DEFAULT 0.5,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, dimension_id, article_id)
);
```
