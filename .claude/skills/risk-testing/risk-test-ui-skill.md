---
name: risk-test-ui-skill
description: "Test risk analysis system UI screens using Claude Code Chrome extension. Navigates screens, verifies data, documents structure progressively."
allowed-tools: Bash, Read, Write
category: "testing"
type: "ui-testing"
---

# Risk Test UI Skill

Test risk analysis system front-end screens using Claude Code Chrome extension, organized progressively from basic to advanced.

## Base URLs

```
WEB_URL: http://localhost:6101
API_URL: http://localhost:6100
```

## Testing Flow

1. **Get expected data from API** (using test-helper.sh)
2. **Navigate to screen** in browser
3. **Verify displayed data** matches expected
4. **Document findings** and update skill

---

## Navigation Pattern

### Accessing Risk Dashboard

1. Click hamburger menu in top-left
2. Expand "Agents & Conversations" section
3. Find "Investment Risk Agent" with shield icon
4. Click grid icon to open dashboard view

### Direct URL
```
/app/home?forceHome=true&agentSlug=investment-risk-agent
```

---

## Progressive UI Test Phases

### Phase 1: Basic Navigation

#### 1.1 Dashboard Loads
- **URL**: `/app/home?forceHome=true&agentSlug=investment-risk-agent`
- **Verify**: Page loads with title "Investment Risk Dashboard"
- **Elements**: Header, tabs, sidebar visible

#### 1.2 Tab Navigation
- **Tabs**: Overview | Alerts | Dimensions | Learnings | Settings
- **Test**: Click each tab, verify content switches
- **Verify**: Active tab highlighted

#### 1.3 Header Controls
- **Elements**: Scope name, "Analyze All" button, "Refresh" button
- **Test**: Buttons enabled when scope selected, disabled otherwise

---

### Phase 2: Settings & Configuration

#### 2.1 Settings Tab
- **Location**: Click "Settings" tab
- **Elements**:
  - Scope selector dropdown
  - Scope configuration (name, domain, description)
  - Threshold configuration (read-only)
  - Analysis configuration (read-only)
  - LLM configuration (read-only)

#### 2.2 Scope Selection
- **Test**: Click scope dropdown
- **Verify**: All scopes listed as "Name (domain)"
- **Test**: Select different scope
- **Verify**: All data refreshes for new scope

#### 2.3 Scope Configuration
- **Test**: Edit scope name field
- **Verify**: Changes saved (check via API)
- **Test**: Edit description textarea
- **Verify**: Changes saved

---

### Phase 3: Subject Management

#### 3.1 Sidebar - Subject List
- **Location**: Left panel on Overview tab
- **Elements**:
  - Header with "Subjects" title and count badge
  - Search input
  - Subject cards with identifier, name, score badge, type badge

#### 3.2 Subject Search
- **Test**: Type in search box
- **Verify**: Subjects filter in real-time
- **Test**: Clear search
- **Verify**: All subjects return

#### 3.3 Subject Selection
- **Test**: Click subject in sidebar
- **Verify**: Subject highlighted with blue border
- **Verify**: Detail view loads with subject data

#### 3.4 Stale Badge
- **Verify**: Yellow "Stale" badge appears if assessment > 7 days old

---

### Phase 4: Detail View

#### 4.1 Subject Header
- **Location**: Top of detail view
- **Elements**: Identifier (h3), Name (paragraph)
- **Buttons**: "Re-analyze", "Trigger Debate" (if score >= 70%)

#### 4.2 Composite Score Card
- **Elements**:
  - Risk score badge with percentage
  - Color coding (critical=red, high=orange, medium=yellow, low=green)
  - Confidence percentage
  - "Last analyzed" timestamp
  - "Debate adjustment" (if debate exists)

#### 4.3 Risk Radar Chart
- **Type**: SVG radar chart
- **Elements**:
  - 5 concentric grid circles
  - Axis lines (one per dimension)
  - Data polygon (filled)
  - Data points at intersections
  - Dimension labels around perimeter
  - Legend below with dimension colors and scores

#### 4.4 Dimension Assessment Cards
- **Layout**: Grid of cards
- **Each card shows**:
  - Dimension name + score badge
  - Confidence percentage
  - Weight (if configured)
  - Key signals (max 3, color-coded by impact)
  - "Show/Hide Reasoning" toggle
- **Border color**: By risk level (red/orange/yellow/green)

---

### Phase 5: Analysis Actions

#### 5.1 Re-analyze Button
- **Test**: Click "Re-analyze" on subject
- **Verify**: Button shows loading state
- **Verify**: Data refreshes after completion
- **Verify**: Scores update

#### 5.2 Trigger Debate Button
- **Precondition**: Subject score >= 70%
- **Test**: Click "Trigger Debate"
- **Verify**: Debate summary appears
- **Verify**: Three-column layout (Blue Team, Red Team, Arbiter)

#### 5.3 Analyze All Button
- **Location**: Header
- **Test**: Click "Analyze All"
- **Verify**: All subjects in scope analyzed
- **Verify**: Stats refresh

---

### Phase 6: Debate Summary

#### 6.1 Score Adjustment Banner
- **Location**: Top of debate summary
- **Shows**: Adjustment percentage with color
- **Colors**: Red (increase), Green (decrease), Gray (neutral)

#### 6.2 Three Column Layout
- **Blue Team (Defense)**:
  - Heart icon, title, strength score
  - Arguments list
  - Mitigating factors
- **Red Team (Challenge)**:
  - X icon, title, risk score
  - Challenges list
  - Hidden risks
- **Arbiter (Synthesis)**:
  - Icon, title
  - Summary text
  - Key takeaways
  - Recommendation box

#### 6.3 Debate Metadata
- **Shows**: "Debate conducted:" with formatted timestamp
- **Responsive**: Columns stack on mobile (< 768px)

---

### Phase 7: Alerts Tab

#### 7.1 Alerts List
- **Empty state**: "No unacknowledged alerts"
- **With alerts**: List of alert cards

#### 7.2 Alert Card
- **Elements**:
  - Severity badge (critical/warning/info)
  - Subject name
  - Timestamp
  - Alert message
  - Details (trigger score, threshold)
  - "Acknowledge" button
- **Styling**: Color-coded border and background

#### 7.3 Acknowledge Alert
- **Test**: Click "Acknowledge" button
- **Verify**: Alert removed from list
- **Verify**: Tab badge count decreases

---

### Phase 8: Dimensions Tab

#### 8.1 Dimensions Grid
- **Empty state**: "No dimensions configured for this scope"
- **With dimensions**: Grid of dimension cards

#### 8.2 Dimension Card
- **Elements**:
  - Dimension slug (monospace)
  - Weight percentage
  - Dimension name (h4)
  - Description
  - Status badge (Active/Inactive)
- **Inactive styling**: 60% opacity

---

### Phase 9: Learnings Tab

#### 9.1 Learnings List
- **Empty state**: "No pending learnings to review"
- **With learnings**: Vertical list of learning cards

#### 9.2 Learning Card
- **Elements**:
  - Type badge (prompt_improvement, weight_adjustment, etc.)
  - Dimension badge (if linked)
  - Description text
  - Suggested change (JSON code block)
  - "Approve" button (green)
  - "Reject" button (gray)

#### 9.3 Approve/Reject Learning
- **Test**: Click "Approve" or "Reject"
- **Verify**: Learning removed from list
- **Verify**: Tab badge count decreases

---

### Phase 10: Stats Cards

#### 10.1 Stats Row
- **Location**: Below header
- **Cards**:
  - Total Subjects (always shown)
  - Analyzed Subjects (always shown)
  - Avg Risk Score % (warning color if >= 60%)
  - Critical Alerts (red, conditional)
  - Warning Alerts (yellow, conditional)
  - Pending Learnings (conditional)

---

## Screen Structure Reference

### Main Dashboard Structure
```
RiskAgentPane
├── Header: Title, Scope, Analyze All, Refresh
├── Error Banner (conditional)
├── Stats Cards (6)
├── Tab Navigation (5 tabs)
└── Tab Content
    ├── Overview Tab
    │   ├── RiskSidebar (280px left panel)
    │   │   ├── Header + Count Badge
    │   │   ├── Search Input
    │   │   └── Subject List
    │   └── RiskDetailView (main content)
    │       ├── Subject Header + Buttons
    │       ├── Composite Score Card
    │       ├── Risk Radar Chart
    │       ├── Dimension Cards Grid
    │       ├── Debate Summary (conditional)
    │       └── Active Alerts (conditional)
    ├── Alerts Tab → AlertsComponent
    ├── Dimensions Tab → DimensionsComponent
    ├── Learnings Tab → LearningsComponent
    └── Settings Tab → SettingsComponent
```

---

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
- [document key UI elements]
```

---

## Integration with API Tests

Before testing UI, run API test to get expected data:
```bash
# Get scope count
.claude/skills/risk-testing/test-helper.sh call "scopes.list" | jq '.data | length'

# Get subject count for scope
.claude/skills/risk-testing/test-helper.sh call "subjects.list" '{"scopeId": "uuid"}' | jq '.data | length'

# Get unacknowledged alert count
.claude/skills/risk-testing/test-helper.sh call "alerts.list" '{}' '{"acknowledged": false}' | jq '.data | length'
```

Then verify UI shows same counts.

---

## URL Reference

| Screen | URL Pattern |
|--------|-------------|
| Risk Dashboard | `/app/home?forceHome=true&agentSlug=investment-risk-agent` |
| (via menu) | Hamburger → Agents & Conversations → Investment Risk Agent |

---

## Browser Testing Checklist

### Phase 1-2: Foundation
- [ ] Dashboard loads
- [ ] All 5 tabs visible and clickable
- [ ] Settings tab → Scope dropdown works
- [ ] Scope selection changes data

### Phase 3-4: Subjects
- [ ] Sidebar shows subject list
- [ ] Search filters subjects
- [ ] Click subject → Detail loads
- [ ] Score badge shows correct color
- [ ] Radar chart renders

### Phase 5-6: Analysis
- [ ] Re-analyze button works
- [ ] Trigger Debate shows (score >= 70%)
- [ ] Debate summary displays correctly
- [ ] Analyze All works

### Phase 7-9: Management
- [ ] Alerts tab shows alerts
- [ ] Acknowledge removes alert
- [ ] Dimensions tab shows grid
- [ ] Learnings tab shows queue
- [ ] Approve/Reject works

### Phase 10: Stats
- [ ] Stats cards show correct counts
- [ ] Conditional cards appear/hide correctly
- [ ] Tab badges show correct counts
