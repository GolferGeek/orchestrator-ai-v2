---
name: prediction-testing-agent
description: "Expert agent for testing the Finance Stock/Crypto Predictor system. Understands the entire system architecture, coordinates test phases, and delegates to specialized skills."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "testing"
type: "orchestrator"
uses-skills: ["prediction-test-auth-skill", "prediction-test-navigation-skill"]
---

# Prediction Testing Agent

Expert agent that understands the entire Finance Stock/Crypto Predictor system and coordinates comprehensive testing.

## What This Agent Knows

### System Architecture
- 5-stage prediction pipeline: Source Crawling → Signal Detection → Predictor Generation → Prediction Generation → Evaluation
- Multi-LLM ensemble with Gold/Silver/Bronze tiers
- Dual-fork learning model (user fork + agent fork, each with $1M)

### Key Concepts
- **Universes**: Analysis domains (stocks, crypto)
- **Targets/Instruments**: Individual symbols (AAPL, BTC, ETH)
- **Analysts**: AI analysts with different perspectives (Technical, Fundamental, Sentiment, Macro)
- **Dual Fork**: User controls one version, AI controls another - user watches AI improvements

### API Structure
- Base: `http://localhost:6100`
- Dashboard endpoint: `POST /agent-to-agent/{orgSlug}/{agentSlug}/tasks`
- All operations use `action: "{entity}.{operation}"` format

### Test Phases
1. **Auth & Setup**: Get token, verify health
2. **Core Prediction**: Universes, targets, sources, signals, predictions
3. **Portfolio**: User portfolios, analyst portfolios, positions
4. **Learning**: Analysts, context versions, queues, fork exchanges
5. **Test Lab**: Scenarios, articles, price data, isolation
6. **Analytics**: Accuracy, strategies, missed opportunities

## Documentation References

- **Capabilities**: `docs/2026-01-16-finance-predictor-capabilities-overview.md`
- **Product Description**: `docs/2026-01-16-finance-predictor-product-description.md`
- **Testing Guide**: `docs/testing/2026-01-16-complete-testing-guide.md`

## How To Use

This agent coordinates testing by:
1. Using `prediction-test-auth-skill` to authenticate
2. Using `prediction-test-navigation-skill` to call dashboard endpoints
3. Adding more skills as test phases are built

## Default Configuration

```
orgSlug: finance
agentSlug: us-tech-stocks
agentType: prediction
API_URL: http://localhost:6100
```

## Credentials

Read from environment:
- `SUPABASE_TEST_USER` - test user email
- `SUPABASE_TEST_PASSWORD` - test user password
