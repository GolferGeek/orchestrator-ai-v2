---
name: prediction-test-ui-skill
description: "Test prediction system UI screens using Claude Code Chrome extension. Navigates screens, verifies data, documents structure."
allowed-tools: Bash, Read, Write
category: "testing"
type: "ui-testing"
---

# Prediction Test UI Skill

Test prediction system front-end screens using Claude Code Chrome extension.

## Base URL

```
http://localhost:6101
```

## Testing Flow

1. **Get expected data from API** (using test-helper.sh)
2. **Navigate to screen** in browser
3. **Verify displayed data** matches expected
4. **Document findings** and update skill

## Navigation Pattern

### Accessing Prediction Agents
1. Click hamburger menu (☰) in top-left
2. Expand "Agents & Conversations" section
3. Prediction agents show with line chart icon (📈) and grid icon (⊞)
4. Click grid icon to open dashboard view
5. Agent types: "Investment Risk Agent", "US Tech Stocks Predictor"

### URL Patterns
- Dashboard: `/app/prediction/dashboard?agentSlug=us-tech-stocks`
- Prediction Detail: `/app/prediction/{uuid}`
- Test Lab: `/app/prediction/test-lab`
- Analysts: `/app/prediction/analysts`
- Learning Queue: `/app/prediction/learning-queue`
- Learnings: `/app/prediction/learnings`
- Missed Opportunities: `/app/prediction/missed-opportunities`
- Portfolios: `/app/prediction/portfolios`
- Portfolio Detail: `/app/prediction/portfolio/{uuid}`
- Risk Dashboard: `/app/home?forceHome=true&agentSlug=investment-risk-agent`

## Screens to Test

### 1. Prediction Dashboard
- **URL**: `/app/prediction/dashboard?agentSlug=us-tech-stocks`
- **Structure**:
  - **Header**: "Prediction Dashboard" + Manage Portfolios | Watch Activity | Refresh buttons
  - **Filters**: PORTFOLIO | STATUS | DOMAIN | OUTCOME dropdowns
  - **Stats Row**: Active Predictions | Resolved | Portfolios | LLM Agreement (Full/Partial/None)
  - **Training & Learning Cards**: Learnings, Analysts, Missed Opportunities, Learning Queue, Test Lab
  - **Prediction Cards**: Show symbol, direction (UP/DOWN/FLAT), confidence %, magnitude, timeframe, dates
- **Verified 2026-01-16**: 2 active predictions (AAPL, T_NVDA), 2 portfolios

### 2. Instruments/Targets List
- **URL**: `/prediction/targets`
- **Expected**: 13 targets (7 prod + 6 test with T_ prefix)
- **Verify**: List displays, can filter by universe

### 3. Analyst Management
- **URL**: `/app/prediction/analysts`
- **Structure**:
  - **Header**: "← Back to Dashboard" + "+ New Analyst" button
  - **Filters**:
    - SCOPE LEVEL: All | Runner | Domain | Universe | Target
    - DOMAIN: All | Stocks | Crypto | Elections | Polymarket
    - STATUS: All | Active | Inactive
  - **Analyst Cards**: Name, slug, perspective, weight, status, created date, edit/delete icons
  - **Analyst Detail Panel** (side panel on click):
    - **Tabs**: Fork Performance | Context History | Learning Session
    - Fork Performance: Portfolio data comparison
    - Context History: Version history of analyst context
    - Learning Session: "Start Learning Session" button to compare fork performance and exchange learnings
- **Verified 2026-01-16**: 1 analyst (Base Analyst), Inactive status, weight 1.00

### 4. Review Queue (HITL)
- **URL**: `/prediction/review`
- **Expected**: 4 items awaiting review
- **Verify**: Queue displays, can approve/reject

### 5. Learning Queue
- **URL**: `/app/prediction/learning-queue`
- **Structure**:
  - **Tabs**: Learning Queue | Agent Activity
  - **Status Filters**: All | Pending | Approved | Rejected | Modified
  - **Filters**: PORTFOLIO dropdown | TARGET dropdown
  - **Empty State**: "No Queue Items" + message about AI suggesting learnings
  - **Agent Activity Tab**: Shows "No Agent Activity" - tracks analyst self-modifications
- **Verified 2026-01-16**: Queue empty, Agent Activity empty

### 5b. Learnings Management
- **URL**: `/app/prediction/learnings`
- **Structure**:
  - **Header**: "Learnings Management" + "+ New Learning" button
  - **Filters**: Scope Level | Learning Type | Source Type | Status (all dropdowns)
  - **Empty State**: "No Learnings Found" + "Create Learning" button
- **Verified 2026-01-16**: No learnings configured

### 5c. Missed Opportunities
- **URL**: `/app/prediction/missed-opportunities`
- **Structure**:
  - **Header**: "Missed Opportunities" + subtitle "System-detected opportunities for learning"
  - **Stats Row**: TOTAL | AVG MOVE | UP MOVES | DOWN MOVES | PENDING | ANALYZED | ACTIONED
  - **Status Tabs**: All | Pending | Analyzed | Actioned
  - **Filters**: Direction dropdown | Min Move % input
  - **Empty State**: "No Missed Opportunities Found"
- **Verified 2026-01-16**: No missed opportunities detected

### 5d. Portfolio Management
- **URL**: `/app/prediction/portfolios`
- **Structure**:
  - **Header**: "Portfolio Management" + "+ New Portfolio" button
  - **Domain Tabs**: All | Stocks | Crypto | Elections | Polymarket
  - **Portfolio Cards**: Name, domain badge, description, targets count, predictions count, strategy, created date, edit/delete icons
- **Verified 2026-01-16**: 2 portfolios (US Tech Stocks 2025, Crypto Majors 2025)

### 5e. Portfolio Detail View
- **URL**: `/app/prediction/portfolio/{portfolio-uuid}`
- **Access**: Click on portfolio card from Portfolio Management
- **Structure**:
  - **Header**: Portfolio name + domain badge + "Settings" button
  - **Tabs**: Overview | Instruments (count) | Sources (count) | Predictions (count)
  - **Info Cards**:
    - Portfolio Information: Domain, Agent, Organization, Strategy, Status, Created
    - LLM Ensemble Configuration: Default or custom config
    - Prediction Thresholds: Min Predictors, Min Combined Strength, Min Direction Consensus, Predictor TTL
    - Notification Settings: Urgent Alerts, New Predictions, Outcome Updates toggles
  - **Stats Row**: Instruments | Active | Predictions | Active Predictions
  - **Pipeline Actions**: Crawl Sources | Process Signals | Generate Predictions | Run Full Pipeline
- **Verified 2026-01-16**: US Tech Stocks 2025 shows 13 instruments, 10 predictions, 2 active

### 5f. Watch Activity (Activity Feed)
- **Access**: Click "Watch Activity" button on dashboard (toggles panel)
- **Structure**:
  - **Header**: "Prediction Activity Feed" + "Live" indicator + event count
  - **Controls**: Toggle | Clear (trash) | Close (X)
  - **Filter Tabs**: All | Crawl Start | Crawl Done | Article | Signal | Predictor | Prediction | Evaluated
  - **Activity Log**: Timestamped entries with event type badges (ARTICLE, CRAWL STARTED, CRAWL DONE, etc.)
  - **Event Types**:
    - ARTICLE: New articles with sentiment (bullish/bearish/neutral)
    - CRAWL STARTED/DONE: Source crawl job status (5-min, 10-min, 15-min cycles)
    - SIGNAL: New signals detected
    - PREDICTOR/PREDICTION: Prediction pipeline stages
- **Verified 2026-01-16**: Live feed showing 200 events with real-time crawl activity

### 6. Test Lab
- **URL**: `/app/prediction/test-lab`
- **Structure**:
  - **Header**: "← Back to Dashboard" + Import JSON | + New Scenario buttons
  - **Stats Row**: Total Scenarios | Active | Running | Completed | Test Records
  - **Quick Start Templates**: Bullish Signal Flood (20), Bearish Signal Test (20), Mixed Signal Chaos (30), Accuracy Evaluation (15)
  - **Filter Tabs**: All | Active | Running | Completed | Failed | Archived
  - **Scenario Cards**: Name, description, injection points count, records count
  - **Scenario Actions**: View | Generate | Export | Cleanup | Delete
  - **Live Monitor**: Collapsible section
  - **Historical Replay Tests**: Section for validating learnings with historical data
- **Verified 2026-01-16**: 5 scenarios, 203 test records

### 7. Analytics
- **URL**: `/prediction/analytics`
- **Expected**: Accuracy metrics, learning velocity
- **Verify**: Charts/data display

### 8. Investment Risk Dashboard
- **URL**: `/app/home?forceHome=true&agentSlug=investment-risk-agent`
- **Structure**:
  - **Header**: "Investment Risk Dashboard" + Analyze All | Refresh buttons
  - **Stats Row**: Total Subjects | Analyzed | Avg Risk Score %
  - **Tabs**: Overview | Alerts | Dimensions | Learnings | Settings
  - **Subjects Sidebar**: Search + list of subjects
  - **Settings Tab**: Select Scope dropdown
- **Verified 2026-01-16**: 0 subjects configured (needs scope selection)

### 9. Prediction Detail View
- **URL**: `/app/prediction/{prediction-uuid}`
- **Access**: Click on any prediction card from dashboard
- **Structure**:
  - **Header**: "← Back to Dashboard" + Symbol + Company Name
  - **Status Badges**: ACTIVE/RESOLVED + Limited Data (if applicable)
  - **Prediction Summary Box**: Direction icon + confidence %, Magnitude, Timeframe, Generated/Expires dates
  - **Actions Row**: Create Learning | Missed Opportunities | View Analysts
  - **Prediction Lineage Section** (hierarchical tree):
    - **Level 1 - Prediction**: Direction + confidence, magnitude, timeframe, reasoning (ensemble stats)
    - **Stats**: X predictors, Y signals, Z analysts
    - **Level 2 - Predictor**: Analyst name, reasoning (ensemble breakdown), confidence %
    - **Level 3 - Signal**: Content preview, Detected timestamp, Source URL, sentiment (NEUTRAL/BULLISH/BEARISH), type (ROUTINE)
    - **Level 4 - Fingerprint**: Extracted article title
    - **Level 5 - Source Article**: First Seen date, "Open" button to view original
- **Verified 2026-01-16**: AAPL prediction shows 41 predictors, 41 signals, 0 analysts

### 10. Test Scenario Detail (Expanded View)
- **Access**: Click "View" button on any scenario card in Test Lab
- **Structure**:
  - Scenario card gets highlighted border
  - **Run Pipeline Tiers** section appears below:
    - Description: "Execute prediction pipeline tiers against test data in '[Scenario Name]'"
    - **Pipeline Buttons**: Signal Detection | Prediction Generation | Evaluation
- **Verified 2026-01-16**: Bull Market Tech Rally scenario expanded correctly

### 11. Test Lab - Create Scenario Modal
- **Access**: Click "+ New Scenario" button in Test Lab
- **Structure**:
  - **Header**: "Create Test Scenario"
  - **Form Fields**:
    - Scenario Name (text input)
    - Description (textarea)
    - Injection Points (multi-select checkboxes): Signals | Predictors | Predictions | Evaluations | Analysts | Learnings | Learning Queue | Sources
  - **Buttons**: Cancel | Create Scenario
- **Verified 2026-01-16**: Created "Regression Test Scenario" successfully

### 12. Test Lab - Generate Test Data Modal
- **Access**: Click "Generate" button on any scenario card
- **Structure**:
  - **Header**: "Generate Test Data"
  - **Subtitle**: "Generating for: [Scenario Name]"
  - **Data Type** (radio buttons): Signals | Predictions | Articles
  - **Count** (number input): Default 10
  - **Sentiment Distribution** (3 number inputs):
    - Bullish: 0.4
    - Bearish: 0.4
    - Neutral: 0.2
  - **Buttons**: Cancel | Generate
- **Verified 2026-01-16**: Modal displays correctly

### 13. Test Lab - Pipeline Execution Results
- **Location**: Appears in "Run Pipeline Tiers" section after clicking a pipeline button
- **Format**: Colored banner showing result
  - **Success**: Green banner - "[tier-name]: Success - processed, created"
  - **Running**: Scenario status changes to "RUNNING"
  - **Completed**: Scenario status changes to "COMPLETED" (green badge)
- **Stats Impact**: Running pipeline updates header stats (Active/Running/Completed counts)
- **Verified 2026-01-16**: Signal Detection ran successfully, scenario changed from ACTIVE to COMPLETED

## Test Results Template

```markdown
## Screen: [Name]
**URL**: [url]
**Tested**: [date]
**Status**: PASS/FAIL

### Expected
- [what API says should be there]

### Actual
- [what browser shows]

### Issues
- [any discrepancies]

### Screen Structure Notes
- [document key UI elements for future reference]
```

## Browser Navigation Commands

Using Claude Code Chrome extension:
- Navigate to URL
- Wait for page load
- Identify key elements
- Verify data matches expected

## Integration with API Tests

Before testing UI, run API test to get expected data:
```bash
# Get expected counts
/Users/golfergeek/projects/orchAI/orchestrator-ai-v2/.claude/skills/prediction-testing/test-helper.sh "targets.list" '{"universeId": "39056ed4-50cb-4778-9add-b6bc5243c866"}' | jq '.payload.metadata.totalCount'
```

Then verify UI shows same count.
