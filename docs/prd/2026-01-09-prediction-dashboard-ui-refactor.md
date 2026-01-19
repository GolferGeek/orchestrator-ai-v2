# Prediction Dashboard UI Refactor PRD

**Date:** January 9, 2026
**Status:** Draft
**Author:** Architecture Discussion
**Related:** [Prediction System Detailed PRD](./2026-01-08-prediction-system-detailed.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Unified Context Model](#3-unified-context-model)
4. [Domain-Aware Dashboard](#4-domain-aware-dashboard)
5. [Context Management UI](#5-context-management-ui)
6. [HITL Review Queue](#6-hitl-review-queue)
7. [Universe & Target Management](#7-universe--target-management)
8. [A2A Migration](#8-a2a-migration)
9. [Database Schema Changes](#9-database-schema-changes)
10. [Component Architecture](#10-component-architecture)
11. [Implementation Phases](#11-implementation-phases)
12. [Design Specifications](#12-design-specifications)
13. [API Requirements](#13-api-requirements)
14. [Success Metrics](#14-success-metrics)

**Appendices:**
- [Appendix A: Migration Checklist](#appendix-a-migration-checklist)
- [Appendix B: Context Type Descriptions](#appendix-b-context-type-descriptions)
- [Appendix C: TypeScript Interface Definitions](#appendix-c-typescript-interface-definitions)
- [Appendix D: Error Handling Specifications](#appendix-d-error-handling-specifications)
- [Appendix E: Row-Level Security (RLS) Policies](#appendix-e-row-level-security-rls-policies)
- [Appendix F: Testing Strategy](#appendix-f-testing-strategy)
- [Appendix G: Agent-Domain Relationship](#appendix-g-agent-domain-relationship)

---

## 1. Overview

### 1.1 Purpose

Refactor the Prediction Dashboard UI and underlying data model to:
- Implement a **unified context model** where all configuration (including analysts) is stored as context entries
- Display **domain-specific views** (stocks, crypto, elections, polymarket)
- Support the **three-dimensional context grid**: Context Type × Scope Level × LLM Tier
- Enable CRUD operations for contexts at all scope levels
- Provide **HITL review queue** for AI-suggested learnings
- Migrate from REST endpoints to **A2A task-based calls**

### 1.2 The Three Dimensions

Every piece of context in the system exists in three dimensions:

| Dimension | Values | Purpose |
|-----------|--------|---------|
| **context_type** | signal, predictor, prediction, evaluation, learning, analyst | What stage of the pipeline this context helps with |
| **scope_level** | runner, domain, universe, target | Where in the hierarchy it applies |
| **tier** | gold, silver, bronze | Which LLM capability level receives these instructions |

### 1.3 Goals

1. **Unified Model**: All context types (including analysts) in one table
2. **Domain Awareness**: UI reflects which domain is being viewed
3. **Tier-Specific Content**: Every context can have gold/silver/bronze variations
4. **Full Hierarchy Visibility**: Users can navigate and edit contexts at all 4 scope levels
5. **HITL Enablement**: Complete workflow for reviewing AI suggestions
6. **A2A Compliance**: All API calls use the A2A task router pattern

### 1.4 Non-Goals

- Building a mobile-first version (desktop-first, responsive secondary)
- Real-time streaming updates (use polling initially)
- Multi-tenant administration UI (org-level only)

---

## 2. Current State Analysis

### 2.1 What Exists

| Component | Location | Status |
|-----------|----------|--------|
| PredictionAgentPane.vue | `/AgentPanes/Prediction/` | Generic header, no domain awareness |
| CurrentStateComponent.vue | Same | Shows current predictions |
| InstrumentsComponent.vue | Same | Flat list, no universe grouping |
| HistoryComponent.vue | Same | Basic history view |
| ToolsComponent.vue | Same | Tool status display |
| ConfigComponent.vue | Same | Basic config (risk, thresholds, models) |
| LearningComponent.vue | Same | Postmortems, missed opps, chat |

### 2.2 Current Database Tables

| Table | Issue |
|-------|-------|
| `prediction.analysts` | Separate from other contexts |
| `prediction.learnings` | Learning process records (keep) |
| `prediction.learning_queue` | HITL queue (keep) |
| `prediction.targets.context` | Single TEXT field, not tier-aware |

### 2.3 What's Missing

| Feature | Gap |
|---------|-----|
| Unified Context Table | Analysts separate from other contexts |
| Context Type Support | No signal/predictor/prediction/evaluation contexts |
| Tier-Specific Content | No gold/silver/bronze variations for contexts |
| Domain Selector | No way to see/switch domain context |
| Context Hierarchy Browser | No navigation through Runner→Domain→Universe→Target |
| Learning Queue (HITL) | No UI for reviewing AI suggestions |
| A2A Integration | All calls use REST, not A2A task router |

---

## 3. Unified Context Model

### 3.1 Core Concept

Replace separate tables with one unified `prediction.contexts` table that stores **all context types at all scope levels with tier-specific content**.

### 3.2 Context Types

| Type | Purpose | Example Content |
|------|---------|-----------------|
| `signal` | How to identify and evaluate signals | "Supply chain leaks from Asia are reliable signals for Apple" |
| `predictor` | How to assess and weight predictors | "Weight iPhone cycle signals higher in H2" |
| `prediction` | How to make prediction decisions | "Post-earnings reactions often reverse within 48 hours" |
| `evaluation` | How to evaluate outcomes | "Consider Services revenue growth as secondary success metric" |
| `learning` | How to learn from results | "Track analyst accuracy separately by domain" |
| `analyst` | AI persona for analysis | Includes perspective, weight, and tier-specific instructions |

### 3.3 Scope Levels

| Level | Description | Identifiers |
|-------|-------------|-------------|
| `runner` | System-wide defaults | None (global) |
| `domain` | Domain-specific (stocks, crypto, etc.) | `domain` field |
| `universe` | User's collection of targets | `universe_id` |
| `target` | Individual ticker/contract | `target_id` |

### 3.4 LLM Tiers

| Tier | Models | Instruction Style |
|------|--------|-------------------|
| `gold` | Claude Opus, GPT-4, Gemini Ultra | Detailed, nuanced, multi-step reasoning |
| `silver` | Claude Sonnet, GPT-4-mini, Gemini Pro | Balanced, explicit steps |
| `bronze` | Claude Haiku, GPT-3.5-turbo | Simple, structured, yes/no formats |

### 3.5 The Full Grid

Every context entry can exist at any intersection of this 3D grid:

```
                        │ Runner │ Domain │ Universe │ Target │
────────────────────────┼────────┼────────┼──────────┼────────┤
signal                  │        │        │          │        │
  ├── gold              │   ✓    │   ✓    │    ✓     │   ✓    │
  ├── silver            │   ✓    │   ✓    │    ✓     │   ✓    │
  └── bronze            │   ✓    │   ✓    │    ✓     │   ✓    │
────────────────────────┼────────┼────────┼──────────┼────────┤
predictor               │        │        │          │        │
  ├── gold              │   ✓    │   ✓    │    ✓     │   ✓    │
  ├── silver            │   ✓    │   ✓    │    ✓     │   ✓    │
  └── bronze            │   ✓    │   ✓    │    ✓     │   ✓    │
────────────────────────┼────────┼────────┼──────────┼────────┤
prediction              │        │        │          │        │
  ├── gold              │   ✓    │   ✓    │    ✓     │   ✓    │
  ├── silver            │   ✓    │   ✓    │    ✓     │   ✓    │
  └── bronze            │   ✓    │   ✓    │    ✓     │   ✓    │
────────────────────────┼────────┼────────┼──────────┼────────┤
evaluation              │   ...  │  ...   │   ...    │  ...   │
────────────────────────┼────────┼────────┼──────────┼────────┤
learning                │   ...  │  ...   │   ...    │  ...   │
────────────────────────┼────────┼────────┼──────────┼────────┤
analyst                 │        │        │          │        │
  ├── gold              │   ✓    │   ✓    │    ✓     │   ✓    │
  ├── silver            │   ✓    │   ✓    │    ✓     │   ✓    │
  └── bronze            │   ✓    │   ✓    │    ✓     │   ✓    │
```

### 3.6 Example: Apple (AAPL) Context Stack

When evaluating a signal for AAPL, the system collects all applicable contexts:

```
Context Type: signal
├── Runner Level
│   ├── gold: "Perform deep analysis of market-wide correlations..."
│   ├── silver: "Check for market-wide events that may affect signal..."
│   └── bronze: "Is this signal during market hours? Is volume normal?"
│
├── Domain Level (stocks)
│   ├── gold: "Analyze earnings surprise implications, guidance language..."
│   ├── silver: "Check earnings, guidance, sector trends..."
│   └── bronze: "Earnings beat? Guidance raised/lowered?"
│
├── Universe Level (My Tech Portfolio)
│   ├── gold: "Focus on cloud/AI revenue signals, R&D investment patterns..."
│   ├── silver: "Prioritize cloud and AI mentions..."
│   └── bronze: "Mentions cloud? Mentions AI?"
│
└── Target Level (AAPL)
    ├── gold: "Supply chain leaks from Foxconn and related manufacturers
    │         have historically led price action by 2-3 weeks. Cross-reference
    │         with iPhone production cycle timing..."
    ├── silver: "Supply chain news is reliable. Check production timing..."
    └── bronze: "Supply chain leak? Production news?"

Context Type: analyst (Technical Tina)
├── Runner Level
│   ├── gold: "You are Technical Tina, an expert in technical analysis.
│   │         Analyze chart patterns, support/resistance levels,
│   │         volume profiles, and momentum indicators..."
│   ├── silver: "You are Technical Tina. Analyze technicals: patterns,
│   │           support/resistance, volume, momentum..."
│   └── bronze: "Technical analyst. Check: trend, support, resistance, volume."
│
└── Target Level (AAPL)
    ├── gold: "For AAPL specifically, the 200-day MA has been a reliable
    │         support level. Watch for volume divergence near earnings..."
    ├── silver: "AAPL: 200-day MA is key support. Watch volume near earnings..."
    └── bronze: "AAPL: Above 200-day MA? Volume increasing?"
```

### 3.7 Relationship to Learnings Table

The `prediction.learnings` table **remains separate** as it tracks:
- Learning effectiveness (times_applied, times_helpful)
- Source (which evaluation/missed opportunity generated it)
- Version history (superseded_by)

When a learning is approved via HITL, the user chooses:
1. **"Create as Context"** → New row in `prediction.contexts` with `source_learning_id` reference
2. **"Keep as Learning Record"** → Stays in `prediction.learnings` for tracking/analytics

---

## 4. Domain-Aware Dashboard

### 4.1 Domain Context

The dashboard must reflect which domain is being viewed:
- Determined by agent's configured domain or active universe's domain
- Affects theming, terminology, and available features

### 4.2 Domain Theming

| Domain | Primary Color | Icon | Terminology |
|--------|--------------|------|-------------|
| **stocks** | Blue (#3B82F6) | 📈 | Stocks, Tickers, Price Targets |
| **crypto** | Orange (#F59E0B) | ₿ | Crypto, Coins, Token |
| **elections** | Red (#EF4444) | 🗳️ | Elections, Candidates, Polls |
| **polymarket** | Purple (#8B5CF6) | 🎲 | Markets, Contracts, Odds |

### 4.3 Domain Header Component

```vue
<!-- DomainHeader.vue -->
<template>
  <div class="domain-header" :class="`domain-${domain}`">
    <div class="domain-indicator">
      <span class="domain-icon">{{ domainConfig.icon }}</span>
      <span class="domain-label">{{ domainConfig.label }}</span>
    </div>
    <div class="agent-info">
      <h1>{{ agentName }}</h1>
      <div class="scope-breadcrumb">
        <span class="scope-item" @click="goToRunner">Runner</span>
        <span class="separator">›</span>
        <span class="scope-item active">{{ domainConfig.label }}</span>
        <template v-if="currentUniverse">
          <span class="separator">›</span>
          <span class="scope-item active">{{ currentUniverse.name }}</span>
        </template>
        <template v-if="currentTarget">
          <span class="separator">›</span>
          <span class="scope-item active">{{ currentTarget.symbol }}</span>
        </template>
      </div>
    </div>
    <div class="context-stats">
      <span class="stat">{{ contextCounts.signal }} signal contexts</span>
      <span class="stat">{{ contextCounts.analyst }} analysts</span>
      <span class="stat">{{ contextCounts.total }} total contexts</span>
    </div>
  </div>
</template>
```

---

## 5. Context Management UI

### 5.1 Context Navigator

A tree-view sidebar showing the full hierarchy with context counts by type:

```
📁 Runner (Global)
│  ├── 🎯 signal (3)
│  ├── 📊 predictor (2)
│  ├── 🔮 prediction (2)
│  ├── ✅ evaluation (1)
│  ├── 📚 learning (4)
│  └── 👤 analyst (5)
│
📁 Stocks Domain
│  ├── 🎯 signal (4)
│  ├── 📊 predictor (3)
│  ├── 👤 analyst (3)
│  │
│  └── 📁 My Stock Portfolio (Universe)
│      ├── 🎯 signal (2)
│      ├── 👤 analyst (1)
│      │
│      ├── 📍 AAPL
│      │   ├── 🎯 signal (2)
│      │   ├── 📊 predictor (1)
│      │   └── 👤 analyst (1)
│      │
│      ├── 📍 TSLA
│      └── 📍 NVDA
│
📁 Crypto Domain
│  └── ...
```

### 5.2 Context Navigator Component

```vue
<!-- ContextNavigator.vue -->
<template>
  <div class="context-navigator">
    <div class="nav-header">
      <h3>Context Hierarchy</h3>
      <div class="nav-actions">
        <button @click="collapseAll" title="Collapse All">
          <icon name="collapse" />
        </button>
        <button @click="expandAll" title="Expand All">
          <icon name="expand" />
        </button>
      </div>
    </div>

    <div class="nav-tree">
      <!-- Runner Level -->
      <TreeNode
        :node="runnerNode"
        :contextCounts="getContextCounts('runner', null)"
        :expanded="isExpanded('runner')"
        :selected="isSelected('runner', null)"
        @toggle="toggleNode('runner')"
        @select="selectScope('runner', null)"
      />

      <!-- Domain Levels -->
      <TreeNode
        v-for="domain in domains"
        :key="domain.id"
        :node="domain"
        :contextCounts="getContextCounts('domain', domain.id)"
        :expanded="isExpanded(`domain-${domain.id}`)"
        :selected="isSelected('domain', domain.id)"
        @toggle="toggleNode(`domain-${domain.id}`)"
        @select="selectScope('domain', domain.id)"
      >
        <!-- Universe Levels -->
        <TreeNode
          v-for="universe in domain.universes"
          :key="universe.id"
          :node="universe"
          :contextCounts="getContextCounts('universe', universe.id)"
          @select="selectScope('universe', universe.id)"
        >
          <!-- Target Levels -->
          <TreeNode
            v-for="target in universe.targets"
            :key="target.id"
            :node="target"
            :contextCounts="getContextCounts('target', target.id)"
            @select="selectScope('target', target.id)"
          />
        </TreeNode>
      </TreeNode>
    </div>
  </div>
</template>
```

### 5.3 Context List Component

When a scope is selected, show all contexts at that scope:

```vue
<!-- ContextList.vue -->
<template>
  <div class="context-list">
    <div class="list-header">
      <h3>Contexts at {{ scopeLabel }}</h3>
      <button class="add-context-btn" @click="showAddContext = true">
        + Add Context
      </button>
    </div>

    <!-- Filter by context type -->
    <div class="context-type-tabs">
      <button
        v-for="type in contextTypes"
        :key="type.id"
        :class="['type-tab', { active: activeType === type.id }]"
        @click="activeType = type.id"
      >
        <span class="type-icon">{{ type.icon }}</span>
        {{ type.label }}
        <span class="count">({{ getCountForType(type.id) }})</span>
      </button>
    </div>

    <!-- Contexts Grid -->
    <div class="contexts-grid">
      <ContextCard
        v-for="context in filteredContexts"
        :key="context.id"
        :context="context"
        :isInherited="context.scope_level !== currentScopeLevel"
        @edit="editContext(context)"
        @duplicate="duplicateToLowerScope(context)"
      />
    </div>

    <AddContextDialog
      v-if="showAddContext"
      :scope="currentScope"
      :type="activeType"
      @close="showAddContext = false"
      @created="onContextCreated"
    />
  </div>
</template>

<script setup>
const contextTypes = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'signal', label: 'Signal', icon: '🎯' },
  { id: 'predictor', label: 'Predictor', icon: '📊' },
  { id: 'prediction', label: 'Prediction', icon: '🔮' },
  { id: 'evaluation', label: 'Evaluation', icon: '✅' },
  { id: 'learning', label: 'Learning', icon: '📚' },
  { id: 'analyst', label: 'Analyst', icon: '👤' },
];
</script>
```

### 5.4 Context Card Component

```vue
<!-- ContextCard.vue -->
<template>
  <div class="context-card" :class="{ inherited: isInherited }">
    <div class="card-header">
      <div class="context-identity">
        <span class="type-icon">{{ typeIcon }}</span>
        <span class="context-name">{{ context.name }}</span>
      </div>
      <div class="context-badges">
        <span class="scope-badge" :class="`scope-${context.scope_level}`">
          {{ context.scope_level }}
        </span>
        <span v-if="isInherited" class="inherited-badge">inherited</span>
      </div>
    </div>

    <!-- Tier Indicators -->
    <div class="tier-indicators">
      <span
        v-for="tier in ['gold', 'silver', 'bronze']"
        :key="tier"
        :class="['tier-dot', `tier-${tier}`, { filled: hasTierContent(tier) }]"
        :title="`${tier} tier: ${hasTierContent(tier) ? 'configured' : 'empty'}`"
      />
    </div>

    <!-- Preview of content -->
    <div class="content-preview">
      {{ getPreviewContent() }}
    </div>

    <!-- Analyst-specific info -->
    <div v-if="context.context_type === 'analyst'" class="analyst-info">
      <div class="weight">
        <label>Weight:</label>
        <span>{{ context.analyst_config?.default_weight?.toFixed(2) }}</span>
      </div>
      <div class="perspective">
        {{ context.analyst_config?.perspective }}
      </div>
    </div>

    <div class="card-actions">
      <button @click="$emit('edit', context)">Edit</button>
      <button v-if="isInherited" @click="$emit('duplicate', context)">
        Copy to {{ currentScopeLabel }}
      </button>
    </div>
  </div>
</template>
```

### 5.5 Context Editor Component

The full editor for a context, including tier-specific content:

```vue
<!-- ContextEditor.vue -->
<template>
  <div class="context-editor">
    <div class="editor-header">
      <h2>{{ isNew ? 'New Context' : 'Edit Context' }}</h2>
      <div class="editor-badges">
        <span class="type-badge" :class="`type-${context.context_type}`">
          {{ context.context_type }}
        </span>
        <span class="scope-badge" :class="`scope-${context.scope_level}`">
          {{ context.scope_level }}
        </span>
      </div>
    </div>

    <!-- Basic Info -->
    <div class="form-section">
      <div class="form-group">
        <label>Name *</label>
        <input v-model="context.name" type="text" placeholder="Descriptive name..." />
      </div>

      <div class="form-group">
        <label>Slug *</label>
        <input v-model="context.slug" type="text" placeholder="unique-identifier" />
      </div>

      <div v-if="context.context_type === 'analyst'" class="form-group">
        <label>Perspective</label>
        <input
          v-model="context.analyst_config.perspective"
          type="text"
          placeholder="What this analyst focuses on..."
        />
      </div>

      <div v-if="context.context_type === 'analyst'" class="form-group">
        <label>Default Weight</label>
        <input
          v-model.number="context.analyst_config.default_weight"
          type="number"
          min="0"
          max="2"
          step="0.1"
        />
        <span class="help-text">0.0 to 2.0 (1.0 = normal weight)</span>
      </div>
    </div>

    <!-- Tier-Specific Content -->
    <div class="form-section tier-section">
      <h3>Tier-Specific Content</h3>
      <p class="section-help">
        Different LLM tiers have different capabilities. Provide appropriate instructions for each tier.
      </p>

      <TierContentEditor
        v-model:gold="context.tier_content.gold"
        v-model:silver="context.tier_content.silver"
        v-model:bronze="context.tier_content.bronze"
        :context-type="context.context_type"
      />
    </div>

    <!-- Actions -->
    <div class="editor-actions">
      <button class="cancel-btn" @click="$emit('cancel')">Cancel</button>
      <button class="save-btn" @click="save" :disabled="!isValid">
        {{ isNew ? 'Create Context' : 'Save Changes' }}
      </button>
    </div>
  </div>
</template>
```

### 5.6 Tier Content Editor Component

```vue
<!-- TierContentEditor.vue -->
<template>
  <div class="tier-content-editor">
    <div class="tier-tabs">
      <button
        v-for="tier in tiers"
        :key="tier.id"
        :class="['tier-tab', `tier-${tier.id}`, { active: activeTier === tier.id }]"
        @click="activeTier = tier.id"
      >
        <span class="tier-icon">{{ tier.icon }}</span>
        {{ tier.label }}
        <span v-if="hasContent(tier.id)" class="has-content">✓</span>
      </button>
    </div>

    <div class="tier-info-panel">
      <div class="model-examples">
        <strong>Models:</strong> {{ tierInfo[activeTier].models }}
      </div>
      <div class="instruction-style">
        <strong>Style:</strong> {{ tierInfo[activeTier].style }}
      </div>
    </div>

    <div class="content-editor">
      <textarea
        :value="currentContent"
        @input="updateContent($event.target.value)"
        :placeholder="getPlaceholder()"
        rows="12"
      />
    </div>

    <div class="tier-actions">
      <button
        v-if="activeTier !== 'gold' && content.gold"
        @click="copyFrom('gold')"
      >
        Copy from Gold
      </button>
      <button
        v-if="activeTier === 'bronze' && content.gold"
        @click="autoSimplify"
        :disabled="isSimplifying"
      >
        {{ isSimplifying ? 'Simplifying...' : 'Auto-simplify from Gold' }}
      </button>
    </div>
  </div>
</template>

<script setup>
const tiers = [
  { id: 'gold', label: 'Gold', icon: '🥇' },
  { id: 'silver', label: 'Silver', icon: '🥈' },
  { id: 'bronze', label: 'Bronze', icon: '🥉' },
];

const tierInfo = {
  gold: {
    models: 'Claude Opus, GPT-4, Gemini Ultra',
    style: 'Detailed, nuanced. Multi-step reasoning. Can handle complex analysis.',
  },
  silver: {
    models: 'Claude Sonnet, GPT-4-mini, Gemini Pro',
    style: 'Balanced. Be explicit about steps. Good but not top-tier reasoning.',
  },
  bronze: {
    models: 'Claude Haiku, GPT-3.5-turbo',
    style: 'Simple and structured. Use yes/no questions. Explicit criteria only.',
  },
};
</script>
```

### 5.7 Inheritance Visualization

Show effective contexts for a target with their source scopes:

```vue
<!-- InheritanceView.vue -->
<template>
  <div class="inheritance-view">
    <h4>Effective Contexts for {{ targetSymbol }}</h4>

    <div class="tier-selector">
      <label>Show content for:</label>
      <select v-model="selectedTier">
        <option value="gold">Gold Tier</option>
        <option value="silver">Silver Tier</option>
        <option value="bronze">Bronze Tier</option>
      </select>
    </div>

    <div class="context-type-sections">
      <div v-for="type in contextTypes" :key="type" class="type-section">
        <h5 class="type-header">
          <span class="type-icon">{{ getTypeIcon(type) }}</span>
          {{ type }} Contexts
        </h5>

        <div class="inheritance-stack">
          <div
            v-for="context in getContextsForType(type)"
            :key="context.id"
            class="inherited-context"
            :class="`scope-${context.scope_level}`"
          >
            <div class="context-header">
              <span class="scope-badge">{{ context.scope_level }}</span>
              <span class="context-name">{{ context.name }}</span>
            </div>
            <div class="context-content">
              {{ getTierContent(context, selectedTier) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="effective-totals">
      <div class="total-card" v-for="type in contextTypes" :key="type">
        <span class="total-value">{{ getCountForType(type) }}</span>
        <span class="total-label">{{ type }}</span>
      </div>
    </div>
  </div>
</template>
```

---

## 6. HITL Review Queue

### 6.1 Overview

When the learning system generates suggestions, they go into `prediction.learning_queue` for human review. The user can:
1. **Approve** → Creates a new context (or learning record)
2. **Modify & Approve** → Edit before creating
3. **Reject** → Discard with reason

### 6.2 Review Queue Component

```vue
<!-- ReviewQueue.vue -->
<template>
  <div class="review-queue">
    <div class="queue-header">
      <h3>Pending Reviews</h3>
      <div class="queue-stats">
        <span class="stat pending">{{ pendingCount }} pending</span>
        <span class="stat reviewed">{{ todayReviewed }} reviewed today</span>
      </div>
    </div>

    <div class="queue-filters">
      <select v-model="confidenceFilter">
        <option value="all">All Confidence</option>
        <option value="high">High (≥0.8)</option>
        <option value="medium">Medium (0.5-0.8)</option>
        <option value="low">Low (&lt;0.5)</option>
      </select>

      <select v-model="typeFilter">
        <option value="all">All Context Types</option>
        <option v-for="type in contextTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <select v-model="scopeFilter">
        <option value="all">All Scopes</option>
        <option value="runner">Runner</option>
        <option value="domain">Domain</option>
        <option value="universe">Universe</option>
        <option value="target">Target</option>
      </select>
    </div>

    <div class="queue-list">
      <ReviewCard
        v-for="item in filteredQueue"
        :key="item.id"
        :item="item"
        @approve="showApproveDialog(item)"
        @reject="showRejectDialog(item)"
      />
    </div>
  </div>
</template>
```

### 6.3 Review Card Component

```vue
<!-- ReviewCard.vue -->
<template>
  <div class="review-card" :class="`confidence-${confidenceLevel}`">
    <div class="card-header">
      <div class="source-info">
        <span class="source-type">
          From: {{ formatSourceType(item.source_type) }}
        </span>
        <span class="created-at">{{ formatDate(item.created_at) }}</span>
      </div>
      <div class="confidence-meter">
        <div class="meter-fill" :style="{ width: `${item.ai_confidence * 100}%` }" />
        <span class="confidence-value">{{ (item.ai_confidence * 100).toFixed(0) }}%</span>
      </div>
    </div>

    <div class="suggested-context">
      <div class="context-meta">
        <span class="type-badge" :class="`type-${item.suggested_context_type}`">
          {{ item.suggested_context_type }}
        </span>
        <span class="scope-badge" :class="`scope-${item.suggested_scope_level}`">
          {{ item.suggested_scope_level }}
          <template v-if="item.suggested_domain">: {{ item.suggested_domain }}</template>
        </span>
      </div>
      <h4 class="context-title">{{ item.suggested_title }}</h4>
      <p class="context-description">{{ item.suggested_description }}</p>
    </div>

    <div class="ai-reasoning">
      <h5>AI Reasoning:</h5>
      <p>{{ item.ai_reasoning }}</p>
    </div>

    <div class="tier-preview">
      <h5>Suggested Content (Silver Tier Preview):</h5>
      <pre>{{ item.suggested_tier_content?.silver || item.suggested_description }}</pre>
    </div>

    <div class="card-actions">
      <button class="approve-btn" @click="$emit('approve', item)">
        ✓ Approve as Context
      </button>
      <button class="modify-btn" @click="$emit('modify', item)">
        ✏️ Modify & Approve
      </button>
      <button class="reject-btn" @click="$emit('reject', item)">
        ✗ Reject
      </button>
    </div>
  </div>
</template>
```

### 6.4 Approve Dialog

When approving, user chooses destination and can modify scope:

```vue
<!-- ApproveContextDialog.vue -->
<template>
  <div class="approve-dialog">
    <div class="dialog-header">
      <h3>Approve as Context</h3>
    </div>

    <div class="dialog-content">
      <!-- Context Type -->
      <div class="form-group">
        <label>Context Type:</label>
        <select v-model="approved.context_type">
          <option v-for="type in contextTypes" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
        <span class="ai-suggested" v-if="approved.context_type !== item.suggested_context_type">
          AI suggested: {{ item.suggested_context_type }}
        </span>
      </div>

      <!-- Scope Level -->
      <div class="form-group">
        <label>Scope Level:</label>
        <select v-model="approved.scope_level">
          <option value="runner">Runner (Global)</option>
          <option value="domain">Domain</option>
          <option value="universe">Universe</option>
          <option value="target">Target</option>
        </select>
      </div>

      <!-- Domain (if domain+) -->
      <div v-if="approved.scope_level !== 'runner'" class="form-group">
        <label>Domain:</label>
        <select v-model="approved.domain">
          <option value="stocks">Stocks</option>
          <option value="crypto">Crypto</option>
          <option value="elections">Elections</option>
          <option value="polymarket">Polymarket</option>
        </select>
      </div>

      <!-- Universe (if universe+) -->
      <div v-if="['universe', 'target'].includes(approved.scope_level)" class="form-group">
        <label>Universe:</label>
        <select v-model="approved.universe_id">
          <option v-for="u in universes" :key="u.id" :value="u.id">
            {{ u.name }}
          </option>
        </select>
      </div>

      <!-- Target (if target) -->
      <div v-if="approved.scope_level === 'target'" class="form-group">
        <label>Target:</label>
        <select v-model="approved.target_id">
          <option v-for="t in targets" :key="t.id" :value="t.id">
            {{ t.symbol }} - {{ t.name }}
          </option>
        </select>
      </div>

      <!-- Tier Content Editor -->
      <div class="form-group">
        <label>Content:</label>
        <TierContentEditor
          v-model:gold="approved.tier_content.gold"
          v-model:silver="approved.tier_content.silver"
          v-model:bronze="approved.tier_content.bronze"
          :context-type="approved.context_type"
        />
      </div>

      <!-- Reviewer Notes -->
      <div class="form-group">
        <label>Reviewer Notes (optional):</label>
        <textarea v-model="reviewerNotes" rows="2" placeholder="Why you made these changes..." />
      </div>
    </div>

    <div class="dialog-actions">
      <button class="cancel-btn" @click="$emit('close')">Cancel</button>
      <button class="approve-btn" @click="approve">Create Context</button>
    </div>
  </div>
</template>
```

---

## 7. Universe & Target Management

### 7.1 Universe Manager

```vue
<!-- UniverseManager.vue -->
<template>
  <div class="universe-manager">
    <div class="manager-header">
      <h3>{{ domainLabel }} Universes</h3>
      <button class="create-btn" @click="showCreateDialog = true">
        + Create Universe
      </button>
    </div>

    <div class="universes-grid">
      <UniverseCard
        v-for="universe in universes"
        :key="universe.id"
        :universe="universe"
        :contextCounts="getContextCounts(universe.id)"
        @select="selectUniverse(universe)"
        @edit="editUniverse(universe)"
      />
    </div>
  </div>
</template>
```

### 7.2 Target Manager

```vue
<!-- TargetManager.vue -->
<template>
  <div class="target-manager">
    <div class="manager-header">
      <h3>Targets in {{ universe.name }}</h3>
      <div class="add-target">
        <input
          v-model="newSymbol"
          :placeholder="getPlaceholder()"
          @keyup.enter="addTarget"
        />
        <button @click="addTarget" :disabled="!newSymbol">Add</button>
      </div>
    </div>

    <div class="targets-table">
      <table>
        <thead>
          <tr>
            <th>{{ symbolLabel }}</th>
            <th>Name</th>
            <th>Signal</th>
            <th>Predictor</th>
            <th>Analyst</th>
            <th>Total Contexts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="target in targets" :key="target.id">
            <td class="symbol">{{ target.symbol }}</td>
            <td>{{ target.name }}</td>
            <td>{{ getContextCount(target.id, 'signal') }}</td>
            <td>{{ getContextCount(target.id, 'predictor') }}</td>
            <td>{{ getContextCount(target.id, 'analyst') }}</td>
            <td>{{ getTotalContextCount(target.id) }}</td>
            <td>
              <button @click="selectTarget(target)">Contexts</button>
              <button @click="viewInheritance(target)">Inheritance</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

---

## 8. A2A Migration

### 8.1 New A2A Service

The frontend service uses the A2A dashboard mode pattern, matching the existing `predictionDashboardService.ts`.

**Important:**
- Endpoint: `POST /agent-to-agent/${orgSlug}/${agentSlug}/tasks`
- Mode: `dashboard` (in params)
- Actions are normalized to lowercase by the router (e.g., `getHierarchy` → `gethierarchy`)

```typescript
// apps/web/src/services/predictionContextService.ts
// Extends the existing predictionDashboardService pattern

import { useAuthStore } from '@/stores/rbacStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type {
  ExecutionContext,
  DashboardRequestPayload,
  DashboardResponsePayload,
} from '@orchestrator-ai/transport-types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6100';

class PredictionContextService {
  private agentSlug = 'prediction-runner';

  private getOrgSlug(): string {
    const authStore = useAuthStore();
    const org = authStore.currentOrganization;
    if (!org) throw new Error('No organization context available');
    return org;
  }

  private getContext(): ExecutionContext {
    const store = useExecutionContextStore();
    return store.current;
  }

  private getAuthHeaders(): Record<string, string> {
    const authStore = useAuthStore();
    const token = authStore.token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Execute a dashboard request using the A2A pattern.
   *
   * @param action - Action in format 'entity.operation' (e.g., 'contexts.list')
   *                 Note: Router normalizes to lowercase (getHierarchy → gethierarchy)
   * @param params - Request parameters
   * @param filters - Optional filters
   * @param pagination - Optional pagination
   */
  private async executeDashboardRequest<T>(
    action: string,
    params?: Record<string, unknown>,
    filters?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardResponsePayload<T>> {
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.agentSlug)}/tasks`;

    const payload: DashboardRequestPayload = {
      action,
      params,
      filters,
      pagination,
    };

    const request = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: `dashboard.${action}`,
      params: {
        mode: 'dashboard',  // Required: indicates dashboard mode
        payload,
        context: this.getContext(),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || response.statusText);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Dashboard request failed');
    }

    // Response structure: { result: { success: true, content: T, metadata?: {...} } }
    if (!data.result?.success) {
      throw new Error(data.result?.error?.message || 'Dashboard request failed');
    }

    return {
      content: data.result.content,
      metadata: data.result.metadata,
    };
  }

  // ==================== Context Operations ====================

  async getContextHierarchy(): Promise<DashboardResponsePayload<ContextHierarchyNode[]>> {
    // Note: 'getHierarchy' is normalized to 'gethierarchy' by router
    return this.executeDashboardRequest<ContextHierarchyNode[]>('contexts.getHierarchy');
  }

  async listContexts(
    filters?: ContextListFilters
  ): Promise<DashboardResponsePayload<PredictionContext[]>> {
    return this.executeDashboardRequest<PredictionContext[]>(
      'contexts.list',
      undefined,
      filters
    );
  }

  async getEffectiveContexts(
    params: GetEffectiveContextsParams
  ): Promise<DashboardResponsePayload<EffectiveContext[]>> {
    // Note: 'getEffective' is normalized to 'geteffective' by router
    return this.executeDashboardRequest<EffectiveContext[]>(
      'contexts.getEffective',
      params
    );
  }

  async createContext(
    params: ContextCreateParams
  ): Promise<DashboardResponsePayload<PredictionContext>> {
    return this.executeDashboardRequest<PredictionContext>(
      'contexts.create',
      params
    );
  }

  async updateContext(
    params: ContextUpdateParams
  ): Promise<DashboardResponsePayload<PredictionContext>> {
    return this.executeDashboardRequest<PredictionContext>(
      'contexts.update',
      params
    );
  }

  async deleteContext(
    params: { id: string }
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'contexts.delete',
      params
    );
  }

  // ==================== Learning Queue (HITL) ====================

  async listLearningQueue(
    filters?: LearningQueueListFilters
  ): Promise<DashboardResponsePayload<LearningQueueItem[]>> {
    return this.executeDashboardRequest<LearningQueueItem[]>(
      'learning-queue.list',
      undefined,
      filters
    );
  }

  async approveAsContext(
    params: ApproveAsContextParams
  ): Promise<DashboardResponsePayload<PredictionContext>> {
    return this.executeDashboardRequest<PredictionContext>(
      'learning-queue.approveAsContext',
      params
    );
  }

  async rejectLearning(
    params: { id: string; reason: string }
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'learning-queue.reject',
      params
    );
  }
}

export const predictionContextService = new PredictionContextService();
```

### 8.1.1 Action Naming Convention

The router normalizes actions to lowercase. When calling the service:

| Service Call | Method in Request | Router Receives |
|--------------|------------------|-----------------|
| `contexts.getHierarchy` | `dashboard.contexts.getHierarchy` | `action: 'gethierarchy'` |
| `contexts.getEffective` | `dashboard.contexts.getEffective` | `action: 'geteffective'` |
| `contexts.list` | `dashboard.contexts.list` | `action: 'list'` |
| `learning-queue.approveAsContext` | `dashboard.learning-queue.approveAsContext` | `action: 'approveascontext'` |

The handler's switch statement uses lowercase comparisons (see Section 8.2).

### 8.2 A2A Handler (API Side)

The API uses the `IDashboardHandler` interface pattern with a central `PredictionDashboardRouter` that dispatches to entity-specific handlers.

```typescript
// apps/api/src/prediction-runner/task-router/handlers/context.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext, DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';

@Injectable()
export class ContextHandler implements IDashboardHandler {
  private readonly logger = new Logger(ContextHandler.name);

  constructor(
    private readonly contextService: ContextService,
    private readonly learningQueueService: LearningQueueService,
  ) {}

  /**
   * Execute a context action
   */
  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const params = payload.params || {};
    const filters = payload.filters || {};

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params, filters, payload.pagination, context);
      case 'get':
        return this.handleGet(params, context);
      case 'geteffective':
        return this.handleGetEffective(params, context);
      case 'create':
        return this.handleCreate(params, context);
      case 'update':
        return this.handleUpdate(params, context);
      case 'delete':
        return this.handleDelete(params, context);
      case 'gethierarchy':
        return this.handleGetHierarchy(params, context);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported context action: ${action}`,
          { supportedActions: this.getSupportedActions() }
        );
    }
  }

  getSupportedActions(): string[] {
    // Return lowercase to match switch case comparisons
    return ['list', 'get', 'geteffective', 'create', 'update', 'delete', 'gethierarchy'];
  }

  private async handleList(
    params: Record<string, unknown>,
    filters: Record<string, unknown>,
    pagination: DashboardRequestPayload['pagination'],
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const scopeLevel = filters.scopeLevel as string | undefined;
    const scopeId = filters.scopeId as string | undefined;
    const contextType = filters.contextType as string | undefined;

    const { items, total } = await this.contextService.findByScope(
      context.orgSlug,
      scopeLevel,
      scopeId,
      contextType,
      pagination
    );

    return buildDashboardSuccess(
      items,
      buildPaginationMetadata(total, pagination?.page, pagination?.pageSize)
    );
  }

  private async handleGetEffective(
    params: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const targetId = params.targetId as string;
    const contextType = params.contextType as string;
    const tier = params.tier as string || 'silver';

    if (!targetId || !contextType) {
      return buildDashboardError(
        'MISSING_PARAMS',
        'targetId and contextType are required'
      );
    }

    // Uses the get_effective_contexts SQL function
    const contexts = await this.contextService.getEffectiveForTarget(
      targetId,
      contextType,
      tier
    );

    return buildDashboardSuccess(contexts);
  }

  private async handleCreate(
    params: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const created = await this.contextService.create({
      ...params,
      organizationSlug: context.orgSlug,
    });
    return buildDashboardSuccess(created);
  }

  // ... additional handler methods
}
```

**Router Registration:**

The `ContextHandler` is registered in the `PredictionDashboardRouter`:

```typescript
// apps/api/src/prediction-runner/task-router/prediction-dashboard.router.ts

import { ContextHandler } from './handlers/context.handler';

@Injectable()
export class PredictionDashboardRouter {
  constructor(
    // ... existing handlers
    private readonly contextHandler: ContextHandler,
  ) {}

  private async routeToHandler(
    entity: string,
    operation: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    switch (entity.toLowerCase()) {
      // ... existing cases
      case 'contexts':
      case 'context':
        return this.contextHandler.execute(operation, payload, context);
      // ...
    }
  }
}
```

### 8.3 ContextService Interface

The `ContextHandler` depends on `ContextService` for database operations:

```typescript
// apps/api/src/prediction-runner/services/context.service.ts

import { Injectable } from '@nestjs/common';
import type { PredictionContext, EffectiveContext, TierContent } from '@orchestrator-ai/transport-types';

export interface ContextServicePagination {
  page?: number;
  pageSize?: number;
}

export interface FindByScopeResult {
  items: PredictionContext[];
  total: number;
}

@Injectable()
export class ContextService {
  /**
   * Find contexts by scope level and optional filters.
   * Returns paginated results.
   */
  async findByScope(
    orgSlug: string,
    scopeLevel?: string,
    scopeId?: string,
    contextType?: string,
    pagination?: ContextServicePagination
  ): Promise<FindByScopeResult>;

  /**
   * Get effective contexts for a target using the get_effective_contexts SQL function.
   * Returns contexts from all applicable scopes (runner → domain → universe → target)
   * with tier-specific content resolved.
   */
  async getEffectiveForTarget(
    targetId: string,
    contextType: string,
    tier: string
  ): Promise<EffectiveContext[]>;

  /**
   * Create a new context. Throws if organization_slug is missing.
   */
  async create(params: {
    organizationSlug: string;
    context_type: string;
    scope_level: string;
    domain?: string;
    universe_id?: string;
    target_id?: string;
    slug: string;
    name: string;
    tier_content: TierContent;
    analyst_config?: { perspective: string; default_weight: number };
  }): Promise<PredictionContext>;

  /**
   * Update an existing context by ID.
   */
  async update(
    id: string,
    updates: Partial<Pick<PredictionContext, 'name' | 'tier_content' | 'analyst_config' | 'is_active'>>
  ): Promise<PredictionContext>;

  /**
   * Delete a context by ID.
   */
  async delete(id: string): Promise<void>;

  /**
   * Get context hierarchy for the tree navigator.
   * Returns nested structure with context counts by type at each scope.
   */
  async getHierarchy(orgSlug: string): Promise<ContextHierarchyNode[]>;
}
```

### 8.4 Response Flow

The complete request/response flow for a dashboard call:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend Service                                                             │
│                                                                              │
│  predictionContextService.listContexts({ scopeLevel: 'domain' })            │
│                                           │                                  │
│                                           ▼                                  │
│  POST /agent-to-agent/{org}/prediction-runner/tasks                         │
│  {                                                                           │
│    "jsonrpc": "2.0",                                                         │
│    "id": "uuid",                                                             │
│    "method": "dashboard.contexts.list",                                      │
│    "params": {                                                               │
│      "mode": "dashboard",                                                    │
│      "payload": {                                                            │
│        "action": "contexts.list",                                            │
│        "filters": { "scopeLevel": "domain" }                                 │
│      },                                                                      │
│      "context": { "orgSlug": "...", "userId": "..." }                        │
│    }                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API: A2A Controller                                                          │
│                                                                              │
│  Checks mode === 'dashboard' → routes to PredictionDashboardRouter           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PredictionDashboardRouter                                                    │
│                                                                              │
│  parseAction('contexts.list') → { entity: 'contexts', operation: 'list' }    │
│  routeToHandler('contexts', 'list', payload, context)                        │
│    → contextHandler.execute('list', payload, context)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ContextHandler                                                               │
│                                                                              │
│  switch(action.toLowerCase()) {                                              │
│    case 'list': return handleList(...)                                       │
│  }                                                                           │
│                                                                              │
│  Returns: DashboardActionResult                                              │
│  {                                                                           │
│    success: true,                                                            │
│    data: [ ...contexts ],                                                    │
│    metadata: { totalCount: 42, page: 1, pageSize: 20, hasMore: true }        │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PredictionDashboardRouter.buildResponse()                                    │
│                                                                              │
│  {                                                                           │
│    success: true,                                                            │
│    content: [ ...contexts ],     ← Note: 'data' becomes 'content'            │
│    metadata: { ... }                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ JSON-RPC Response                                                            │
│                                                                              │
│  {                                                                           │
│    "jsonrpc": "2.0",                                                         │
│    "id": "uuid",                                                             │
│    "result": {                                                               │
│      "success": true,                                                        │
│      "content": [ ...contexts ],                                             │
│      "metadata": { "totalCount": 42, "page": 1, ... }                        │
│    }                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend Service (response handling)                                         │
│                                                                              │
│  return {                                                                    │
│    content: data.result.content,                                             │
│    metadata: data.result.metadata                                            │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema Changes

### 9.1 New Unified Contexts Table

```sql
-- =====================================================================================
-- UNIFIED CONTEXTS TABLE
-- =====================================================================================
-- Purpose: Single table for all context types at all scope levels with tier-specific content
-- Replaces: prediction.analysts (migrate data)
-- =====================================================================================

CREATE TABLE prediction.contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization ownership (required for RLS)
  organization_slug TEXT NOT NULL,

  -- What kind of context is this?
  context_type TEXT NOT NULL CHECK (context_type IN (
    'signal', 'predictor', 'prediction', 'evaluation', 'learning', 'analyst'
  )),

  -- Where does it live in the hierarchy?
  scope_level TEXT NOT NULL CHECK (scope_level IN (
    'runner', 'domain', 'universe', 'target'
  )),

  -- Scope identifiers (progressively more specific)
  domain TEXT,                 -- NULL for runner, required for domain+
  universe_id UUID REFERENCES prediction.universes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES prediction.targets(id) ON DELETE CASCADE,

  -- Identity
  slug TEXT NOT NULL,
  name TEXT NOT NULL,

  -- Tier-specific content
  tier_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "gold": "Detailed instructions for capable models...",
  --   "silver": "Balanced instructions for mid-tier models...",
  --   "bronze": "Simple, structured instructions for fast models...",
  --   "default": "Fallback if tier not specified..."
  -- }

  -- Analyst-specific config (NULL for other context types)
  analyst_config JSONB DEFAULT NULL,
  -- Structure: {
  --   "perspective": "What this analyst focuses on",
  --   "default_weight": 1.0
  -- }

  -- Source tracking
  source_type TEXT DEFAULT 'human' CHECK (source_type IN (
    'human', 'learning_approved', 'system'
  )),
  source_learning_id UUID REFERENCES prediction.learnings(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (scope_level = 'runner' OR domain IS NOT NULL),
  CHECK (scope_level IN ('runner', 'domain') OR universe_id IS NOT NULL),
  CHECK (scope_level != 'target' OR target_id IS NOT NULL),
  CHECK (context_type != 'analyst' OR analyst_config IS NOT NULL),

  -- Unique per org, scope, and type
  UNIQUE (organization_slug, slug, context_type, scope_level, domain, universe_id, target_id)
);

-- Indexes
CREATE INDEX idx_contexts_org ON prediction.contexts(organization_slug);
CREATE INDEX idx_contexts_type_scope ON prediction.contexts(context_type, scope_level);
CREATE INDEX idx_contexts_domain ON prediction.contexts(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_contexts_universe ON prediction.contexts(universe_id) WHERE universe_id IS NOT NULL;
CREATE INDEX idx_contexts_target ON prediction.contexts(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_contexts_active ON prediction.contexts(is_active) WHERE is_active = true;
CREATE INDEX idx_contexts_source ON prediction.contexts(source_learning_id) WHERE source_learning_id IS NOT NULL;
CREATE INDEX idx_contexts_tier_content ON prediction.contexts USING GIN(tier_content);

-- Trigger
CREATE TRIGGER set_contexts_updated_at
  BEFORE UPDATE ON prediction.contexts
  FOR EACH ROW
  EXECUTE FUNCTION prediction.set_updated_at();

-- Comments
COMMENT ON TABLE prediction.contexts IS 'Unified context storage for all types at all scope levels';
COMMENT ON COLUMN prediction.contexts.context_type IS 'Type: signal, predictor, prediction, evaluation, learning, analyst';
COMMENT ON COLUMN prediction.contexts.scope_level IS 'Scope hierarchy: runner (global) -> domain -> universe -> target';
COMMENT ON COLUMN prediction.contexts.tier_content IS 'Tier-specific content: { gold, silver, bronze, default }';
COMMENT ON COLUMN prediction.contexts.analyst_config IS 'Analyst-specific: { perspective, default_weight }';
```

### 9.2 Helper Function: Get Effective Contexts

```sql
CREATE OR REPLACE FUNCTION prediction.get_effective_contexts(
  p_target_id UUID,
  p_context_type TEXT,
  p_tier TEXT DEFAULT 'silver'
)
RETURNS TABLE (
  context_id UUID,
  slug TEXT,
  name TEXT,
  content TEXT,
  analyst_config JSONB,
  scope_level TEXT,
  source_scope_name TEXT
) AS $$
DECLARE
  v_target RECORD;
BEGIN
  -- Get target info
  SELECT t.id, t.universe_id, t.symbol, u.domain, u.name as universe_name
  INTO v_target
  FROM prediction.targets t
  JOIN prediction.universes u ON t.universe_id = u.id
  WHERE t.id = p_target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target not found: %', p_target_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS context_id,
    c.slug,
    c.name,
    -- Get tier-specific content with fallback chain
    COALESCE(
      c.tier_content->>p_tier,
      c.tier_content->>'default',
      c.tier_content->>'silver'
    ) AS content,
    c.analyst_config,
    c.scope_level,
    -- Provide source scope name for UI
    CASE c.scope_level
      WHEN 'runner' THEN 'Global'
      WHEN 'domain' THEN c.domain
      WHEN 'universe' THEN v_target.universe_name
      WHEN 'target' THEN v_target.symbol
    END AS source_scope_name
  FROM prediction.contexts c
  WHERE c.context_type = p_context_type
    AND c.is_active = true
    AND (
      c.scope_level = 'runner'
      OR (c.scope_level = 'domain' AND c.domain = v_target.domain)
      OR (c.scope_level = 'universe' AND c.universe_id = v_target.universe_id)
      OR (c.scope_level = 'target' AND c.target_id = p_target_id)
    )
  ORDER BY
    CASE c.scope_level
      WHEN 'runner' THEN 1
      WHEN 'domain' THEN 2
      WHEN 'universe' THEN 3
      WHEN 'target' THEN 4
    END,
    c.created_at;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 9.3 Migration Script

```sql
-- Migrate existing analysts to contexts table
-- NOTE: Only migrate fields that exist in the current analysts table schema
-- NOTE: organization_slug is derived from the related universe

INSERT INTO prediction.contexts (
  organization_slug,
  context_type,
  scope_level,
  domain,
  universe_id,
  target_id,
  slug,
  name,
  tier_content,
  analyst_config,
  source_type,
  is_active,
  created_at,
  updated_at
)
SELECT
  -- Get organization_slug from universe
  -- IMPORTANT: Fail fast if organization cannot be determined
  CASE
    WHEN u.organization_slug IS NOT NULL THEN u.organization_slug
    WHEN a.organization_slug IS NOT NULL THEN a.organization_slug
    ELSE (SELECT 1/0)  -- Force error if no org - we require explicit organization
  END AS organization_slug,
  'analyst' AS context_type,
  a.scope_level,
  a.domain,
  a.universe_id,
  a.target_id,
  a.slug,
  a.name,
  -- Convert tier_instructions to tier_content
  COALESCE(a.tier_instructions, '{}'::jsonb) AS tier_content,
  -- Build analyst_config from analyst-specific fields
  jsonb_build_object(
    'perspective', a.perspective,
    'default_weight', COALESCE(a.default_weight, 1.0)
  ) AS analyst_config,
  'system' AS source_type,
  COALESCE(a.is_enabled, true) AS is_active,
  a.created_at,
  COALESCE(a.updated_at, a.created_at)
FROM prediction.analysts a
LEFT JOIN prediction.universes u ON a.universe_id = u.id;

-- Verify migration before proceeding
-- SELECT COUNT(*) FROM prediction.contexts WHERE context_type = 'analyst';
-- SELECT COUNT(*) FROM prediction.analysts;

-- After verification, create a backup and then drop old table
-- CREATE TABLE prediction.analysts_backup AS SELECT * FROM prediction.analysts;
-- DROP TABLE prediction.analysts;
```

### 9.4 Update Learning Queue Table

Add fields for context type selection:

```sql
ALTER TABLE prediction.learning_queue
ADD COLUMN suggested_context_type TEXT DEFAULT 'learning'
  CHECK (suggested_context_type IN ('signal', 'predictor', 'prediction', 'evaluation', 'learning', 'analyst')),
ADD COLUMN suggested_tier_content JSONB DEFAULT '{}'::jsonb,
ADD COLUMN final_context_type TEXT
  CHECK (final_context_type IN ('signal', 'predictor', 'prediction', 'evaluation', 'learning', 'analyst')),
ADD COLUMN created_context_id UUID REFERENCES prediction.contexts(id) ON DELETE SET NULL;
```

---

## 10. Component Architecture

### 10.1 New Component Tree

```
apps/web/src/components/AgentPanes/Prediction/
├── PredictionAgentPane.vue (ENHANCED - domain-aware, sidebar layout)
├── DomainHeader.vue (NEW)
│
├── contexts/
│   ├── ContextNavigator.vue (NEW - tree sidebar)
│   ├── ContextList.vue (NEW - list/grid view)
│   ├── ContextCard.vue (NEW)
│   ├── ContextEditor.vue (NEW - full editor)
│   ├── TierContentEditor.vue (NEW - gold/silver/bronze tabs)
│   ├── InheritanceView.vue (NEW)
│   ├── AddContextDialog.vue (NEW)
│   └── ScopeBreadcrumb.vue (NEW)
│
├── review/
│   ├── ReviewQueue.vue (NEW)
│   ├── ReviewCard.vue (NEW)
│   ├── ApproveContextDialog.vue (NEW)
│   └── RejectDialog.vue (NEW)
│
├── universes/
│   ├── UniverseManager.vue (NEW)
│   ├── UniverseCard.vue (NEW)
│   └── CreateUniverseDialog.vue (NEW)
│
├── targets/
│   ├── TargetManager.vue (NEW)
│   └── TargetCard.vue (NEW)
│
├── shared/
│   ├── ScopeBadge.vue (NEW)
│   ├── TypeBadge.vue (NEW)
│   ├── TierIndicator.vue (NEW)
│   ├── DomainIcon.vue (NEW)
│   ├── ConfidenceBar.vue (EXISTS)
│   └── ...existing shared components
│
├── CurrentStateComponent.vue (ENHANCE with domain context)
├── HistoryComponent.vue (ENHANCE with scope filtering)
├── ToolsComponent.vue (KEEP)
├── ConfigComponent.vue (SIMPLIFY - move contexts to new UI)
├── LearningComponent.vue (SIMPLIFY - integrate with review queue)
└── InstrumentsComponent.vue (DEPRECATE - replace with TargetManager)
```

### 10.2 Updated Tab Structure

```typescript
const tabs = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'contexts', label: 'Contexts', icon: 'layers' },
  { id: 'review', label: 'Review Queue', icon: 'inbox', badge: pendingQueueCount },
  { id: 'universes', label: 'Universes', icon: 'folder' },
  { id: 'history', label: 'History', icon: 'clock' },
  { id: 'tools', label: 'Tools', icon: 'wrench' },
  { id: 'config', label: 'Config', icon: 'cog' },
];
```

---

## 11. Implementation Phases

### Phase 0: Database Schema (3 days)
**Priority: Critical - Must be done first**

- [ ] Create `prediction.contexts` table
- [ ] Create `get_effective_contexts` function
- [ ] Add columns to `prediction.learning_queue`
- [ ] Write migration script for existing analysts
- [ ] Test migration on staging

### Phase 1: Domain Awareness (1 week)
**Priority: High**

- [ ] Add DomainHeader component with theming
- [ ] Add domain prop to PredictionAgentPane
- [ ] Update AgentDashboardView to pass domain
- [ ] Add domain-specific styling variables
- [ ] Create DomainIcon shared component

### Phase 2: Context Navigator & List (1.5 weeks)
**Priority: High**

- [ ] Create ContextNavigator tree component
- [ ] Create ContextList grid/table view
- [ ] Create ContextCard component
- [ ] Create ScopeBadge and TypeBadge
- [ ] Add A2A endpoints for context listing
- [ ] Create dashboardService (A2A)

### Phase 3: Context Editor (1.5 weeks)
**Priority: High**

- [ ] Create ContextEditor full form
- [ ] Create TierContentEditor with tabs
- [ ] Add auto-simplify feature (optional)
- [ ] Add A2A endpoints for CRUD
- [ ] Create AddContextDialog

### Phase 4: HITL Review Queue (1 week)
**Priority: Critical**

- [ ] Create ReviewQueue component
- [ ] Create ReviewCard component
- [ ] Create ApproveContextDialog
- [ ] Add A2A endpoints for approve/reject
- [ ] Add notification badge

### Phase 5: Inheritance Visualization (0.5 weeks)
**Priority: Medium**

- [ ] Create InheritanceView component
- [ ] Add tier selector
- [ ] Add A2A endpoint for effective contexts

### Phase 6: Universe & Target Management (1 week)
**Priority: Medium**

- [ ] Create UniverseManager component
- [ ] Create TargetManager component
- [ ] Migrate from InstrumentsComponent
- [ ] Add A2A endpoints

### Phase 7: Polish & Migration (1 week)
**Priority: Medium**

- [ ] Remove deprecated components
- [ ] Remove REST service files
- [ ] Add loading states everywhere
- [ ] Add error boundaries
- [ ] Write E2E tests

---

## 12. Design Specifications

### 12.1 Color System

```scss
// Domain colors
$domain-stocks: #3B82F6;    // Blue
$domain-crypto: #F59E0B;    // Orange
$domain-elections: #EF4444; // Red
$domain-polymarket: #8B5CF6; // Purple

// Scope colors
$scope-runner: #6B7280;     // Gray
$scope-domain: #10B981;     // Green
$scope-universe: #3B82F6;   // Blue
$scope-target: #8B5CF6;     // Purple

// Tier colors
$tier-gold: #F59E0B;        // Gold
$tier-silver: #9CA3AF;      // Silver
$tier-bronze: #D97706;      // Bronze

// Context type colors
$type-signal: #EF4444;      // Red
$type-predictor: #3B82F6;   // Blue
$type-prediction: #8B5CF6;  // Purple
$type-evaluation: #10B981;  // Green
$type-learning: #F59E0B;    // Orange
$type-analyst: #EC4899;     // Pink
```

### 12.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Domain Header (with domain theming & scope breadcrumb)          │
├─────────────────────────────────────────────────────────────────┤
│ Lifecycle Controls & Status Summary                              │
├────────────────┬────────────────────────────────────────────────┤
│ Context        │ Tabs: Overview | Contexts | Review | ...       │
│ Navigator      ├────────────────────────────────────────────────┤
│ (Tree Sidebar) │                                                 │
│                │ ┌──────────────────────────────────────────┐   │
│ [Runner]       │ │ Main Content Area                        │   │
│ [Stocks]       │ │                                           │   │
│   [Universe]   │ │ Context Type Tabs                        │   │
│     [AAPL]     │ │ [signal] [predictor] [analyst] ...       │   │
│     [TSLA]     │ │                                           │   │
│ [Crypto]       │ │ Context Cards Grid                       │   │
│   ...          │ │                                           │   │
│                │ └──────────────────────────────────────────┘   │
└────────────────┴────────────────────────────────────────────────┘
```

---

## 13. API Requirements

### 13.1 New A2A Methods

| Method | Purpose |
|--------|---------|
| `dashboard.contexts.getHierarchy` | Get full tree with counts |
| `dashboard.contexts.list` | List contexts by scope/type |
| `dashboard.contexts.getEffective` | Get effective contexts for target |
| `dashboard.contexts.create` | Create context |
| `dashboard.contexts.update` | Update context |
| `dashboard.contexts.delete` | Delete context |
| `dashboard.learning-queue.list` | List pending reviews |
| `dashboard.learning-queue.approveAsContext` | Approve and create context |
| `dashboard.learning-queue.reject` | Reject with reason |
| `dashboard.universes.list` | List universes by domain |
| `dashboard.universes.create` | Create universe |
| `dashboard.targets.list` | List targets by universe |
| `dashboard.targets.add` | Add target |

---

## 14. Success Metrics

### 14.1 User Metrics

| Metric | Target |
|--------|--------|
| Time to create context | <3 minutes |
| Time to review HITL item | <2 minutes |
| Time to find existing context | <30 seconds |
| Contexts created per target | >3 average |

### 14.2 Technical Metrics

| Metric | Target |
|--------|--------|
| Initial load time | <2 seconds |
| A2A response time | <500ms |
| Zero REST calls | 100% A2A |

### 14.3 Business Metrics

| Metric | Target |
|--------|--------|
| HITL review completion | >80% of queue |
| Tier coverage | >50% of contexts have all 3 tiers |
| Target customization | >30% of targets have local contexts |

---

## Appendix A: Migration Checklist

### Tables to Create
- [ ] `prediction.contexts`

### Tables to Modify
- [ ] `prediction.learning_queue` (add context type fields)

### Tables to Deprecate (after migration)
- [ ] `prediction.analysts` (migrate to contexts)
- [ ] `prediction.analyst_overrides` (rethink override pattern)

### Files to Deprecate
- [ ] `predictionLearningService.ts` (replace with A2A)
- [ ] `InstrumentsComponent.vue` (replace with TargetManager)

### Files to Create
- 20+ new Vue components (see Section 10.1)
- 1 new A2A service (`predictionDashboardA2AService.ts`)
- 1 new A2A handler (`dashboard-context.handler.ts`)

---

## Appendix B: Context Type Descriptions

### Signal Context
**Purpose:** Help identify and evaluate incoming signals

**Examples:**
- "Supply chain leaks from Asia manufacturing partners are historically reliable"
- "Ignore analyst price target changes - they follow rather than lead"
- "High options volume with IV spike indicates potential move"

### Predictor Context
**Purpose:** Help assess and weight predictors (validated signals)

**Examples:**
- "Weight iPhone cycle signals higher during H2"
- "Require 2+ confirming signals before promoting to predictor"
- "Technical signals less reliable during earnings week"

### Prediction Context
**Purpose:** Help make final prediction decisions

**Examples:**
- "Post-earnings reactions often reverse within 48 hours"
- "Consider holding period - short-term noise vs long-term trend"
- "This target has high reversal rate after initial moves"

### Evaluation Context
**Purpose:** Help evaluate prediction outcomes

**Examples:**
- "Consider Services revenue as secondary success metric"
- "Partial success if direction correct but magnitude wrong"
- "Evaluate against sector performance, not just absolute"

### Learning Context
**Purpose:** Guide the learning process

**Examples:**
- "Track analyst accuracy separately by market conditions"
- "Weight recent outcomes higher than older ones"
- "Flag patterns that worked in bull market but not bear"

### Analyst Context
**Purpose:** Define AI analyst personas

**Examples:**
- Technical Tina: Focuses on chart patterns, support/resistance, volume
- Sentiment Sam: Focuses on social sentiment, news tone, market mood
- Fundamental Frank: Focuses on financials, valuations, growth metrics

---

## Appendix C: TypeScript Interface Definitions

### C.1 Core Context Types

```typescript
// packages/transport-types/src/prediction/context.types.ts

/**
 * Context type enum - single source of truth
 */
export const ContextType = {
  SIGNAL: 'signal',
  PREDICTOR: 'predictor',
  PREDICTION: 'prediction',
  EVALUATION: 'evaluation',
  LEARNING: 'learning',
  ANALYST: 'analyst',
} as const;

export type ContextType = (typeof ContextType)[keyof typeof ContextType];

/**
 * Scope level enum - single source of truth
 */
export const ScopeLevel = {
  RUNNER: 'runner',
  DOMAIN: 'domain',
  UNIVERSE: 'universe',
  TARGET: 'target',
} as const;

export type ScopeLevel = (typeof ScopeLevel)[keyof typeof ScopeLevel];

/**
 * LLM tier enum
 */
export const LlmTier = {
  GOLD: 'gold',
  SILVER: 'silver',
  BRONZE: 'bronze',
} as const;

export type LlmTier = (typeof LlmTier)[keyof typeof LlmTier];

/**
 * Tier-specific content structure
 *
 * Fallback chain: requested tier → default → silver
 * At least one field should be populated.
 */
export interface TierContent {
  gold?: string;
  silver?: string;
  bronze?: string;
  default?: string;  // Used when requested tier is not available
}

/**
 * Analyst-specific configuration (only for context_type = 'analyst')
 */
export interface AnalystConfig {
  perspective: string;
  default_weight: number;
}

/**
 * Context entity - unified context model
 */
export interface PredictionContext {
  id: string;
  context_type: ContextType;
  scope_level: ScopeLevel;
  domain?: string | null;
  universe_id?: string | null;
  target_id?: string | null;
  slug: string;
  name: string;
  tier_content: TierContent;
  analyst_config?: AnalystConfig | null;
  source_type: 'human' | 'learning_approved' | 'system';
  source_learning_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Effective context - context with resolved tier content
 */
export interface EffectiveContext {
  context_id: string;
  slug: string;
  name: string;
  content: string;  // Resolved tier content
  analyst_config?: AnalystConfig | null;
  scope_level: ScopeLevel;
  source_scope_name: string;
}
```

### C.2 Dashboard Request/Response Types

```typescript
// packages/transport-types/src/prediction/dashboard.types.ts

/**
 * Context list filters
 */
export interface ContextListFilters {
  scopeLevel?: ScopeLevel;
  scopeId?: string;
  contextType?: ContextType;
  domain?: string;
  universeId?: string;
  targetId?: string;
  isActive?: boolean;
}

/**
 * Context create params
 */
export interface ContextCreateParams {
  context_type: ContextType;
  scope_level: ScopeLevel;
  domain?: string;
  universe_id?: string;
  target_id?: string;
  slug: string;
  name: string;
  tier_content: TierContent;
  analyst_config?: AnalystConfig;
}

/**
 * Context update params
 */
export interface ContextUpdateParams {
  id: string;
  name?: string;
  tier_content?: TierContent;
  analyst_config?: AnalystConfig;
  is_active?: boolean;
}

/**
 * Get effective contexts params
 */
export interface GetEffectiveContextsParams {
  targetId: string;
  contextType: ContextType;
  tier?: LlmTier;
}

/**
 * Context hierarchy node for tree display
 */
export interface ContextHierarchyNode {
  scope_level: ScopeLevel;
  scope_id: string | null;
  scope_name: string;
  context_counts: Record<ContextType, number>;
  children?: ContextHierarchyNode[];
}
```

### C.3 Vue Component Props

```typescript
// apps/web/src/types/prediction-context.ts

import type { PredictionContext, ContextType, ScopeLevel, TierContent } from '@orchestrator-ai/transport-types';

/**
 * Props for ContextCard component
 */
export interface ContextCardProps {
  context: PredictionContext;
  isInherited: boolean;
  currentScopeLevel: ScopeLevel;
}

/**
 * Props for TierContentEditor component
 */
export interface TierContentEditorProps {
  gold: string;
  silver: string;
  bronze: string;
  contextType: ContextType;
}

/**
 * Emits for TierContentEditor component
 */
export interface TierContentEditorEmits {
  'update:gold': [value: string];
  'update:silver': [value: string];
  'update:bronze': [value: string];
}

/**
 * Props for ContextEditor component
 */
export interface ContextEditorProps {
  context: Partial<PredictionContext>;
  isNew: boolean;
  scope: {
    level: ScopeLevel;
    domain?: string;
    universeId?: string;
    targetId?: string;
  };
}
```

---

## Appendix D: Error Handling Specifications

### D.1 Error Code Registry

All A2A dashboard errors use standardized codes:

| Code | HTTP Equiv | Description |
|------|------------|-------------|
| `INVALID_ACTION` | 400 | Action format invalid (not `entity.operation`) |
| `UNSUPPORTED_ACTION` | 400 | Entity doesn't support this operation |
| `UNKNOWN_ENTITY` | 400 | Entity name not recognized |
| `MISSING_PARAMS` | 400 | Required parameters not provided |
| `INVALID_PARAMS` | 400 | Parameter values invalid |
| `NOT_FOUND` | 404 | Requested resource doesn't exist |
| `DUPLICATE_SLUG` | 409 | Context with same slug already exists at scope |
| `SCOPE_CONFLICT` | 409 | Invalid scope hierarchy (e.g., target without universe) |
| `UNAUTHORIZED` | 401 | User not authenticated |
| `FORBIDDEN` | 403 | User lacks permission for operation |
| `HANDLER_ERROR` | 500 | Unexpected error in handler |
| `DATABASE_ERROR` | 500 | Database operation failed |

### D.2 Error Response Structure

```typescript
interface DashboardErrorResponse {
  success: false;
  error: {
    code: string;           // From error code registry
    message: string;        // Human-readable message
    details?: {
      field?: string;       // Which field caused the error
      expected?: unknown;   // What was expected
      received?: unknown;   // What was received
      supportedActions?: string[];  // For UNSUPPORTED_ACTION
      supportedEntities?: string[]; // For UNKNOWN_ENTITY
    };
  };
}
```

### D.3 Frontend Error Handling

```typescript
// apps/web/src/services/predictionDashboardService.ts

class PredictionDashboardService {
  private async executeDashboardRequest<T>(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<DashboardResponsePayload<T>> {
    try {
      const response = await fetch(endpoint, { ... });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new DashboardError(
          errorData?.error?.code || 'NETWORK_ERROR',
          errorData?.error?.message || response.statusText,
          errorData?.error?.details
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new DashboardError(
          data.error.code || 'UNKNOWN_ERROR',
          data.error.message || 'Dashboard request failed',
          data.error.details
        );
      }

      return data.result?.payload || data.result || { content: null };
    } catch (error) {
      if (error instanceof DashboardError) {
        throw error;
      }
      throw new DashboardError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }
}

/**
 * Custom error class for dashboard operations
 */
export class DashboardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DashboardError';
  }

  isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }

  isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'FORBIDDEN';
  }

  isValidation(): boolean {
    return ['MISSING_PARAMS', 'INVALID_PARAMS', 'SCOPE_CONFLICT'].includes(this.code);
  }
}
```

### D.4 Vue Component Error Handling

```vue
<!-- Example error handling in ContextList.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { DashboardError } from '@/services/predictionDashboardService';

const error = ref<{ code: string; message: string } | null>(null);
const isLoading = ref(false);

async function loadContexts() {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await dashboardService.listContexts(filters);
    contexts.value = response.content || [];
  } catch (e) {
    if (e instanceof DashboardError) {
      error.value = { code: e.code, message: e.message };

      // Handle specific errors
      if (e.isUnauthorized()) {
        router.push('/login');
      }
    } else {
      error.value = { code: 'UNKNOWN', message: 'An unexpected error occurred' };
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="context-list">
    <div v-if="error" class="error-banner" :class="`error-${error.code}`">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{{ error.message }}</span>
      <button @click="loadContexts">Retry</button>
    </div>
    <!-- ... -->
  </div>
</template>
```

---

## Appendix E: Row-Level Security (RLS) Policies

### E.1 Organization-Based Access Control

All context operations are scoped to the user's organization. The `organization_slug` column is included in the `prediction.contexts` table (see Section 9.1).

```sql
-- Enable RLS on contexts table
ALTER TABLE prediction.contexts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see contexts in their organization
CREATE POLICY contexts_org_select ON prediction.contexts
  FOR SELECT
  USING (
    organization_slug = current_setting('app.current_org_slug', true)
  );

-- Policy: Users can only insert contexts in their organization
CREATE POLICY contexts_org_insert ON prediction.contexts
  FOR INSERT
  WITH CHECK (
    organization_slug = current_setting('app.current_org_slug', true)
  );

-- Policy: Users can only update contexts in their organization
CREATE POLICY contexts_org_update ON prediction.contexts
  FOR UPDATE
  USING (
    organization_slug = current_setting('app.current_org_slug', true)
  );

-- Policy: Users can only delete contexts in their organization
CREATE POLICY contexts_org_delete ON prediction.contexts
  FOR DELETE
  USING (
    organization_slug = current_setting('app.current_org_slug', true)
  );
```

### E.2 Alternative: Join-Based RLS Through Universes

For contexts that don't have direct org reference (legacy pattern), use joins:

```sql
-- For universe-scoped and target-scoped contexts
CREATE POLICY contexts_universe_select ON prediction.contexts
  FOR SELECT
  USING (
    -- Runner/domain level: available to all in org (handled separately)
    scope_level IN ('runner', 'domain')
    OR
    -- Universe level: check universe ownership
    (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
      WHERE organization_slug = current_setting('app.current_org_slug', true)
    ))
    OR
    -- Target level: check through universe
    (scope_level = 'target' AND target_id IN (
      SELECT t.id FROM prediction.targets t
      JOIN prediction.universes u ON t.universe_id = u.id
      WHERE u.organization_slug = current_setting('app.current_org_slug', true)
    ))
  );
```

### E.3 Admin-Only Operations

Some operations require elevated permissions:

```sql
-- Model configuration contexts (admin only)
CREATE POLICY contexts_admin_system ON prediction.contexts
  FOR ALL
  USING (
    source_type != 'system'
    OR
    current_setting('app.current_role', true) IN ('super_admin', 'org_admin')
  );
```

### E.4 Setting RLS Context in NestJS

```typescript
// apps/api/src/common/guards/rls-context.guard.ts

@Injectable()
export class RlsContextGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const executionContext: ExecutionContext = request.body?.params?.context;

    if (executionContext?.orgSlug) {
      await this.dataSource.query(
        `SELECT set_config('app.current_org_slug', $1, true)`,
        [executionContext.orgSlug]
      );
    }

    if (executionContext?.userId) {
      await this.dataSource.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [executionContext.userId]
      );
    }

    return true;
  }
}
```

---

## Appendix F: Testing Strategy

### F.1 Unit Tests (Handler Level)

```typescript
// apps/api/src/prediction-runner/task-router/handlers/context.handler.spec.ts

describe('ContextHandler', () => {
  let handler: ContextHandler;
  let contextService: jest.Mocked<ContextService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContextHandler,
        { provide: ContextService, useValue: createMockContextService() },
      ],
    }).compile();

    handler = module.get(ContextHandler);
    contextService = module.get(ContextService);
  });

  describe('execute - list', () => {
    it('should return contexts filtered by scope', async () => {
      const mockContexts = [createMockContext()];
      contextService.findByScope.mockResolvedValue({ items: mockContexts, total: 1 });

      const result = await handler.execute(
        'list',
        { filters: { scopeLevel: 'domain', domain: 'stocks' } },
        createMockExecutionContext()
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContexts);
    });

    it('should return error for invalid scope level', async () => {
      const result = await handler.execute(
        'list',
        { filters: { scopeLevel: 'invalid' } },
        createMockExecutionContext()
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('execute - getEffective', () => {
    it('should return effective contexts with tier content resolved', async () => {
      const mockEffective = [createMockEffectiveContext()];
      contextService.getEffectiveForTarget.mockResolvedValue(mockEffective);

      const result = await handler.execute(
        'getEffective',
        { params: { targetId: 'uuid', contextType: 'signal', tier: 'gold' } },
        createMockExecutionContext()
      );

      expect(result.success).toBe(true);
      expect(contextService.getEffectiveForTarget).toHaveBeenCalledWith(
        'uuid', 'signal', 'gold'
      );
    });
  });
});
```

### F.2 Integration Tests (API Level)

```typescript
// apps/api/test/prediction-dashboard.e2e-spec.ts

describe('Prediction Dashboard A2A (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  describe('POST /agent-to-agent/:org/prediction-runner/tasks (dashboard mode)', () => {
    it('should list contexts by scope', async () => {
      const response = await request(app.getHttpServer())
        .post('/agent-to-agent/test-org/prediction-runner/tasks')
        .send({
          jsonrpc: '2.0',
          id: 'test-1',
          method: 'dashboard.contexts.list',
          params: {
            mode: 'dashboard',
            payload: {
              action: 'contexts.list',
              filters: { scopeLevel: 'runner' },
            },
            context: { orgSlug: 'test-org', userId: 'test-user' },
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(Array.isArray(response.body.result.content)).toBe(true);
    });

    it('should create a new context', async () => {
      const response = await request(app.getHttpServer())
        .post('/agent-to-agent/test-org/prediction-runner/tasks')
        .send({
          jsonrpc: '2.0',
          id: 'test-2',
          method: 'dashboard.contexts.create',
          params: {
            mode: 'dashboard',
            payload: {
              action: 'contexts.create',
              params: {
                context_type: 'signal',
                scope_level: 'domain',
                domain: 'stocks',
                slug: 'test-signal-context',
                name: 'Test Signal Context',
                tier_content: {
                  gold: 'Detailed instructions...',
                  silver: 'Standard instructions...',
                  bronze: 'Simple check list...',
                },
              },
            },
            context: { orgSlug: 'test-org', userId: 'test-user' },
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(response.body.result.content.slug).toBe('test-signal-context');
    });
  });
});
```

### F.3 Component Tests (Vue)

```typescript
// apps/web/src/components/AgentPanes/Prediction/contexts/ContextCard.spec.ts

import { mount } from '@vue/test-utils';
import ContextCard from './ContextCard.vue';

describe('ContextCard', () => {
  const mockContext = {
    id: '1',
    context_type: 'signal',
    scope_level: 'domain',
    domain: 'stocks',
    slug: 'test-context',
    name: 'Test Context',
    tier_content: { gold: 'content', silver: 'content', bronze: 'content' },
    is_active: true,
  };

  it('renders context name and type', () => {
    const wrapper = mount(ContextCard, {
      props: { context: mockContext, isInherited: false },
    });

    expect(wrapper.text()).toContain('Test Context');
    expect(wrapper.find('.type-badge').text()).toContain('signal');
  });

  it('shows inherited badge when inherited', () => {
    const wrapper = mount(ContextCard, {
      props: { context: mockContext, isInherited: true },
    });

    expect(wrapper.find('.inherited-badge').exists()).toBe(true);
  });

  it('shows tier indicators for filled tiers', () => {
    const wrapper = mount(ContextCard, {
      props: { context: mockContext, isInherited: false },
    });

    const tierDots = wrapper.findAll('.tier-dot.filled');
    expect(tierDots.length).toBe(3);
  });

  it('emits edit event when edit button clicked', async () => {
    const wrapper = mount(ContextCard, {
      props: { context: mockContext, isInherited: false },
    });

    await wrapper.find('button.edit-btn').trigger('click');
    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')![0]).toEqual([mockContext]);
  });
});
```

### F.4 E2E Tests (Cypress)

```typescript
// apps/web/cypress/e2e/prediction-contexts.cy.ts

describe('Prediction Context Management', () => {
  beforeEach(() => {
    cy.login('test-user');
    cy.visit('/dashboard/prediction-runner');
  });

  it('should navigate context hierarchy', () => {
    // Expand Runner node
    cy.get('[data-test="tree-node-runner"]').click();
    cy.get('[data-test="context-type-signal"]').should('be.visible');

    // Click on Stocks domain
    cy.get('[data-test="tree-node-domain-stocks"]').click();
    cy.get('[data-test="scope-badge"]').should('contain', 'domain');
  });

  it('should create a new context', () => {
    cy.get('[data-test="add-context-btn"]').click();
    cy.get('[data-test="context-type-select"]').select('signal');
    cy.get('[data-test="context-name"]').type('Test Signal Context');
    cy.get('[data-test="context-slug"]').type('test-signal');

    // Fill tier content
    cy.get('[data-test="tier-tab-gold"]').click();
    cy.get('[data-test="tier-content-textarea"]').type('Gold tier instructions');

    cy.get('[data-test="save-context-btn"]').click();
    cy.get('[data-test="context-card"]').should('contain', 'Test Signal Context');
  });

  it('should show effective contexts for target', () => {
    cy.get('[data-test="tree-node-target-AAPL"]').click();
    cy.get('[data-test="inheritance-view-btn"]').click();

    // Should show contexts from all levels
    cy.get('[data-test="inherited-context"]').should('have.length.at.least', 1);
    cy.get('[data-test="scope-badge-runner"]').should('exist');
    cy.get('[data-test="scope-badge-domain"]').should('exist');
  });
});
```

### F.5 Test Coverage Requirements

| Category | Minimum Coverage |
|----------|-----------------|
| Handler unit tests | 90% |
| Service unit tests | 85% |
| Vue component tests | 80% |
| E2E critical paths | 100% |

---

## Appendix G: Agent-Domain Relationship

### G.1 How Agents Connect to Domains

The prediction-runner agent can operate across multiple domains. The domain relationship is established through universes:

```
prediction-runner (agent)
├── stocks domain
│   └── My Stock Portfolio (universe)
│       ├── AAPL (target)
│       └── TSLA (target)
├── crypto domain
│   └── Crypto Holdings (universe)
│       └── BTC-USD (target)
└── polymarket domain
    └── Election Markets (universe)
        └── presidential-2024 (target)
```

### G.2 Agent Configuration

The agent's configuration specifies which domains it supports:

```typescript
interface PredictionAgentConfig {
  agentSlug: string;          // 'prediction-runner'
  supportedDomains: string[]; // ['stocks', 'crypto', 'elections', 'polymarket']
  defaultDomain: string;      // 'stocks'
}
```

### G.3 Domain Discovery in Dashboard

When the dashboard loads, it:

1. Fetches the agent's configuration to get supported domains
2. Fetches universes grouped by domain
3. Displays domain selector in the header
4. Filters the context navigator by selected domain

```typescript
// In PredictionAgentPane.vue
async function loadDomainData() {
  const config = await dashboardService.getAgentConfig();
  supportedDomains.value = config.supportedDomains;

  const universes = await dashboardService.listUniverses();
  universesByDomain.value = groupBy(universes.content, 'domain');

  // Default to first domain with universes, or agent's default
  activeDomain.value = config.defaultDomain;
}
```

### G.4 Context Inheritance Across Domains

Runner-level contexts apply to ALL domains. Domain-level contexts only apply within that domain:

```
Runner: signal context "Check market hours" → Applies to stocks, crypto, elections
├── Stocks: signal context "Check earnings calendar" → Only applies to stocks
└── Crypto: signal context "Check 24/7 markets" → Only applies to crypto
```

---

## Appendix H: Story Deduplication Strategy

### H.1 Problem Statement

When crawling sources every 10 minutes, the system encounters duplicate or near-duplicate stories:

1. **Exact duplicates** - Same story URL seen again (already handled via content hash)
2. **Near-duplicates** - Same story with minor edits (headline tweak, added paragraph)
3. **Cross-source duplicates** - Same story from TechCrunch, Verge, and Reuters
4. **Paraphrased stories** - Different outlets covering same news with different wording

Currently, only #1 is fully handled. Stories #2-4 create duplicate signals that waste analyst cycles.

### H.2 Multi-Layer Fuzzy Deduplication Solution

#### Layer 1: Exact Hash Match (Existing ✅)

```
Story → SHA-256(normalized title + first 500 chars) → Check source_seen_items
```

- **Catches**: Exact same content from same source
- **Already implemented** in `ContentHashService.hashArticle()`

#### Layer 2: Cross-Source Hash Check (New)

```
Content hash → Check ALL sources for this target (not just current source)
```

- **Catches**: Same story from multiple news outlets
- **Implementation**: Create RPC function `check_content_hash_for_target`

```sql
CREATE OR REPLACE FUNCTION prediction.check_content_hash_for_target(
  p_content_hash TEXT,
  p_target_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM prediction.source_seen_items ssi
    JOIN prediction.sources s ON ssi.source_id = s.id
    WHERE ssi.content_hash = p_content_hash
    AND s.target_id = p_target_id
  );
$$ LANGUAGE SQL STABLE;
```

#### Layer 3: Fuzzy Title Matching (New)

```
Story title → Compare against recent signals → Jaccard similarity > 0.85
```

- **Catches**: Minor headline variations ("Apple announces AI" vs "Apple Announces New AI")
- **Implementation**: Use existing `ContentHashService.isSimilar()` on titles

```typescript
// Already exists in ContentHashService
isSimilar(content1: string, content2: string, threshold = 0.9): boolean {
  // Jaccard similarity on word sets after normalization
}
```

#### Layer 4: Key Phrase Overlap (New - Configurable)

```
Story content → Extract key phrases → Compare phrase overlap > 70%
```

- **Catches**: Paraphrased articles about same event
- **Implementation**: Use existing `ContentHashService.extractKeyPhrases()`

### H.3 Database Changes

#### New Columns on `source_seen_items`

```sql
ALTER TABLE prediction.source_seen_items ADD COLUMN IF NOT EXISTS
  title_normalized TEXT,           -- Normalized title for fuzzy matching
  key_phrases TEXT[],              -- Array of extracted key phrases
  fingerprint_hash TEXT;           -- Hash of key phrases for quick lookup
```

#### New Table: `signal_fingerprints`

```sql
CREATE TABLE prediction.signal_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES prediction.signals(id) ON DELETE CASCADE,
  target_id UUID REFERENCES prediction.targets(id),
  title_normalized TEXT NOT NULL,
  key_phrases TEXT[] NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (signal_id)
);

CREATE INDEX idx_signal_fingerprints_target ON prediction.signal_fingerprints(target_id);
CREATE INDEX idx_signal_fingerprints_hash ON prediction.signal_fingerprints(fingerprint_hash);
```

### H.4 Enhanced processItem() Flow

```typescript
private async processItem(source, item, targetId): Promise<ProcessResult> {
  const contentHash = this.contentHashService.hashArticle(item.title, item.content);

  // Layer 1: Exact hash match (existing)
  const { isNew } = await this.sourceSeenItemRepository.markSeen(source.id, contentHash, ...);
  if (!isNew) return { isNew: false, reason: 'exact_duplicate' };

  // Layer 2: Cross-source hash check (new)
  const seenInOtherSource = await this.sourceSeenItemRepository.hasBeenSeenForTarget(contentHash, targetId);
  if (seenInOtherSource) return { isNew: false, reason: 'cross_source_duplicate' };

  // Layer 3: Fuzzy title match (new)
  const normalizedTitle = this.contentHashService.normalizeContent(item.title);
  const similarSignal = await this.findSimilarByTitle(targetId, normalizedTitle, 0.85);
  if (similarSignal) return { isNew: false, reason: 'fuzzy_title_match', similarTo: similarSignal.id };

  // Layer 4: Key phrase overlap (new - optional, configurable)
  if (source.crawl_config?.fuzzy_dedup_enabled) {
    const keyPhrases = this.contentHashService.extractKeyPhrases(item.content, 15);
    const overlapMatch = await this.findByPhraseOverlap(targetId, keyPhrases, 0.7);
    if (overlapMatch) return { isNew: false, reason: 'phrase_overlap', similarTo: overlapMatch.id };
  }

  // Create signal with fingerprint
  const signal = await this.signalRepository.create(signalData);
  await this.signalFingerprintRepository.create({
    signal_id: signal.id,
    target_id: targetId,
    title_normalized: normalizedTitle,
    key_phrases: keyPhrases,
    fingerprint_hash: this.contentHashService.hash(keyPhrases.join('|')),
  });

  return { isNew: true, signalId: signal.id };
}
```

### H.5 Configuration

Add to `crawl_config` JSONB on sources:

```json
{
  "fuzzy_dedup_enabled": true,
  "title_similarity_threshold": 0.85,
  "phrase_overlap_threshold": 0.70,
  "cross_source_dedup": true
}
```

### H.6 Metrics & Observability

Track in `source_crawls` table:

```sql
ALTER TABLE prediction.source_crawls ADD COLUMN IF NOT EXISTS
  duplicates_exact INTEGER DEFAULT 0,
  duplicates_cross_source INTEGER DEFAULT 0,
  duplicates_fuzzy_title INTEGER DEFAULT 0,
  duplicates_phrase_overlap INTEGER DEFAULT 0;
```

### H.7 Implementation Phases

| Phase | What | Priority |
|-------|------|----------|
| Phase 1 | Cross-source deduplication RPC function | HIGH |
| Phase 2 | Fuzzy title matching | MEDIUM |
| Phase 3 | Key phrase overlap with fingerprints | LOW |
| Phase 4 | Learning & auto-tuning thresholds | LOW |

---

## Appendix I: Test Data Injection Framework

### I.1 Purpose

The prediction pipeline is database-driven - each tier reads from and writes to database tables. This enables a powerful testing strategy: **inject test data at any tier** to exercise downstream processing without waiting for upstream components.

### I.2 The Complete Pipeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PREDICTION LEARNING LOOP                            │
│                     (Every tier reads from database)                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   SOURCES   │───►│   SIGNALS   │───►│ PREDICTORS  │───►│ PREDICTIONS │ │
│  │  (crawled)  │    │ (detected)  │    │ (analysts)  │    │ (generated) │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│         │                  │                  │                  │        │
│    [INJECT]           [INJECT]           [INJECT]           [INJECT]      │
│                                                                  │        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │        │
│  │   MISSED    │◄───│ EVALUATIONS │◄───│  OUTCOMES   │◄─────────┘        │
│  │OPPORTUNITIES│    │  (scored)   │    │  (actual)   │                   │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                   │
│         │                  │                  │                          │
│    [INJECT]           [INJECT]           [INJECT]                        │
│         │                  │                  │                          │
│         ▼                  ▼                  ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      LEARNING QUEUE                                 │ │
│  │  (analyst improvements, strategy updates, threshold tuning)         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                               │                                          │
│                          [INJECT]                                        │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      ANALYST UPDATES                                │ │
│  │  (new prompts, adjusted weights, new strategies)                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### I.3 All Injection Points

| Want to Test | Inject Into | Then Run |
|--------------|-------------|----------|
| Source crawling | `prediction.sources` with mock config | `SourceCrawlerRunner` |
| Deduplication | `prediction.source_seen_items` | Crawl with similar content |
| Signal detection | `prediction.signals` | `SignalDetectionService` |
| Analyst behavior | `prediction.analysts` with custom prompts | Signal detection |
| Prediction generation | `prediction.predictors` | `PredictionGenerationService` |
| Outcome tracking | `prediction.predictions` with outcomes | `OutcomeTrackingService` |
| Evaluation accuracy | `prediction.predictions` + known outcomes | `EvaluationService` |
| Missed opportunity | `prediction.signals` without predictions | `MissedOpportunityService` |
| Learning loop | `prediction.learning_queue` items | `LearningService` |
| Strategy rules | `prediction.strategies` | Any tier with strategy checks |

### I.4 Database Schema: Test Data Markers

Add test data markers to ALL prediction tables:

```sql
-- Add to all prediction tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'prediction'
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('
      ALTER TABLE prediction.%I
      ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS test_scenario_id UUID
    ', tbl);
  END LOOP;
END $$;

-- Indexes for fast test data operations
CREATE INDEX IF NOT EXISTS idx_signals_test_data
  ON prediction.signals(is_test_data) WHERE is_test_data = TRUE;
CREATE INDEX IF NOT EXISTS idx_predictions_test_data
  ON prediction.predictions(is_test_data) WHERE is_test_data = TRUE;
CREATE INDEX IF NOT EXISTS idx_learning_queue_test_data
  ON prediction.learning_queue(is_test_data) WHERE is_test_data = TRUE;
```

### I.5 Test Scenarios Table

```sql
CREATE TABLE IF NOT EXISTS prediction.test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- What are we testing?
  injection_points TEXT[] NOT NULL,  -- ['signals', 'predictions', 'outcomes']

  -- Configuration
  target_id UUID REFERENCES prediction.targets(id),
  universe_id UUID REFERENCES prediction.universes(id),
  config JSONB DEFAULT '{}',

  -- Tracking
  created_by TEXT,
  status TEXT DEFAULT 'active',  -- 'active', 'running', 'completed', 'failed'

  -- Results
  results JSONB,  -- Store test outcomes

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### I.6 TestDataInjectorService

```typescript
@Injectable()
export class TestDataInjectorService {

  // ═══════════════════════════════════════════════════════════════════
  // GENERIC INJECTION - Insert into ANY prediction table
  // ═══════════════════════════════════════════════════════════════════

  async injectIntoTable<T>(tableName: string, data: T[], scenarioId: string): Promise<T[]> {
    const withTestMarkers = data.map(row => ({
      ...row,
      is_test_data: true,
      test_scenario_id: scenarioId,
    }));

    const { data: inserted, error } = await this.supabase
      .schema('prediction')
      .from(tableName)
      .insert(withTestMarkers)
      .select();

    if (error) throw new Error(`Failed to inject into ${tableName}: ${error.message}`);
    return inserted;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TIER-SPECIFIC INJECTORS
  // ═══════════════════════════════════════════════════════════════════

  async injectSignals(scenarioId: string, signals: Partial<Signal>[]): Promise<Signal[]>;
  async injectAnalysts(scenarioId: string, analysts: Partial<Analyst>[]): Promise<Analyst[]>;
  async injectPredictors(scenarioId: string, predictors: Partial<Predictor>[]): Promise<Predictor[]>;
  async injectPredictions(scenarioId: string, predictions: Partial<Prediction>[]): Promise<Prediction[]>;
  async injectOutcomes(scenarioId: string, outcomes: OutcomeData[]): Promise<void>;
  async injectMissedOpportunities(scenarioId: string, missed: Partial<MissedOpp>[]): Promise<MissedOpp[]>;
  async injectLearningItems(scenarioId: string, items: Partial<LearningItem>[]): Promise<LearningItem[]>;
  async injectStrategies(scenarioId: string, strategies: Partial<Strategy>[]): Promise<Strategy[]>;

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO RUNNERS - Execute tiers against test data
  // ═══════════════════════════════════════════════════════════════════

  async runSignalDetection(scenarioId: string): Promise<{ signalsProcessed, predictorsCreated }>;
  async runPredictionGeneration(scenarioId: string): Promise<{ predictorsProcessed, predictionsGenerated }>;
  async runEvaluation(scenarioId: string): Promise<{ evaluated, correct, incorrect, partial }>;
  async runMissedOpportunityDetection(scenarioId: string): Promise<{ analyzed, found }>;
  async runLearningProcessor(scenarioId: string): Promise<{ processed, analystsUpdated }>;

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════

  async cleanupScenario(scenarioId: string): Promise<CleanupResult>;
  async cleanupAllTestData(): Promise<CleanupResult>;
}
```

### I.7 Test Data Generator Service

```typescript
@Injectable()
export class TestDataGeneratorService {

  /** Generate realistic mock news articles */
  generateMockArticles(config: {
    count: number;
    topic: string;        // "Apple", "Bitcoin", "Fed"
    sentiment?: 'bullish' | 'bearish' | 'mixed';
  }): CrawledItem[];

  /** Generate signals with known characteristics */
  generateMockSignals(config: {
    count: number;
    targetId: string;
    distribution: { bullish: number; bearish: number; neutral: number };
  }): CreateSignalData[];

  /** Generate predictions with known outcomes for evaluation testing */
  generateMockPredictionsWithOutcomes(config: {
    count: number;
    accuracyRate: number;  // 0.0 - 1.0
  }): Array<{ prediction: CreatePredictionData; outcome: 'correct' | 'incorrect' }>;
}
```

### I.8 Example Test Scenarios

#### Test Complete Loop: Signals → Learning

```typescript
async function testCompleteLoop() {
  const scenario = await injector.createScenario({
    name: 'Full Loop Test - Fed Rate Decision',
    injectionPoints: ['signals', 'outcomes'],
  });

  // 1. Inject signals
  await injector.injectSignals(scenario.id, [
    { target_id: targetId, content: 'Fed signals rate hike pause', direction: 'bullish' },
    { target_id: targetId, content: 'Inflation remains sticky at 3.2%', direction: 'bearish' },
  ]);

  // 2. Run signal detection → creates predictors
  await injector.runSignalDetection(scenario.id);

  // 3. Run prediction generation → creates predictions
  await injector.runPredictionGeneration(scenario.id);

  // 4. Inject outcomes (simulate what actually happened)
  await injector.injectOutcomes(scenario.id, [
    { prediction_id: pred1.id, actual_direction: 'bullish' },   // Correct
    { prediction_id: pred2.id, actual_direction: 'bullish' },   // Incorrect
  ]);

  // 5. Run evaluation
  const results = await injector.runEvaluation(scenario.id);

  // 6. Run learning processor
  await injector.runLearningProcessor(scenario.id);

  // 7. Cleanup
  await injector.cleanupScenario(scenario.id);
}
```

#### Test Analyst Accuracy with Known Outcomes

```typescript
async function testAnalystAccuracy() {
  const scenario = await injector.createScenario({ name: 'Analyst Benchmark' });

  // Inject 100 predictions with known outcomes (70% accuracy)
  const testData = generator.generateMockPredictionsWithOutcomes({
    count: 100,
    accuracyRate: 0.7,
  });

  const predictions = await injector.injectPredictions(scenario.id, testData.map(d => d.prediction));

  // Inject matching outcomes
  for (let i = 0; i < predictions.length; i++) {
    await injector.injectOutcomes(scenario.id, [{
      prediction_id: predictions[i].id,
      actual_direction: testData[i].outcome === 'correct'
        ? predictions[i].direction
        : oppositeDirection(predictions[i].direction),
    }]);
  }

  // Run evaluation and verify metrics
  const results = await injector.runEvaluation(scenario.id);
  expect(results.correct).toBe(70);
  expect(results.incorrect).toBe(30);
}
```

### I.9 Dashboard: Test Lab UI

```
┌─────────────────────────────────────────────────────────────┐
│  🧪 Test Lab                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Scenarios: 3                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📋 "Fed Rate Hike Test"                             │   │
│  │    Tier: Signal Detection                           │   │
│  │    Signals: 15 injected | Predictions: 8 generated  │   │
│  │    [View Details] [Run Tier] [Cleanup]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quick Actions:                                             │
│  [+ New Scenario]  [Generate Test Articles]  [🗑️ Cleanup All]│
│                                                             │
│  Test Data Stats:                                           │
│  • Test sources: 5                                          │
│  • Test signals: 47                                         │
│  • Test predictions: 23                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### I.10 Benefits

| Benefit | Description |
|---------|-------------|
| **Tier Isolation** | Test signal detection without waiting for crawlers |
| **Reproducibility** | Same test data = same results |
| **Speed** | Skip slow upstream processes |
| **Edge Cases** | Inject specific scenarios (all bullish, mixed signals, etc.) |
| **Evaluation Testing** | Test accuracy calculations with known outcomes |
| **Safe Cleanup** | `is_test_data` flag ensures production data is never touched |
| **Demo Mode** | Show stakeholders the system with controlled data |
| **Learning Loop Testing** | Test analyst updates without real failures |

### I.11 Implementation Phases

See I.13 for the complete, updated implementation phases that reflect the frontend-first architecture.

### I.12 API Architecture: Everything Through A2A

**All test data operations go through the standard A2A tasks endpoint.** There are no separate REST endpoints - we use context agents with specialized tools.

```
POST /agent-to-agent/:orgSlug/test-data-builder/tasks
```

#### A2A Agent: `test-data-builder`

A **context agent** that handles all test data building operations:

| Action | Payload | Database Write? |
|--------|---------|-----------------|
| Build/refine test data | `{ "action": "build", "prompt": "...", "currentJSON": {...} }` | NO |
| Execute (insert) | `{ "action": "execute", "finalJSON": {...} }` | YES |
| Cleanup scenario | `{ "action": "cleanup", "scenarioId": "..." }` | YES (delete) |
| Cleanup all | `{ "action": "cleanup-all" }` | YES (delete) |
| List scenarios | `{ "action": "list-scenarios" }` | NO (read) |
| Run tier | `{ "action": "run-tier", "scenarioId": "...", "tier": "signal-detection" }` | YES |

#### Example: Building Test Data (No DB Write)

```typescript
// Frontend sends via agentService.callA2A():
{
  "context": {
    "orgSlug": "my-org",
    "userId": "user-123",
    "conversationId": "{uuid}",
    "taskId": "{uuid}",
    "agentSlug": "test-data-builder",
    "agentType": "context",
    ...
  },
  "mode": "converse",
  "userMessage": "Add 5 bearish signals about Bitcoin regulation",
  "payload": {
    "action": "build",
    "currentJSON": {
      "scenario": { "name": "Crypto Test", "targetId": "btc-123" },
      "signals": [],
      "predictions": [],
      "outcomes": []
    }
  }
}

// Agent returns (NO database write):
{
  "content": "I've generated 5 bearish signals about Bitcoin regulation...",
  "payload": {
    "updatedJSON": {
      "scenario": { "name": "Crypto Test", "targetId": "btc-123" },
      "signals": [
        { "direction": "bearish", "content": "SEC announces new crypto regulations..." },
        { "direction": "bearish", "content": "China bans Bitcoin mining operations..." },
        // ... 3 more
      ],
      "predictions": [],
      "outcomes": []
    },
    "suggestedActions": ["Add predictions", "Add outcomes", "Execute"]
  }
}
```

#### Example: Execute (DB Write)

```typescript
// Frontend sends (on Execute button click):
{
  "context": { ... },
  "mode": "converse",
  "userMessage": "Execute this test dataset",
  "payload": {
    "action": "execute",
    "finalJSON": {
      "scenario": { "name": "Crypto Test", "targetId": "btc-123" },
      "signals": [...],
      "predictions": [...],
      "outcomes": [...]
    }
  }
}

// Agent returns (AFTER database inserts with is_test_data=true):
{
  "content": "Test data inserted successfully. Scenario ID: abc-123",
  "payload": {
    "scenarioId": "abc-123",
    "insertedCounts": {
      "signals": 5,
      "predictions": 3,
      "outcomes": 3
    }
  }
}
```

#### Why A2A Instead of REST?

| Aspect | A2A Approach | Traditional REST |
|--------|--------------|------------------|
| **Consistency** | Same pattern as all other agent calls | Separate controller, different pattern |
| **Observability** | Auto-logged via ExecutionContext | Manual logging needed |
| **Auth** | Standard JWT flow | Separate guard setup |
| **Streaming** | Built-in SSE support | Would need custom implementation |
| **Extensibility** | Add tools to agent context | Add new endpoints |

**The frontend uses the same `agentService.callA2A()` method it uses everywhere else.**

### I.13 Conversational Test Data Builder UI

The Test Data Builder provides a **conversational interface** for creating test datasets at any tier of the prediction pipeline. Instead of manually constructing JSON or filling out forms, users can describe what they want to test in natural language and iteratively refine the data.

#### UI Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🧪 Test Data Builder                                     [Active Scenario] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  📊 Current Dataset                                                   │ │
│  │  ─────────────────                                                    │ │
│  │  Scenario: "Fed Rate Decision Test"                                   │ │
│  │  Target: US Federal Reserve                                           │ │
│  │                                                                        │ │
│  │  Injected Data:                                                       │ │
│  │  ├─ Sources: 0                                                        │ │
│  │  ├─ Signals: 5 ✓                                                      │ │
│  │  │   ├─ 3 bullish (rate pause signals)                                │ │
│  │  │   └─ 2 bearish (inflation concern signals)                         │ │
│  │  ├─ Predictors: 0 (ready to generate)                                 │ │
│  │  ├─ Predictions: 0                                                    │ │
│  │  ├─ Outcomes: 0                                                       │ │
│  │  └─ Learning Items: 0                                                 │ │
│  │                                                                        │ │
│  │  [Run Signal Detection ▶]  [Run Full Pipeline ▶▶]  [Export JSON]     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  💬 Conversation                                        [New Session] │ │
│  │  ─────────────────                                                    │ │
│  │                                                                        │ │
│  │  🧑 You: I want to test how the predictor handles conflicting         │ │
│  │       signals about the Fed. Give me some bullish and bearish         │ │
│  │       signals about rate decisions.                                   │ │
│  │                                                                        │ │
│  │  🤖 Builder: I'll create a mixed signal scenario for Fed rate         │ │
│  │       decisions. Here's what I'm generating:                          │ │
│  │                                                                        │ │
│  │       **Bullish Signals (3):**                                        │ │
│  │       1. "Fed officials hint at rate pause in coming months"          │ │
│  │       2. "Employment data suggests soft landing possible"             │ │
│  │       3. "Powell signals flexibility on rate path"                    │ │
│  │                                                                        │ │
│  │       **Bearish Signals (2):**                                        │ │
│  │       1. "Core inflation remains sticky above 3%"                     │ │
│  │       2. "Services inflation accelerating, concerning Fed"            │ │
│  │                                                                        │ │
│  │       Want me to add these to the scenario?                           │ │
│  │       [✓ Add All] [Edit First] [Regenerate]                          │ │
│  │                                                                        │ │
│  │  🧑 You: Add those. Now I want to add some predictions with known     │ │
│  │       outcomes so I can test the evaluation tier.                     │ │
│  │                                                                        │ │
│  │  🤖 Builder: Sure! I'll generate predictions and their outcomes.      │ │
│  │       What accuracy rate do you want to simulate? This helps test     │ │
│  │       how the evaluation metrics are calculated.                      │ │
│  │                                                                        │ │
│  │       [70% Accurate] [50% Accurate] [90% Accurate] [Custom...]        │ │
│  │                                                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Type a message...                                         [Send ➤]  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Quick Actions: [Add Signals] [Add Predictions] [Add Outcomes]             │
│                [Generate Articles] [Test Deduplication] [Clear All]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Conversation Capabilities

The AI-powered builder understands requests at each tier:

| Tier | Example Prompts |
|------|-----------------|
| **Sources** | "Add a TechCrunch-style source that crawls every 5 minutes" |
| **Articles/Items** | "Generate 10 articles about Apple's earnings, mix of positive and negative" |
| **Signals** | "Create 5 bearish signals about Bitcoin regulation" |
| **Predictors** | "Add a predictor that's been assigned 3 of these signals" |
| **Predictions** | "Generate predictions with a 60% bullish bias" |
| **Outcomes** | "Set outcomes so that 70% of predictions were correct" |
| **Evaluations** | "The analyst should have 75% accuracy on this batch" |
| **Missed Opportunities** | "Add some signals that were never picked up for predictions" |
| **Learning Items** | "Queue up improvements based on the analyst's mistakes" |

#### Architecture: Frontend-First, JSON-Based

**Key Principle:** All test data lives in the frontend Pinia store until the user clicks "Execute". The backend is stateless during the conversation - it only processes prompts and returns updated JSON.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vue/Pinia)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  testDataBuilderStore (Pinia)                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  scenario: { name: "Fed Test", targetId: "xxx", ... }               │   │
│  │  pendingData: {                                                     │   │
│  │    signals: [...],       // JSON objects - NOT in database yet      │   │
│  │    predictions: [...],   // JSON objects - NOT in database yet      │   │
│  │    outcomes: [...],      // JSON objects - NOT in database yet      │   │
│  │  }                                                                  │   │
│  │  conversationHistory: [{ role: 'user', content: '...' }, ...]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Flow:                                                                      │
│  1. User types: "Add 5 bearish signals about Bitcoin"                       │
│  2. POST to A2A: { prompt, currentJSON: pendingData }                       │
│  3. A2A returns: { updatedJSON, displayMessage }                            │
│  4. Store updatedJSON in Pinia (still NOT in database)                      │
│  5. User reviews, sends more prompts to refine...                           │
│  6. User clicks [Execute]                                                   │
│  7. POST finalJSON to execution endpoint                                    │
│  8. Backend generates SQL INSERTs with is_test_data=true                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Frontend Store (Pinia)

```typescript
// stores/testDataBuilder.store.ts
export const useTestDataBuilderStore = defineStore('testDataBuilder', {
  state: () => ({
    // Scenario metadata (not persisted to backend)
    scenario: {
      name: '',
      targetId: '',
      universeId: '',
    },

    // All pending data - lives ONLY in frontend until Execute
    pendingData: {
      sources: [] as TestSourceData[],
      signals: [] as TestSignalData[],
      predictors: [] as TestPredictorData[],
      predictions: [] as TestPredictionData[],
      outcomes: [] as TestOutcomeData[],
      learningItems: [] as TestLearningItemData[],
    },

    // Conversation with AI builder
    conversationHistory: [] as Message[],

    // After execution - track what was inserted
    executedScenarioId: null as string | null,
  }),

  actions: {
    // Send prompt to A2A endpoint, update local JSON
    async sendPrompt(prompt: string) {
      this.conversationHistory.push({ role: 'user', content: prompt });

      // All calls go through the same A2A endpoint with different actions
      const response = await agentService.callA2A('test-data-builder', {
        userMessage: prompt,
        payload: {
          action: 'build',
          currentJSON: {
            scenario: this.scenario,
            ...this.pendingData,
          },
        },
      });

      // Update local store with AI-generated data (no DB write happened)
      if (response.payload?.updatedJSON) {
        this.pendingData = response.payload.updatedJSON;
      }
      this.conversationHistory.push({ role: 'assistant', content: response.content });
    },

    // Execute: Send final JSON to A2A for SQL INSERT
    async execute() {
      const response = await agentService.callA2A('test-data-builder', {
        userMessage: 'Execute this test dataset',
        payload: {
          action: 'execute',
          finalJSON: {
            scenario: this.scenario,
            ...this.pendingData,
          },
        },
      });

      // Backend returns the scenario ID with is_test_data=true markers
      this.executedScenarioId = response.payload?.scenarioId;
    },

    // Clear all pending data
    reset() {
      this.pendingData = { sources: [], signals: [], predictions: [], outcomes: [], learningItems: [] };
      this.conversationHistory = [];
      this.executedScenarioId = null;
    },
  },
});
```

#### A2A Endpoint (Stateless)

```typescript
// Backend: test-data-builder agent context
// This agent is STATELESS - receives JSON, returns updated JSON

interface TestDataBuilderRequest {
  prompt: string;
  currentJSON: PendingTestData;
  scenario: ScenarioMetadata;
}

interface TestDataBuilderResponse {
  updatedJSON: PendingTestData;      // Modified test data
  displayMessage: string;            // Human-readable response
  suggestedActions?: string[];       // "Run signal detection", "Add outcomes", etc.
}

// The A2A agent receives the full JSON state, processes the prompt,
// and returns the updated JSON. No database writes happen here.
```

#### Execution Endpoint (Final Step)

```typescript
// POST /api/test-data/execute
// This is the ONLY time data touches the database

@Post('execute')
async executeTestData(@Body() dto: ExecuteTestDataDto) {
  const scenarioId = uuid();

  // Generate SQL INSERTs with test markers
  for (const signal of dto.data.signals) {
    await this.supabase.schema('prediction').from('signals').insert({
      ...signal,
      is_test_data: true,           // ← MARKED AS TEST
      test_scenario_id: scenarioId,  // ← GROUPED BY SCENARIO
    });
  }

  // Same for predictions, outcomes, etc.

  return { scenarioId, insertedCounts: { signals: dto.data.signals.length, ... } };
}
```

#### Why This Architecture?

| Aspect | Benefit |
|--------|---------|
| **No backend state during building** | User can close browser, come back, data is in localStorage via Pinia persist |
| **A2A is pure function** | Input: prompt + JSON → Output: updated JSON (easy to test, no side effects) |
| **Test markers added at INSERT** | System processes test data normally, but cleanup is trivial |
| **JSON is portable** | Export/import datasets as JSON files |
| **Conversation history is local** | No need to store chat in database |

#### Guided Workflows

The Builder offers guided workflows for common testing scenarios:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Guided Workflows                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [📊 Test Analyst Accuracy]                                     │
│  Create predictions with known outcomes and verify evaluation   │
│  metrics are calculated correctly.                              │
│                                                                 │
│  [🔄 Test Full Pipeline]                                        │
│  Inject signals and run the complete loop through to learning.  │
│                                                                 │
│  [🔍 Test Deduplication]                                        │
│  Generate similar articles to verify fuzzy matching works.      │
│                                                                 │
│  [⚖️ Test Conflicting Signals]                                  │
│  Create mixed bullish/bearish signals for same target.          │
│                                                                 │
│  [📉 Test Missed Opportunities]                                 │
│  Add signals that should trigger missed opportunity detection.  │
│                                                                 │
│  [🎓 Test Learning Loop]                                        │
│  Queue learning items and verify analyst updates.               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Export & Replay

Test datasets can be exported and replayed:

```typescript
interface TestDataset {
  id: string;
  name: string;
  description: string;
  created_at: string;

  // Data by tier
  sources?: SourceData[];
  articles?: ArticleData[];
  signals?: SignalData[];
  predictors?: PredictorData[];
  predictions?: PredictionData[];
  outcomes?: OutcomeData[];
  learning_items?: LearningItemData[];

  // Expected results (for validation)
  expected_results?: {
    predictions_generated?: number;
    accuracy_rate?: number;
    learning_items_created?: number;
  };
}
```

```
┌─────────────────────────────────────────────────────────────────┐
│  💾 Export Dataset                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Name: Fed Rate Decision Test v2                                │
│  Description: Mixed signals testing predictor conflict handling │
│                                                                 │
│  Include:                                                       │
│  ☑ Signals (5)                                                  │
│  ☑ Predictors (3)                                               │
│  ☑ Predictions (3)                                              │
│  ☑ Outcomes (3)                                                 │
│  ☐ Expected Results (for validation)                            │
│                                                                 │
│  [Export as JSON]  [Save to Library]  [Share with Team]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Watching Data Get Picked Up

The UI includes a **live monitor** that shows test data being processed:

```
┌─────────────────────────────────────────────────────────────────┐
│  👁️ Live Monitor                                     [Watching] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⏱️ 12:34:56  Signal detected: "Fed hints at rate pause"        │
│               → Created predictor pred_abc123                   │
│                                                                 │
│  ⏱️ 12:34:58  Predictor pred_abc123 processing...               │
│               → Generated prediction: BULLISH (75% confidence)  │
│                                                                 │
│  ⏱️ 12:35:02  Outcome recorded for prediction pred_abc123       │
│               → Actual: BULLISH ✓ (Correct!)                    │
│                                                                 │
│  ⏱️ 12:35:05  Evaluation complete                               │
│               → Analyst accuracy: 80% (4/5 correct)             │
│                                                                 │
│  ⏱️ 12:35:08  Learning item queued                              │
│               → "Analyst overweight inflation signals"          │
│                                                                 │
│  [Pause] [Clear] [Export Log]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation Phases (Authoritative)

| Phase | What | Priority | Notes |
|-------|------|----------|-------|
| **Phase 1** | Add `is_test_data` + `test_scenario_id` columns to all prediction tables | HIGH | Database migration |
| **Phase 2** | Build execution endpoint (`POST /test-data/execute`) | HIGH | Generates INSERTs with test markers |
| **Phase 3** | Build cleanup endpoints (`DELETE /scenarios/:id`, `DELETE /all`) | HIGH | Safe test data removal |
| **Phase 4** | Create Pinia store (`testDataBuilderStore`) | HIGH | Frontend state management |
| **Phase 5** | Build Test Data Builder UI shell (panels, layout) | MEDIUM | Vue components |
| **Phase 6** | Create A2A agent for conversational building | MEDIUM | Context agent with test data knowledge |
| **Phase 7** | Wire up conversation → A2A → store updates | MEDIUM | Integration |
| **Phase 8** | Add tier runners (`POST /scenarios/:id/run/:tier`) | MEDIUM | Execute pipeline tiers on test data |
| **Phase 9** | Add guided workflows (pre-built test scenarios) | LOW | UX enhancement |
| **Phase 10** | Add export/import JSON functionality | LOW | Portable test datasets |
| **Phase 11** | Build live monitor for watching data flow | LOW | Real-time feedback |

**Key Principle:** Phases 1-4 establish the foundation. Phase 5-7 deliver the core conversational UI. Phases 8-11 are enhancements.

---

## Appendix J: Runner Consolidation Plan

### J.1 Current State (3 Runners)

```
apps/api/src/agent2agent/runners/prediction/
├── stock-predictor/
│   └── stock-predictor-runner.service.ts
├── crypto-predictor/
│   └── crypto-predictor-runner.service.ts
└── market-predictor/
    └── market-predictor-runner.service.ts
```

**Problem:** All three runners share 99% identical pipeline logic. The only differences are:
- Data source tools (Yahoo Finance vs Binance vs Polymarket)
- Specialist prompts (Technical Analyst vs OnChain Analyst vs Market Analyst)
- Risk profile terminology (conservative/moderate/aggressive vs hodler/trader/degen)

### J.2 Target State (1 Runner Now, 1 Later)

```
apps/api/src/agent2agent/runners/prediction/
└── financial-asset-predictor/
    └── financial-asset-predictor-runner.service.ts

# Later (Phase 2):
└── betting-market-predictor/
    └── betting-market-predictor-runner.service.ts
```

### J.3 Why Merge Stock + Crypto?

| Aspect | Stock | Crypto | Verdict |
|--------|-------|--------|---------|
| Core concept | Price movement | Price movement | **Same** |
| Trading mechanics | Buy/sell orders | Buy/sell orders | **Same** |
| Technical analysis | Charts, MA, RSI | Charts, MA, RSI | **Same** |
| Claim types | price, volume, change | price, volume, change | **Same** |
| Data frequency | Market hours | 24/7 | Config flag |
| Volatility threshold | 2% | 5% | Config per instrument |
| On-chain data | N/A | whale_transaction, gas | Optional tools |

**Conclusion:** Crypto is just another asset class. Bitcoin ETFs (IBIT, GBTC) already trade on stock exchanges - the line is already blurred.

### J.4 Why Delete Market-Predictor (For Now)?

- It works, but it's not actively used
- Rebuilding it fresh later will be easier once we have a clean `financial-asset-predictor` template
- Avoids maintaining code we're not using
- When we add sports betting, elections, etc., we'll build `betting-market-predictor` from scratch following the established pattern

### J.5 Implementation Steps

#### Step 1: Rename Directory (Preserve Git History)

```bash
git mv apps/api/src/agent2agent/runners/prediction/stock-predictor \
       apps/api/src/agent2agent/runners/prediction/financial-asset-predictor
```

#### Step 2: Rename Files

```bash
git mv financial-asset-predictor/stock-predictor-runner.service.ts \
       financial-asset-predictor/financial-asset-predictor-runner.service.ts
```

#### Step 3: Update Class Names

```typescript
// Before
@RegisterRunner({ type: 'stock-predictor', name: 'Stock Predictor', ... })
export class StockPredictorRunnerService extends BasePredictionRunnerService

// After
@RegisterRunner({ type: 'financial-asset-predictor', name: 'Financial Asset Predictor', ... })
export class FinancialAssetPredictorRunnerService extends BasePredictionRunnerService
```

#### Step 4: Merge Crypto Tools

```typescript
getTools() {
  return [
    // Stock data sources
    'yahoo-finance',
    'alpha-vantage',
    // Crypto data sources (merged from crypto-predictor)
    'binance',
    'coingecko',
    'whale-alert',
    'etherscan',
    'defillama',
  ];
}
```

#### Step 5: Merge Specialists (Conditional)

```typescript
getSpecialistContexts(bundle: EnrichedClaimBundle) {
  const specialists = [
    'technical-analyst',
    'fundamental-analyst',
    'sentiment-analyst',
    'news-analyst',
  ];

  // Only add crypto-specific specialists if bundle contains crypto instruments
  if (this.hasCryptoInstruments(bundle)) {
    specialists.push('onchain-analyst', 'defi-analyst');
  }

  return specialists;
}

private hasCryptoInstruments(bundle: EnrichedClaimBundle): boolean {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', ...]; // Or check instrument metadata
  return bundle.claims.some(c => cryptoSymbols.some(s => c.instrument.includes(s)));
}
```

#### Step 6: Merge Risk Profiles

```typescript
getRiskProfiles() {
  return [
    // Traditional
    { id: 'conservative', label: 'Conservative', threshold: 0.02 },
    { id: 'moderate', label: 'Moderate', threshold: 0.05 },
    { id: 'aggressive', label: 'Aggressive', threshold: 0.10 },
    // Crypto-style (aliases)
    { id: 'hodler', label: 'HODLer', threshold: 0.02, alias: 'conservative' },
    { id: 'trader', label: 'Trader', threshold: 0.05, alias: 'moderate' },
    { id: 'degen', label: 'Degen', threshold: 0.15, alias: 'aggressive' },
  ];
}
```

#### Step 7: Delete Crypto and Market Predictors

```bash
rm -rf apps/api/src/agent2agent/runners/prediction/crypto-predictor
rm -rf apps/api/src/agent2agent/runners/prediction/market-predictor
```

#### Step 8: Update Module Imports

```typescript
// prediction.module.ts
@Module({
  providers: [
    FinancialAssetPredictorRunnerService,
    // Remove: StockPredictorRunnerService
    // Remove: CryptoPredictorRunnerService
    // Remove: MarketPredictorRunnerService
  ],
})
```

#### Step 9: Update Registry

```typescript
// runner.registry.ts
// Remove old registrations, add new one
registerRunner('financial-asset-predictor', FinancialAssetPredictorRunnerService);
```

#### Step 10: Database Migration (if needed)

```sql
-- Update any agent records that reference old runner types
UPDATE agents SET runner_type = 'financial-asset-predictor'
WHERE runner_type IN ('stock-predictor', 'crypto-predictor');
```

### J.6 Files to Delete

| Directory | Files | Reason |
|-----------|-------|--------|
| `crypto-predictor/` | All | Merged into financial-asset |
| `market-predictor/` | All | Will rebuild fresh later |

### J.7 Backwards Compatibility

For a transition period, support old runner type names:

```typescript
// runner-factory.service.ts
resolveRunnerType(type: string): string {
  const aliases: Record<string, string> = {
    'stock-predictor': 'financial-asset-predictor',
    'crypto-predictor': 'financial-asset-predictor',
  };
  return aliases[type] ?? type;
}
```

### J.8 Testing Checklist

- [ ] `financial-asset-predictor` handles stock symbols (AAPL, MSFT)
- [ ] `financial-asset-predictor` handles crypto symbols (BTC-USD, ETH-USD)
- [ ] On-chain specialists only activate for crypto instruments
- [ ] Risk profiles work for both traditional and crypto terminology
- [ ] Old runner type aliases resolve correctly
- [ ] Build passes with crypto/market directories deleted
- [ ] Existing predictions with old runner types still display correctly

### J.9 Future: Betting Market Predictor

When ready to add betting markets (Polymarket, sports, elections):

1. Create `betting-market-predictor/` directory
2. Copy structure from `financial-asset-predictor/`
3. Replace tools: Polymarket API, odds aggregators, resolution trackers
4. Replace specialists: Market Analyst, Event Analyst, Contrarian
5. Replace claim types: odds, probability, resolution
6. Register new runner

The clean `financial-asset-predictor` becomes the template.
