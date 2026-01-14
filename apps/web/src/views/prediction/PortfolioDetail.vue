<template>
  <div class="portfolio-detail">
    <!-- Header -->
    <header class="detail-header">
      <button class="back-button" @click="goBack">
        <span class="icon">&larr;</span>
        Back to Portfolios
      </button>
      <div v-if="portfolio" class="header-content">
        <div class="header-info">
          <h1>
            {{ portfolio.name }}
            <span class="domain-badge">{{ portfolio.domain.toUpperCase() }}</span>
            <span v-if="!isActive" class="inactive-badge">INACTIVE</span>
          </h1>
          <p v-if="portfolio.description" class="description">{{ portfolio.description }}</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="openSettingsModal">
            <span class="icon">&#9881;</span>
            Settings
          </button>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading portfolio details...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
      <button class="btn btn-secondary" @click="loadPortfolioData">Try Again</button>
    </div>

    <!-- Portfolio Not Found -->
    <div v-else-if="!portfolio" class="empty-state">
      <span class="empty-icon">&#128269;</span>
      <h3>Portfolio Not Found</h3>
      <p>The requested portfolio could not be found.</p>
      <button class="btn btn-secondary" @click="goBack">Go Back</button>
    </div>

    <!-- Main Content with Tabs -->
    <div v-else class="detail-content">
      <!-- Tab Navigation -->
      <nav class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Overview Tab -->
        <section v-if="activeTab === 'overview'" class="tab-panel">
          <div class="overview-grid">
            <!-- Portfolio Info Card -->
            <div class="info-card">
              <h3>Portfolio Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="item-label">Domain</span>
                  <span class="item-value">{{ portfolio.domain }}</span>
                </div>
                <div class="info-item">
                  <span class="item-label">Agent</span>
                  <span class="item-value">{{ portfolio.agentSlug }}</span>
                </div>
                <div class="info-item">
                  <span class="item-label">Organization</span>
                  <span class="item-value">{{ portfolio.organizationSlug }}</span>
                </div>
                <div class="info-item">
                  <span class="item-label">Strategy</span>
                  <span class="item-value">{{ strategy?.name || 'Default' }}</span>
                </div>
                <div class="info-item">
                  <span class="item-label">Status</span>
                  <span class="item-value" :class="isActive ? 'active' : 'inactive'">
                    {{ isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="item-label">Created</span>
                  <span class="item-value">{{ formatDate(portfolio.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- LLM Configuration Card -->
            <div class="info-card">
              <h3>LLM Ensemble Configuration</h3>
              <div v-if="llmConfig" class="llm-tiers">
                <div v-if="llmConfig.tiers?.gold" class="llm-tier gold">
                  <span class="tier-badge">GOLD</span>
                  <span class="tier-model">{{ llmConfig.tiers.gold.provider }}/{{ llmConfig.tiers.gold.model }}</span>
                </div>
                <div v-if="llmConfig.tiers?.silver" class="llm-tier silver">
                  <span class="tier-badge">SILVER</span>
                  <span class="tier-model">{{ llmConfig.tiers.silver.provider }}/{{ llmConfig.tiers.silver.model }}</span>
                </div>
                <div v-if="llmConfig.tiers?.bronze" class="llm-tier bronze">
                  <span class="tier-badge">BRONZE</span>
                  <span class="tier-model">{{ llmConfig.tiers.bronze.provider }}/{{ llmConfig.tiers.bronze.model }}</span>
                </div>
                <div v-if="!llmConfig.tiers" class="empty-config">
                  Using default LLM configuration
                </div>
              </div>
              <div v-else class="empty-config">
                Using default LLM configuration
              </div>
            </div>

            <!-- Thresholds Card -->
            <div class="info-card">
              <h3>Prediction Thresholds</h3>
              <div class="threshold-grid">
                <div class="threshold-item">
                  <span class="threshold-value">{{ thresholds.minPredictors }}</span>
                  <span class="threshold-label">Min Predictors</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-value">{{ thresholds.minCombinedStrength }}%</span>
                  <span class="threshold-label">Min Combined Strength</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-value">{{ thresholds.minDirectionConsensus }}%</span>
                  <span class="threshold-label">Min Direction Consensus</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-value">{{ thresholds.predictorTtlHours }}h</span>
                  <span class="threshold-label">Predictor TTL</span>
                </div>
              </div>
            </div>

            <!-- Notifications Card -->
            <div class="info-card">
              <h3>Notification Settings</h3>
              <div class="notification-settings">
                <div class="notification-toggle">
                  <span class="toggle-indicator" :class="{ enabled: notifications.urgentEnabled }"></span>
                  <span>Urgent Alerts</span>
                </div>
                <div class="notification-toggle">
                  <span class="toggle-indicator" :class="{ enabled: notifications.newPredictionEnabled }"></span>
                  <span>New Predictions</span>
                </div>
                <div class="notification-toggle">
                  <span class="toggle-indicator" :class="{ enabled: notifications.outcomeEnabled }"></span>
                  <span>Outcome Updates</span>
                </div>
                <div class="notification-channels">
                  <span class="channels-label">Channels:</span>
                  <span v-for="channel in notifications.channels" :key="channel" class="channel-badge">
                    {{ channel.toUpperCase() }}
                  </span>
                  <span v-if="notifications.channels.length === 0" class="no-channels">None configured</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="quick-stats">
            <div class="stat-card">
              <span class="stat-value">{{ targets.length }}</span>
              <span class="stat-label">Instruments</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ activeTargets.length }}</span>
              <span class="stat-label">Active</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ portfolioPredictions.length }}</span>
              <span class="stat-label">Predictions</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ activePredictions.length }}</span>
              <span class="stat-label">Active Predictions</span>
            </div>
          </div>

          <!-- Pipeline Actions -->
          <div class="pipeline-actions-card">
            <h3>Pipeline Actions</h3>
            <p class="pipeline-description">
              Manually trigger pipeline steps for all instruments in this portfolio.
              Steps are executed sequentially: Sources &rarr; Signals &rarr; Predictors &rarr; Predictions
            </p>

            <div class="pipeline-buttons">
              <button
                class="btn btn-action"
                :disabled="pipelineInProgress !== null"
                @click="handleCrawlAllSources"
              >
                <span v-if="pipelineInProgress === 'crawl'" class="spinner-small"></span>
                <span v-else class="action-icon">1</span>
                {{ pipelineInProgress === 'crawl' ? 'Crawling...' : 'Crawl Sources' }}
              </button>

              <button
                class="btn btn-action"
                :disabled="pipelineInProgress !== null"
                @click="handleProcessAllSignals"
              >
                <span v-if="pipelineInProgress === 'signals'" class="spinner-small"></span>
                <span v-else class="action-icon">2</span>
                {{ pipelineInProgress === 'signals' ? 'Processing...' : 'Process Signals' }}
              </button>

              <button
                class="btn btn-action"
                :disabled="pipelineInProgress !== null"
                @click="handleGenerateAllPredictions"
              >
                <span v-if="pipelineInProgress === 'predictions'" class="spinner-small"></span>
                <span v-else class="action-icon">3</span>
                {{ pipelineInProgress === 'predictions' ? 'Generating...' : 'Generate Predictions' }}
              </button>

              <button
                class="btn btn-action btn-full-pipeline"
                :disabled="pipelineInProgress !== null"
                @click="handleRunFullPipeline"
              >
                <span v-if="pipelineInProgress === 'full'" class="spinner-small"></span>
                <span v-else class="action-icon">&#9654;</span>
                {{ pipelineInProgress === 'full' ? 'Running Pipeline...' : 'Run Full Pipeline' }}
              </button>
            </div>

            <!-- Pipeline Result -->
            <div v-if="pipelineResult" class="pipeline-result" :class="{ error: pipelineResult.isError }">
              <div class="result-header">
                <span class="result-icon">{{ pipelineResult.isError ? '!' : '&#10003;' }}</span>
                <strong>{{ pipelineResult.title }}</strong>
              </div>
              <p class="result-message">{{ pipelineResult.message }}</p>
              <div v-if="pipelineResult.details" class="result-details">
                <div v-for="(detail, idx) in pipelineResult.details" :key="idx" class="detail-item">
                  {{ detail }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Instruments Tab -->
        <section v-if="activeTab === 'instruments'" class="tab-panel">
          <div class="section-header">
            <h2>Instruments</h2>
            <button class="btn btn-primary" @click="openAddTargetModal">
              <span class="icon">+</span>
              Add Instrument
            </button>
          </div>

          <div v-if="targets.length === 0" class="empty-message">
            <p>No instruments have been added to this portfolio yet.</p>
            <button class="btn btn-primary" @click="openAddTargetModal">
              <span class="icon">+</span>
              Add First Instrument
            </button>
          </div>

          <div v-else class="targets-table">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Predictions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="target in targets"
                  :key="target.id"
                  :class="{ inactive: !target.active }"
                  @click="goToTarget(target.id)"
                >
                  <td class="symbol-cell">
                    <span class="symbol">{{ target.symbol }}</span>
                    <span v-if="target.symbol.startsWith('T_')" class="test-indicator">TEST</span>
                  </td>
                  <td>{{ target.name }}</td>
                  <td>{{ target.targetType }}</td>
                  <td>
                    <span class="status-badge" :class="target.active ? 'active' : 'inactive'">
                      {{ target.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>{{ getPredictionCount(target.id) }}</td>
                  <td class="actions-cell" @click.stop>
                    <button class="btn-icon" @click="openEditTargetModal(target)" title="Edit">
                      &#9998;
                    </button>
                    <button class="btn-icon" @click="toggleTargetActive(target)" :title="target.active ? 'Deactivate' : 'Activate'">
                      {{ target.active ? '&#10006;' : '&#10004;' }}
                    </button>
                    <button class="btn-icon danger" @click="confirmDeleteTarget(target)" title="Delete">
                      &#128465;
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Sources Tab -->
        <section v-if="activeTab === 'sources'" class="tab-panel">
          <div class="section-header">
            <h2>Data Sources</h2>
            <button class="btn btn-primary" @click="openAddSourceModal">
              <span class="icon">+</span>
              Add Source
            </button>
          </div>

          <div v-if="sources.length === 0" class="empty-message">
            <div class="empty-content">
              <span class="empty-icon">🔗</span>
              <h3>No Sources Configured</h3>
              <p>Sources are required for signal detection. Add a source to start crawling for market signals.</p>
              <button class="btn btn-primary" @click="openAddSourceModal">
                <span class="icon">+</span>
                Add First Source
              </button>
            </div>
          </div>

          <div v-else class="sources-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>URL</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Last Crawl</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="source in sources"
                  :key="source.id"
                  :class="{ inactive: !source.active }"
                >
                  <td class="source-name">{{ source.name }}</td>
                  <td>
                    <span class="type-badge">{{ (source.sourceType || 'rss').toUpperCase() }}</span>
                  </td>
                  <td class="source-url-cell">
                    <a :href="source.crawlConfig?.url as string" target="_blank" rel="noopener">
                      {{ truncateUrl(source.crawlConfig?.url as string) }}
                    </a>
                  </td>
                  <td>{{ source.crawlConfig?.frequency || '15min' }}</td>
                  <td>
                    <span class="status-badge" :class="source.active ? 'active' : 'inactive'">
                      {{ source.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <span v-if="source.lastCrawledAt" class="last-crawl">
                      {{ formatDate(source.lastCrawledAt) }}
                    </span>
                    <span v-else class="no-crawl">Never</span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-icon" @click="testCrawlSource(source)" title="Test Crawl">
                      ⟳
                    </button>
                    <button class="btn-icon" @click="openEditSourceModal(source)" title="Edit">
                      ✎
                    </button>
                    <button class="btn-icon" @click="toggleSourceActive(source)" :title="source.active ? 'Deactivate' : 'Activate'">
                      {{ source.active ? '✖' : '✔' }}
                    </button>
                    <button class="btn-icon danger" @click="confirmDeleteSource(source)" title="Delete">
                      🗑
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Source Setup Guide -->
          <div class="source-guide">
            <h3>📋 Source Setup Guide</h3>
            <ul>
              <li><strong>Web:</strong> Crawls web pages for news and articles about your instruments</li>
              <li><strong>RSS:</strong> Subscribes to RSS feeds for automated content ingestion</li>
              <li><strong>API:</strong> Connects to external data APIs (requires configuration)</li>
            </ul>
            <p class="guide-note">💡 Tip: Start with one or two reliable news sources for your domain. Sources are crawled automatically based on their frequency setting.</p>
          </div>
        </section>

        <!-- Predictions Tab -->
        <section v-if="activeTab === 'predictions'" class="tab-panel">
          <div class="section-header">
            <h2>Recent Predictions</h2>
            <button class="btn btn-secondary" @click="viewAllPredictions">
              View All in Dashboard
            </button>
          </div>

          <div v-if="portfolioPredictions.length === 0" class="empty-message">
            <p>No predictions have been generated for this portfolio yet.</p>
          </div>

          <div v-else class="predictions-grid">
            <PredictionCard
              v-for="prediction in portfolioPredictions.slice(0, 12)"
              :key="prediction.id"
              :prediction="prediction"
              @select="onPredictionSelect"
            />
          </div>
        </section>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettingsModal" class="modal-overlay" @click.self="closeSettingsModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>Portfolio Settings</h3>
          <button class="close-button" @click="closeSettingsModal">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Settings Tabs -->
          <div class="settings-tabs">
            <button
              v-for="tab in settingsTabs"
              :key="tab.id"
              class="settings-tab"
              :class="{ active: activeSettingsTab === tab.id }"
              @click="activeSettingsTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- General Settings -->
          <div v-if="activeSettingsTab === 'general'" class="settings-panel">
            <div class="form-group">
              <label for="name">Portfolio Name</label>
              <input id="name" v-model="settingsForm.name" type="text" />
            </div>
            <div class="form-group">
              <label for="description">Description</label>
              <textarea id="description" v-model="settingsForm.description" rows="3"></textarea>
            </div>
            <div class="form-group checkbox">
              <input id="isActive" v-model="settingsForm.isActive" type="checkbox" />
              <label for="isActive">Portfolio is active (generate predictions)</label>
            </div>
          </div>

          <!-- LLM Configuration -->
          <div v-if="activeSettingsTab === 'llm'" class="settings-panel">
            <p class="settings-description">Configure the LLM ensemble for this portfolio. Each tier uses a different model for prediction analysis.</p>

            <div class="llm-config-form">
              <div class="llm-tier-config">
                <h4><span class="tier-badge gold">GOLD</span> Primary Model</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label>Provider</label>
                    <select v-model="settingsForm.llmConfig.gold.provider">
                      <option value="">Default</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Model</label>
                    <input v-model="settingsForm.llmConfig.gold.model" type="text" placeholder="e.g., claude-3-opus" />
                  </div>
                </div>
              </div>

              <div class="llm-tier-config">
                <h4><span class="tier-badge silver">SILVER</span> Secondary Model</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label>Provider</label>
                    <select v-model="settingsForm.llmConfig.silver.provider">
                      <option value="">Default</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Model</label>
                    <input v-model="settingsForm.llmConfig.silver.model" type="text" placeholder="e.g., claude-3-sonnet" />
                  </div>
                </div>
              </div>

              <div class="llm-tier-config">
                <h4><span class="tier-badge bronze">BRONZE</span> Tertiary Model</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label>Provider</label>
                    <select v-model="settingsForm.llmConfig.bronze.provider">
                      <option value="">Default</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Model</label>
                    <input v-model="settingsForm.llmConfig.bronze.model" type="text" placeholder="e.g., claude-3-haiku" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Thresholds -->
          <div v-if="activeSettingsTab === 'thresholds'" class="settings-panel">
            <p class="settings-description">Configure the minimum requirements for generating predictions.</p>

            <div class="form-group">
              <label for="minPredictors">Minimum Predictors</label>
              <input id="minPredictors" v-model.number="settingsForm.thresholds.minPredictors" type="number" min="1" max="10" />
              <span class="form-hint">Number of signals required before generating a prediction</span>
            </div>
            <div class="form-group">
              <label for="minCombinedStrength">Minimum Combined Strength (%)</label>
              <input id="minCombinedStrength" v-model.number="settingsForm.thresholds.minCombinedStrength" type="number" min="0" max="100" />
              <span class="form-hint">Minimum aggregate signal strength required</span>
            </div>
            <div class="form-group">
              <label for="minDirectionConsensus">Minimum Direction Consensus (%)</label>
              <input id="minDirectionConsensus" v-model.number="settingsForm.thresholds.minDirectionConsensus" type="number" min="0" max="100" />
              <span class="form-hint">Percentage of signals that must agree on direction</span>
            </div>
            <div class="form-group">
              <label for="predictorTtlHours">Predictor TTL (hours)</label>
              <input id="predictorTtlHours" v-model.number="settingsForm.thresholds.predictorTtlHours" type="number" min="1" max="168" />
              <span class="form-hint">How long signals remain valid</span>
            </div>
          </div>

          <!-- Notifications -->
          <div v-if="activeSettingsTab === 'notifications'" class="settings-panel">
            <p class="settings-description">Configure when and how you receive alerts about this portfolio.</p>

            <div class="form-group checkbox">
              <input id="urgentEnabled" v-model="settingsForm.notifications.urgentEnabled" type="checkbox" />
              <label for="urgentEnabled">Enable urgent alerts (high-confidence predictions)</label>
            </div>
            <div class="form-group checkbox">
              <input id="newPredictionEnabled" v-model="settingsForm.notifications.newPredictionEnabled" type="checkbox" />
              <label for="newPredictionEnabled">Notify on new predictions</label>
            </div>
            <div class="form-group checkbox">
              <input id="outcomeEnabled" v-model="settingsForm.notifications.outcomeEnabled" type="checkbox" />
              <label for="outcomeEnabled">Notify on prediction outcomes</label>
            </div>

            <div class="form-group">
              <label>Notification Channels</label>
              <div class="channel-toggles">
                <label class="channel-toggle">
                  <input type="checkbox" v-model="settingsForm.notifications.channels" value="push" />
                  <span>Push</span>
                </label>
                <label class="channel-toggle">
                  <input type="checkbox" v-model="settingsForm.notifications.channels" value="email" />
                  <span>Email</span>
                </label>
                <label class="channel-toggle">
                  <input type="checkbox" v-model="settingsForm.notifications.channels" value="sms" />
                  <span>SMS</span>
                </label>
                <label class="channel-toggle">
                  <input type="checkbox" v-model="settingsForm.notifications.channels" value="sse" />
                  <span>SSE (Real-time)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeSettingsModal">Cancel</button>
          <button class="btn btn-primary" :disabled="isSaving" @click="saveSettings">
            {{ isSaving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Target Modal -->
    <div v-if="showTargetModal" class="modal-overlay" @click.self="closeTargetModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingTarget ? 'Edit Instrument' : 'Add Instrument' }}</h3>
          <button class="close-button" @click="closeTargetModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="symbol">Symbol *</label>
            <input
              id="symbol"
              v-model="targetForm.symbol"
              type="text"
              placeholder="e.g., AAPL, BTC"
              :disabled="!!editingTarget"
            />
          </div>
          <div class="form-group">
            <label for="targetName">Name *</label>
            <input
              id="targetName"
              v-model="targetForm.name"
              type="text"
              placeholder="e.g., Apple Inc., Bitcoin"
            />
          </div>
          <div class="form-group">
            <label for="targetType">Type *</label>
            <select id="targetType" v-model="targetForm.targetType">
              <option value="stock">Stock</option>
              <option value="crypto">Crypto</option>
              <option value="election">Election</option>
              <option value="polymarket">Polymarket</option>
            </select>
          </div>
          <div class="form-group">
            <label for="context">Analysis Context</label>
            <textarea
              id="context"
              v-model="targetForm.context"
              rows="3"
              placeholder="Optional context for prediction analysis..."
            ></textarea>
          </div>
          <div class="form-group checkbox">
            <input id="targetActive" v-model="targetForm.active" type="checkbox" />
            <label for="targetActive">Active (generate predictions for this instrument)</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeTargetModal">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="!isTargetFormValid || isSavingTarget"
            @click="saveTarget"
          >
            {{ isSavingTarget ? 'Saving...' : (editingTarget ? 'Update' : 'Add') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>Delete Instrument</h3>
          <button class="close-button" @click="closeDeleteModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ targetToDelete?.symbol }}</strong>?</p>
          <p class="warning">This will also delete all associated predictions.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDeleteModal">Cancel</button>
          <button class="btn btn-danger" :disabled="isDeleting" @click="deleteTarget">
            {{ isDeleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Source Modal -->
    <div v-if="showSourceModal" class="modal-overlay" @click.self="closeSourceModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingSource ? 'Edit Source' : 'Add Source' }}</h3>
          <button class="close-button" @click="closeSourceModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="sourceName">Name *</label>
            <input
              id="sourceName"
              v-model="sourceForm.name"
              type="text"
              placeholder="e.g., Yahoo Finance News"
            />
          </div>
          <div class="form-group">
            <label for="sourceType">Type *</label>
            <select id="sourceType" v-model="sourceForm.sourceType" :disabled="!!editingSource">
              <option value="web">Web (HTML page)</option>
              <option value="rss">RSS Feed</option>
              <option value="api">API Endpoint</option>
            </select>
          </div>
          <div class="form-group">
            <label for="sourceUrl">URL *</label>
            <input
              id="sourceUrl"
              v-model="sourceForm.url"
              type="url"
              placeholder="https://example.com/news"
            />
            <span class="form-hint">The URL to crawl for content</span>
          </div>
          <div class="form-group">
            <label for="sourceFrequency">Crawl Frequency</label>
            <select id="sourceFrequency" v-model="sourceForm.frequency">
              <option value="5min">Every 5 minutes</option>
              <option value="10min">Every 10 minutes</option>
              <option value="15min">Every 15 minutes</option>
              <option value="30min">Every 30 minutes</option>
              <option value="hourly">Hourly</option>
            </select>
            <span class="form-hint">How often to check for new content</span>
          </div>
          <div class="form-group checkbox">
            <input id="sourceActive" v-model="sourceForm.active" type="checkbox" />
            <label for="sourceActive">Active (enable automatic crawling)</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeSourceModal">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="!isSourceFormValid || isSavingSource"
            @click="saveSource"
          >
            {{ isSavingSource ? 'Saving...' : (editingSource ? 'Update' : 'Add') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Source Confirmation Modal -->
    <div v-if="showDeleteSourceModal" class="modal-overlay" @click.self="closeDeleteSourceModal">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>Delete Source</h3>
          <button class="close-button" @click="closeDeleteSourceModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ sourceToDelete?.name }}</strong>?</p>
          <p class="warning">This will stop crawling from this source. Existing signals and predictions will not be affected.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDeleteSourceModal">Cancel</button>
          <button class="btn btn-danger" :disabled="isDeletingSource" @click="deleteSource">
            {{ isDeletingSource ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePredictionStore } from '@/stores/predictionStore';
import { predictionDashboardService, type PredictionTarget, type PredictionSource } from '@/services/predictionDashboardService';
import PredictionCard from '@/components/prediction/PredictionCard.vue';

const route = useRoute();
const router = useRouter();
const store = usePredictionStore();

const isLoading = ref(false);
const error = ref<string | null>(null);
const isSaving = ref(false);
const isSavingTarget = ref(false);
const isDeleting = ref(false);

// Tab state
const activeTab = ref<'overview' | 'instruments' | 'sources' | 'predictions'>('overview');

// Modal state
const showSettingsModal = ref(false);
const showTargetModal = ref(false);
const showDeleteModal = ref(false);
const showSourceModal = ref(false);
const showDeleteSourceModal = ref(false);
const activeSettingsTab = ref<'general' | 'llm' | 'thresholds' | 'notifications'>('general');
const editingTarget = ref<PredictionTarget | null>(null);
const targetToDelete = ref<PredictionTarget | null>(null);
const editingSource = ref<PredictionSource | null>(null);
const sourceToDelete = ref<PredictionSource | null>(null);

// Sources state
const sources = ref<PredictionSource[]>([]);
const isSavingSource = ref(false);
const isDeletingSource = ref(false);

// Pipeline state
const pipelineInProgress = ref<'crawl' | 'signals' | 'predictions' | 'full' | null>(null);
const pipelineResult = ref<{
  isError: boolean;
  title: string;
  message: string;
  details?: string[];
} | null>(null);

// Settings form
const settingsForm = ref({
  name: '',
  description: '',
  isActive: true,
  llmConfig: {
    gold: { provider: '', model: '' },
    silver: { provider: '', model: '' },
    bronze: { provider: '', model: '' },
  },
  thresholds: {
    minPredictors: 3,
    minCombinedStrength: 60,
    minDirectionConsensus: 70,
    predictorTtlHours: 24,
  },
  notifications: {
    urgentEnabled: true,
    newPredictionEnabled: true,
    outcomeEnabled: true,
    channels: [] as string[],
  },
});

// Target form
const targetForm = ref({
  symbol: '',
  name: '',
  targetType: 'stock' as 'stock' | 'crypto' | 'election' | 'polymarket',
  context: '',
  active: true,
});

// Source form
const sourceForm = ref({
  name: '',
  sourceType: 'web' as 'web' | 'rss' | 'api',
  url: '',
  frequency: '15min' as '5min' | '10min' | '15min' | '30min' | 'hourly',
  active: true,
});

// Tabs configuration
const tabs = computed(() => [
  { id: 'overview' as const, label: 'Overview', icon: '📈' },
  { id: 'instruments' as const, label: 'Instruments', icon: '📊', count: targets.value.length },
  { id: 'sources' as const, label: 'Sources', icon: '🔗', count: sources.value.length },
  { id: 'predictions' as const, label: 'Predictions', icon: '💡', count: portfolioPredictions.value.length },
]);

const settingsTabs = [
  { id: 'general' as const, label: 'General' },
  { id: 'llm' as const, label: 'LLM Models' },
  { id: 'thresholds' as const, label: 'Thresholds' },
  { id: 'notifications' as const, label: 'Notifications' },
];

// Computed properties
const portfolioId = computed(() => route.params.id as string);
const portfolio = computed(() => store.getUniverseById(portfolioId.value));
const targets = computed(() => store.getTargetsForUniverse(portfolioId.value));
const activeTargets = computed(() => targets.value.filter(t => t.active));
const portfolioPredictions = computed(() =>
  store.predictions.filter((p) => p.universeId === portfolioId.value)
);
const activePredictions = computed(() =>
  portfolioPredictions.value.filter((p) => p.status === 'active')
);
const strategy = computed(() =>
  portfolio.value?.strategyId ? store.getStrategyById(portfolio.value.strategyId) : null
);
const isActive = computed(() => {
  // Check if portfolio has isActive property (may need to be added to type)
  const p = portfolio.value as Record<string, unknown> | undefined;
  return p?.isActive !== false;
});
const llmConfig = computed(() => portfolio.value?.llmConfig);
const thresholds = computed(() => {
  const p = portfolio.value as Record<string, unknown> | undefined;
  const t = p?.thresholds as Record<string, number> | undefined;
  return {
    minPredictors: t?.min_predictors ?? t?.minPredictors ?? 3,
    minCombinedStrength: t?.min_combined_strength ?? t?.minCombinedStrength ?? 60,
    minDirectionConsensus: t?.min_direction_consensus ?? t?.minDirectionConsensus ?? 70,
    predictorTtlHours: t?.predictor_ttl_hours ?? t?.predictorTtlHours ?? 24,
  };
});
const notifications = computed(() => {
  const p = portfolio.value as Record<string, unknown> | undefined;
  const n = p?.notificationConfig as Record<string, unknown> | undefined;
  return {
    urgentEnabled: n?.urgent_enabled ?? n?.urgentEnabled ?? true,
    newPredictionEnabled: n?.new_prediction_enabled ?? n?.newPredictionEnabled ?? true,
    outcomeEnabled: n?.outcome_enabled ?? n?.outcomeEnabled ?? true,
    channels: (n?.channels as string[]) ?? [],
  };
});

const isTargetFormValid = computed(() => {
  return targetForm.value.symbol.trim() !== '' && targetForm.value.name.trim() !== '';
});

function getPredictionCount(targetId: string): number {
  return store.predictions.filter((p) => p.targetId === targetId).length;
}

async function loadPortfolioData() {
  if (!portfolioId.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    // Load universe/portfolio if not in store
    let u = store.getUniverseById(portfolioId.value);

    if (!u) {
      const response = await predictionDashboardService.getUniverse({
        id: portfolioId.value,
      });
      if (response.content) {
        store.addUniverse(response.content);
        u = response.content;
      }
    }

    if (u) {
      store.selectUniverse(u.id);

      // Load targets for this portfolio
      const targetsRes = await predictionDashboardService.listTargets({
        universeId: u.id,
      });
      if (targetsRes.content) {
        store.setTargets(targetsRes.content);
      }

      // Load predictions for this portfolio
      // Include test data during development to see all predictions
      const predictionsRes = await predictionDashboardService.listPredictions(
        { universeId: u.id, includeTestData: true },
        { pageSize: 50 }
      );
      if (predictionsRes.content) {
        store.setPredictions(predictionsRes.content);
      }

      // Load strategies
      const strategiesRes = await predictionDashboardService.listStrategies();
      if (strategiesRes.content) {
        store.setStrategies(strategiesRes.content);
      }

      // Load sources for this portfolio
      const sourcesRes = await predictionDashboardService.listSources({
        universeId: u.id,
      });
      if (sourcesRes.content) {
        sources.value = sourcesRes.content;
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load portfolio';
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push({ name: 'PortfolioManagement' });
}

function goToTarget(targetId: string) {
  router.push({ name: 'TargetDetail', params: { id: targetId } });
}

function onPredictionSelect(id: string) {
  router.push({ name: 'PredictionDetail', params: { id } });
}

function viewAllPredictions() {
  router.push({ name: 'PredictionDashboard', query: { universeId: portfolioId.value } });
}

// Settings Modal
function openSettingsModal() {
  if (!portfolio.value) return;

  const p = portfolio.value as Record<string, unknown>;
  const t = p.thresholds as Record<string, number> | undefined;
  const n = p.notificationConfig as Record<string, unknown> | undefined;

  settingsForm.value = {
    name: portfolio.value.name,
    description: portfolio.value.description || '',
    isActive: p.isActive !== false,
    llmConfig: {
      gold: {
        provider: llmConfig.value?.tiers?.gold?.provider || '',
        model: llmConfig.value?.tiers?.gold?.model || ''
      },
      silver: {
        provider: llmConfig.value?.tiers?.silver?.provider || '',
        model: llmConfig.value?.tiers?.silver?.model || ''
      },
      bronze: {
        provider: llmConfig.value?.tiers?.bronze?.provider || '',
        model: llmConfig.value?.tiers?.bronze?.model || ''
      },
    },
    thresholds: {
      minPredictors: t?.min_predictors ?? t?.minPredictors ?? 3,
      minCombinedStrength: t?.min_combined_strength ?? t?.minCombinedStrength ?? 60,
      minDirectionConsensus: t?.min_direction_consensus ?? t?.minDirectionConsensus ?? 70,
      predictorTtlHours: t?.predictor_ttl_hours ?? t?.predictorTtlHours ?? 24,
    },
    notifications: {
      urgentEnabled: n?.urgent_enabled ?? n?.urgentEnabled ?? true,
      newPredictionEnabled: n?.new_prediction_enabled ?? n?.newPredictionEnabled ?? true,
      outcomeEnabled: n?.outcome_enabled ?? n?.outcomeEnabled ?? true,
      channels: [...((n?.channels as string[]) ?? [])],
    },
  };
  activeSettingsTab.value = 'general';
  showSettingsModal.value = true;
}

function closeSettingsModal() {
  showSettingsModal.value = false;
}

async function saveSettings() {
  if (!portfolio.value) return;

  isSaving.value = true;

  try {
    // Build the update payload
    const llmTiers: Record<string, { provider: string; model: string }> = {};
    if (settingsForm.value.llmConfig.gold.provider && settingsForm.value.llmConfig.gold.model) {
      llmTiers.gold = settingsForm.value.llmConfig.gold;
    }
    if (settingsForm.value.llmConfig.silver.provider && settingsForm.value.llmConfig.silver.model) {
      llmTiers.silver = settingsForm.value.llmConfig.silver;
    }
    if (settingsForm.value.llmConfig.bronze.provider && settingsForm.value.llmConfig.bronze.model) {
      llmTiers.bronze = settingsForm.value.llmConfig.bronze;
    }

    await predictionDashboardService.updateUniverse({
      id: portfolio.value.id,
      name: settingsForm.value.name,
      description: settingsForm.value.description || undefined,
      // Note: API expects snake_case, service should handle transformation
      llmConfig: Object.keys(llmTiers).length > 0 ? { tiers: llmTiers } : undefined,
      thresholds: {
        minPredictors: settingsForm.value.thresholds.minPredictors,
        minCombinedStrength: settingsForm.value.thresholds.minCombinedStrength,
        minDirectionConsensus: settingsForm.value.thresholds.minDirectionConsensus,
        predictorTtlHours: settingsForm.value.thresholds.predictorTtlHours,
      },
      notificationConfig: {
        urgentEnabled: settingsForm.value.notifications.urgentEnabled,
        newPredictionEnabled: settingsForm.value.notifications.newPredictionEnabled,
        outcomeEnabled: settingsForm.value.notifications.outcomeEnabled,
        channels: settingsForm.value.notifications.channels,
      },
    });

    // Reload to get updated data
    await loadPortfolioData();
    closeSettingsModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save settings';
  } finally {
    isSaving.value = false;
  }
}

// Target Modal
function openAddTargetModal() {
  editingTarget.value = null;
  targetForm.value = {
    symbol: '',
    name: '',
    targetType: getDefaultTargetType(),
    context: '',
    active: true,
  };
  showTargetModal.value = true;
}

function openEditTargetModal(target: PredictionTarget) {
  editingTarget.value = target;
  targetForm.value = {
    symbol: target.symbol,
    name: target.name,
    targetType: target.targetType as 'stock' | 'crypto' | 'election' | 'polymarket',
    context: target.context || '',
    active: target.active,
  };
  showTargetModal.value = true;
}

function closeTargetModal() {
  showTargetModal.value = false;
  editingTarget.value = null;
}

function getDefaultTargetType(): 'stock' | 'crypto' | 'election' | 'polymarket' {
  if (!portfolio.value) return 'stock';
  const domain = portfolio.value.domain;
  if (domain === 'stocks') return 'stock';
  if (domain === 'crypto') return 'crypto';
  if (domain === 'elections') return 'election';
  if (domain === 'polymarket') return 'polymarket';
  return 'stock';
}

async function saveTarget() {
  if (!isTargetFormValid.value || !portfolio.value) return;

  isSavingTarget.value = true;

  try {
    if (editingTarget.value) {
      const response = await predictionDashboardService.updateTarget({
        id: editingTarget.value.id,
        name: targetForm.value.name,
        context: targetForm.value.context || undefined,
        active: targetForm.value.active,
      });
      if (response.content) {
        store.updateTarget(editingTarget.value.id, response.content);
      }
    } else {
      const response = await predictionDashboardService.createTarget({
        universeId: portfolio.value.id,
        symbol: targetForm.value.symbol.toUpperCase(),
        name: targetForm.value.name,
        targetType: targetForm.value.targetType,
        context: targetForm.value.context || undefined,
        active: targetForm.value.active,
      });
      if (response.content) {
        store.addTarget(response.content);
      }
    }

    closeTargetModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save target';
  } finally {
    isSavingTarget.value = false;
  }
}

async function toggleTargetActive(target: PredictionTarget) {
  try {
    const response = await predictionDashboardService.updateTarget({
      id: target.id,
      active: !target.active,
    });
    if (response.content) {
      store.updateTarget(target.id, response.content);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update target';
  }
}

function confirmDeleteTarget(target: PredictionTarget) {
  targetToDelete.value = target;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  targetToDelete.value = null;
}

async function deleteTarget() {
  if (!targetToDelete.value) return;

  isDeleting.value = true;

  try {
    await predictionDashboardService.deleteTarget({
      id: targetToDelete.value.id,
    });
    store.removeTarget(targetToDelete.value.id);
    closeDeleteModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete target';
  } finally {
    isDeleting.value = false;
  }
}

// Source Modal Functions
function openAddSourceModal() {
  editingSource.value = null;
  sourceForm.value = {
    name: '',
    sourceType: 'web',
    url: '',
    frequency: '15min',
    active: true,
  };
  showSourceModal.value = true;
}

function openEditSourceModal(source: PredictionSource) {
  editingSource.value = source;
  sourceForm.value = {
    name: source.name,
    sourceType: source.sourceType as 'web' | 'rss' | 'api',
    url: (source.crawlConfig?.url as string) || '',
    frequency: (source.crawlConfig?.frequency as '5min' | '10min' | '15min' | '30min' | 'hourly') || '15min',
    active: source.active,
  };
  showSourceModal.value = true;
}

function closeSourceModal() {
  showSourceModal.value = false;
  editingSource.value = null;
}

const isSourceFormValid = computed(() => {
  return sourceForm.value.name.trim() !== '' && sourceForm.value.url.trim() !== '';
});

async function saveSource() {
  if (!isSourceFormValid.value || !portfolio.value) return;

  isSavingSource.value = true;

  try {
    if (editingSource.value) {
      const response = await predictionDashboardService.updateSource({
        id: editingSource.value.id,
        name: sourceForm.value.name,
        crawlConfig: {
          url: sourceForm.value.url,
          frequency: sourceForm.value.frequency,
        },
        active: sourceForm.value.active,
      });
      if (response.content) {
        const idx = sources.value.findIndex(s => s.id === editingSource.value!.id);
        if (idx >= 0) {
          sources.value[idx] = response.content;
        }
      }
    } else {
      // Backend expects url at top level, crawlConfig for additional settings
      const frequencyMinutes = {
        '5min': 5,
        '10min': 10,
        '15min': 15,
        '30min': 30,
        'hourly': 60,
      }[sourceForm.value.frequency] || 15;

      const response = await predictionDashboardService.createSource({
        name: sourceForm.value.name,
        sourceType: sourceForm.value.sourceType,
        scopeLevel: 'universe',
        universeId: portfolio.value.id,
        crawlConfig: {
          url: sourceForm.value.url,
          frequency: sourceForm.value.frequency,
        },
        crawlFrequencyMinutes: frequencyMinutes,
      } as Parameters<typeof predictionDashboardService.createSource>[0]);
      if (response.content) {
        sources.value.push(response.content);
      }
    }

    closeSourceModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save source';
  } finally {
    isSavingSource.value = false;
  }
}

async function toggleSourceActive(source: PredictionSource) {
  try {
    const response = await predictionDashboardService.updateSource({
      id: source.id,
      active: !source.active,
    });
    if (response.content) {
      const idx = sources.value.findIndex(s => s.id === source.id);
      if (idx >= 0) {
        sources.value[idx] = response.content;
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update source';
  }
}

function confirmDeleteSource(source: PredictionSource) {
  sourceToDelete.value = source;
  showDeleteSourceModal.value = true;
}

function closeDeleteSourceModal() {
  showDeleteSourceModal.value = false;
  sourceToDelete.value = null;
}

async function deleteSource() {
  if (!sourceToDelete.value) return;

  isDeletingSource.value = true;

  try {
    await predictionDashboardService.deleteSource({
      id: sourceToDelete.value.id,
    });
    sources.value = sources.value.filter(s => s.id !== sourceToDelete.value!.id);
    closeDeleteSourceModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete source';
  } finally {
    isDeletingSource.value = false;
  }
}

async function testCrawlSource(source: PredictionSource) {
  try {
    await predictionDashboardService.testCrawl({ id: source.id });
    // Refresh the source list to get updated last crawl time
    await loadSources();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to trigger test crawl';
  }
}

async function loadSources() {
  if (!portfolioId.value) return;

  try {
    const response = await predictionDashboardService.listSources({
      universeId: portfolioId.value,
    });
    if (response.content) {
      sources.value = response.content;
    }
  } catch (err) {
    console.error('Failed to load sources:', err);
  }
}

// Pipeline Actions
async function handleCrawlAllSources() {
  if (!portfolioId.value) return;

  pipelineInProgress.value = 'crawl';
  pipelineResult.value = null;

  try {
    const response = await predictionDashboardService.crawlSources({
      universeId: portfolioId.value,
    });

    if (response.content) {
      pipelineResult.value = {
        isError: response.content.errorCount > 0,
        title: 'Crawl Complete',
        message: response.content.message,
        details: [
          `Sources processed: ${response.content.sourcesProcessed}`,
          `Signals created: ${response.content.totalSignalsCreated}`,
          `Errors: ${response.content.errorCount}`,
        ],
      };
    }
  } catch (err) {
    pipelineResult.value = {
      isError: true,
      title: 'Crawl Failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    pipelineInProgress.value = null;
  }
}

async function handleProcessAllSignals() {
  if (!portfolioId.value) return;

  pipelineInProgress.value = 'signals';
  pipelineResult.value = null;

  try {
    const response = await predictionDashboardService.processSignals({
      universeId: portfolioId.value,
      batchSize: 50,
    });

    if (response.content) {
      const totalErrors = response.content.totalErrors ?? response.content.errors ?? 0;
      pipelineResult.value = {
        isError: totalErrors > 0,
        title: 'Signal Processing Complete',
        message: response.content.message,
        details: [
          `Targets processed: ${response.content.targetsProcessed ?? 1}`,
          `Signals processed: ${response.content.totalProcessed ?? response.content.processed ?? 0}`,
          `Predictors created: ${response.content.totalPredictorsCreated ?? response.content.predictorsCreated ?? 0}`,
          `Rejected: ${response.content.totalRejected ?? response.content.rejected ?? 0}`,
          `Errors: ${totalErrors}`,
        ],
      };
    }
  } catch (err) {
    pipelineResult.value = {
      isError: true,
      title: 'Signal Processing Failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    pipelineInProgress.value = null;
  }
}

async function handleGenerateAllPredictions() {
  if (!portfolioId.value) return;

  pipelineInProgress.value = 'predictions';
  pipelineResult.value = null;

  try {
    const response = await predictionDashboardService.generatePredictions({
      universeId: portfolioId.value,
    });

    if (response.content) {
      pipelineResult.value = {
        isError: response.content.errors > 0,
        title: 'Prediction Generation Complete',
        message: response.content.message,
        details: [
          `Predictions generated: ${response.content.generated}`,
          `Skipped (threshold not met): ${response.content.skipped}`,
          `Errors: ${response.content.errors}`,
        ],
      };

      // Reload predictions after generation
      await loadPortfolioData();
    }
  } catch (err) {
    pipelineResult.value = {
      isError: true,
      title: 'Prediction Generation Failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    pipelineInProgress.value = null;
  }
}

async function handleRunFullPipeline() {
  if (!portfolioId.value) return;

  pipelineInProgress.value = 'full';
  pipelineResult.value = null;

  try {
    const result = await predictionDashboardService.runFullPipeline({
      universeId: portfolioId.value,
      batchSize: 50,
    });

    pipelineResult.value = {
      isError: !result.success,
      title: result.success ? 'Pipeline Complete' : 'Pipeline Completed with Errors',
      message: result.summary,
      details: [
        `Step 1 (Crawl): ${result.crawlResult.message}`,
        `Step 2 (Signals): ${result.processResult.message}`,
        `Step 3 (Predictions): ${result.generateResult.message}`,
      ],
    };

    // Reload data after full pipeline
    await loadPortfolioData();
  } catch (err) {
    pipelineResult.value = {
      isError: true,
      title: 'Pipeline Failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    pipelineInProgress.value = null;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncateUrl(url: string | undefined): string {
  if (!url) return '-';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 30
      ? parsed.pathname.substring(0, 30) + '...'
      : parsed.pathname;
    return parsed.hostname + path;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

watch(portfolioId, () => {
  loadPortfolioData();
});

onMounted(() => {
  loadPortfolioData();
});
</script>

<style scoped>
.portfolio-detail {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: 1.5rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  background: none;
  border: none;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.back-button:hover {
  color: var(--primary-color, #3b82f6);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 0.75rem;
}

.header-info h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.domain-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.inactive-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.description {
  margin: 0.5rem 0 0 0;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: var(--primary-color, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background-color: var(--btn-secondary-hover, #e5e7eb);
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-secondary, #6b7280);
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  color: var(--text-primary, #111827);
}

.btn-icon.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 3rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p,
.empty-message p {
  margin: 0;
  text-align: center;
}

.empty-message {
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  text-align: center;
  padding: 2rem;
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  margin-bottom: 1.5rem;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  color: var(--text-primary, #111827);
}

.tab-button.active {
  color: var(--primary-color, #3b82f6);
  border-bottom-color: var(--primary-color, #3b82f6);
}

.tab-icon {
  font-size: 1rem;
}

.tab-count {
  font-size: 0.75rem;
  background-color: var(--btn-secondary-bg, #f3f4f6);
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
}

.tab-button.active .tab-count {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color, #3b82f6);
}

/* Overview Grid */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.25rem;
}

.info-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.item-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.item-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.item-value.active {
  color: #16a34a;
}

.item-value.inactive {
  color: #ef4444;
}

/* LLM Tiers */
.llm-tiers {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.llm-tier {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  background: var(--btn-secondary-bg, #f3f4f6);
}

.tier-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  min-width: 48px;
  text-align: center;
}

.tier-badge.gold, .llm-tier.gold .tier-badge {
  background-color: #fef3c7;
  color: #92400e;
}

.tier-badge.silver, .llm-tier.silver .tier-badge {
  background-color: #e5e7eb;
  color: #374151;
}

.tier-badge.bronze, .llm-tier.bronze .tier-badge {
  background-color: #fed7aa;
  color: #9a3412;
}

.tier-model {
  font-size: 0.8125rem;
  color: var(--text-primary, #111827);
  font-family: 'SF Mono', Monaco, monospace;
}

.empty-config {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  font-style: italic;
}

/* Thresholds */
.threshold-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.threshold-item {
  text-align: center;
}

.threshold-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color, #3b82f6);
}

.threshold-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

/* Notifications */
.notification-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
}

.toggle-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #e5e7eb;
}

.toggle-indicator.enabled {
  background-color: #22c55e;
}

.notification-channels {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.channels-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.channel-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.no-channels {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-style: italic;
}

/* Quick Stats */
.quick-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.stat-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

/* Pipeline Actions */
.pipeline-actions-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.25rem;
  margin-top: 1.5rem;
}

.pipeline-actions-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.pipeline-description {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 1rem 0;
}

.pipeline-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background-color: var(--btn-secondary-bg, #f3f4f6);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover:not(:disabled) {
  background-color: var(--btn-secondary-hover, #e5e7eb);
  border-color: var(--primary-color, #3b82f6);
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-full-pipeline {
  background-color: var(--primary-color, #3b82f6);
  color: white;
  border-color: var(--primary-color, #3b82f6);
}

.btn-full-pipeline:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-full-pipeline .action-icon {
  background-color: rgba(255, 255, 255, 0.2);
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.btn-full-pipeline .spinner-small {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: white;
}

.pipeline-result {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  padding: 1rem;
}

.pipeline-result.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: #22c55e;
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.pipeline-result.error .result-icon {
  background-color: #ef4444;
}

.result-message {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  padding-left: 1.75rem;
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

/* Targets Table */
.targets-table {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: auto;
  max-height: 500px;
}

.targets-table table {
  width: 100%;
  border-collapse: collapse;
}

.targets-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  background: var(--btn-secondary-bg, #f3f4f6);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  position: sticky;
  top: 0;
  z-index: 1;
}

.targets-table td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.targets-table tr {
  cursor: pointer;
  transition: background-color 0.2s;
}

.targets-table tr:hover {
  background-color: var(--btn-secondary-bg, #f3f4f6);
}

.targets-table tr.inactive {
  opacity: 0.6;
}

.targets-table tr:last-child td {
  border-bottom: none;
}

.symbol-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.symbol {
  font-weight: 600;
}

.test-indicator {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  background-color: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-badge.active {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-badge.inactive {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.actions-cell {
  display: flex;
  gap: 0.25rem;
}

/* Predictions Grid */
.predictions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.modal.modal-sm {
  max-width: 400px;
}

.modal.modal-lg {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  color: var(--text-primary, #111827);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

/* Settings Tabs */
.settings-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.settings-tab {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-tab:hover {
  color: var(--text-primary, #111827);
}

.settings-tab.active {
  color: var(--primary-color, #3b82f6);
  border-bottom-color: var(--primary-color, #3b82f6);
}

.settings-panel {
  min-height: 200px;
}

.settings-description {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 1.5rem 0;
}

.llm-config-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.llm-tier-config h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
}

/* Form */
.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  margin-bottom: 0.375rem;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  background-color: var(--input-bg, #ffffff);
  color: var(--text-primary, #111827);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.form-group input:disabled {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  cursor: not-allowed;
}

.form-group.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group.checkbox input {
  width: auto;
}

.form-group.checkbox label {
  margin-bottom: 0;
  font-weight: 400;
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

.channel-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
}

.channel-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.channel-toggle input {
  width: auto;
}

.warning {
  color: #ef4444;
  font-size: 0.875rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .portfolio-detail {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --input-bg: #374151;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
  }
}

/* Sources Table */
.sources-table {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: auto;
  max-height: 400px;
}

.sources-table table {
  width: 100%;
  border-collapse: collapse;
}

.sources-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  background: var(--btn-secondary-bg, #f3f4f6);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  position: sticky;
  top: 0;
  z-index: 1;
}

.sources-table td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.sources-table tr.inactive {
  opacity: 0.6;
}

.sources-table tr:last-child td {
  border-bottom: none;
}

.source-name {
  font-weight: 500;
}

.source-url-cell {
  max-width: 200px;
}

.source-url-cell a {
  color: var(--primary-color, #3b82f6);
  text-decoration: none;
  font-size: 0.8125rem;
  font-family: 'SF Mono', Monaco, monospace;
}

.source-url-cell a:hover {
  text-decoration: underline;
}

.type-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.last-crawl {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
}

.no-crawl {
  font-size: 0.8125rem;
  color: var(--text-secondary, #9ca3af);
  font-style: italic;
}

/* Source Setup Guide */
.source-guide {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
}

.source-guide h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
}

.source-guide ul {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
}

.source-guide li {
  margin-bottom: 0.375rem;
}

.source-guide li strong {
  color: var(--text-primary, #111827);
}

.guide-note {
  margin: 0.75rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  font-style: italic;
}

/* Empty content styling */
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
}

.empty-content h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-primary, #111827);
}

.empty-content p {
  margin: 0;
  text-align: center;
  max-width: 400px;
}

/* Responsive */
@media (max-width: 768px) {
  .quick-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
  }

  .sources-table {
    overflow-x: auto;
  }
}
</style>
