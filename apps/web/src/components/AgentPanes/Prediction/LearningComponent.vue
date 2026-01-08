<template>
  <div class="learning-component">
    <div class="learning-header">
      <h3>Learning Loop</h3>
      <div class="header-actions">
        <button
          class="apply-learnings-btn"
          :disabled="unappliedCount === 0 || isApplying"
          @click="applyAllLearnings"
        >
          {{ isApplying ? 'Applying...' : `Apply ${unappliedCount} Learnings` }}
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading learning data...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠</span>
      <span>{{ error }}</span>
    </div>

    <div v-else class="learning-content">
      <!-- Learning Summary Stats -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-value">{{ summary.overallAccuracyPercent?.toFixed(1) || 'N/A' }}%</div>
          <div class="stat-label">Overall Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ summary.totalRecommendations }}</div>
          <div class="stat-label">Total Recommendations</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ summary.totalPostmortems }}</div>
          <div class="stat-label">Postmortems</div>
        </div>
        <div class="stat-card unapplied">
          <div class="stat-value">{{ unappliedCount }}</div>
          <div class="stat-label">Unapplied Learnings</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'postmortems' }]"
          @click="activeTab = 'postmortems'"
        >
          Postmortems ({{ postmortems.length }})
        </button>
        <button
          :class="['tab', { active: activeTab === 'missed' }]"
          @click="activeTab = 'missed'"
        >
          Missed Opportunities ({{ missedOpportunities.length }})
        </button>
        <button
          :class="['tab', { active: activeTab === 'insights' }]"
          @click="activeTab = 'insights'"
        >
          User Insights ({{ userInsights.length }})
        </button>
        <button
          :class="['tab', { active: activeTab === 'specialists' }]"
          @click="activeTab = 'specialists'"
        >
          Specialist Stats
        </button>
        <button
          :class="['tab', { active: activeTab === 'chat' }]"
          @click="activeTab = 'chat'"
        >
          Learning Chat
        </button>
      </div>

      <!-- Postmortems Tab -->
      <div v-if="activeTab === 'postmortems'" class="tab-content">
        <div v-if="postmortems.length === 0" class="empty-message">
          No postmortems yet. Postmortems are created when predictions have outcomes.
        </div>
        <div v-else class="postmortems-list">
          <div
            v-for="pm in postmortems"
            :key="pm.id"
            :class="['postmortem-card', { applied: pm.appliedToContext }]"
          >
            <div class="pm-header">
              <span class="pm-instrument">{{ pm.instrument }}</span>
              <span :class="['pm-outcome', pm.outcome]">{{ pm.outcome }}</span>
              <span v-if="pm.appliedToContext" class="applied-badge">Applied</span>
            </div>
            <div class="pm-details">
              <div v-if="pm.returnPercent !== null" class="pm-return">
                Return: {{ pm.returnPercent.toFixed(2) }}%
              </div>
              <div v-if="pm.rootCause" class="pm-root-cause">
                <strong>Root Cause:</strong> {{ pm.rootCause }}
              </div>
            </div>
            <div v-if="pm.keyLearnings.length > 0" class="pm-learnings">
              <strong>Key Learnings:</strong>
              <ul>
                <li v-for="(learning, idx) in pm.keyLearnings" :key="idx">
                  {{ learning }}
                </li>
              </ul>
            </div>
            <div class="pm-actions">
              <button
                v-if="!pm.appliedToContext"
                class="apply-btn"
                @click="applyPostmortem(pm.id)"
              >
                Apply Learning
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Missed Opportunities Tab -->
      <div v-if="activeTab === 'missed'" class="tab-content">
        <div v-if="missedOpportunities.length === 0" class="empty-message">
          No missed opportunities detected yet.
        </div>
        <div v-else class="missed-list">
          <div
            v-for="mo in missedOpportunities"
            :key="mo.id"
            :class="['missed-card', { applied: mo.appliedToContext }]"
          >
            <div class="mo-header">
              <span class="mo-instrument">{{ mo.instrument }}</span>
              <span :class="['mo-move', mo.movePercent > 0 ? 'positive' : 'negative']">
                {{ mo.movePercent > 0 ? '+' : '' }}{{ mo.movePercent.toFixed(2) }}%
              </span>
              <span v-if="mo.appliedToContext" class="applied-badge">Applied</span>
            </div>
            <div class="mo-details">
              <div class="mo-description">{{ mo.description }}</div>
              <div class="mo-reason">
                <strong>Reason Missed:</strong> {{ mo.failureReason.replace(/_/g, ' ') }}
              </div>
            </div>
            <div v-if="mo.whatWouldHaveHelped.length > 0" class="mo-suggestions">
              <strong>What Would Have Helped:</strong>
              <ul>
                <li v-for="(help, idx) in mo.whatWouldHaveHelped" :key="idx">
                  {{ help }}
                </li>
              </ul>
            </div>
            <div
              v-if="Object.keys(mo.suggestedThresholds).length > 0"
              class="mo-thresholds"
            >
              <strong>Suggested Threshold Changes:</strong>
              <div class="threshold-changes">
                <span
                  v-for="(value, key) in mo.suggestedThresholds"
                  :key="key"
                  class="threshold-chip"
                >
                  {{ key }}: {{ value }}
                </span>
              </div>
            </div>
            <div class="mo-actions">
              <button
                v-if="!mo.appliedToContext"
                class="apply-btn"
                @click="applyMissedOpportunity(mo.id)"
              >
                Apply Thresholds
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- User Insights Tab -->
      <div v-if="activeTab === 'insights'" class="tab-content">
        <div v-if="userInsights.length === 0" class="empty-message">
          No user insights yet. Start a learning conversation to add insights.
        </div>
        <div v-else class="insights-list">
          <div
            v-for="insight in userInsights"
            :key="insight.id"
            :class="['insight-card', { applied: insight.appliedToContext }]"
          >
            <div class="insight-header">
              <span class="insight-type">{{ insight.type.replace(/_/g, ' ') }}</span>
              <span v-if="insight.instrument" class="insight-instrument">
                {{ insight.instrument }}
              </span>
              <span v-if="insight.appliedToContext" class="applied-badge">Applied</span>
            </div>
            <div class="insight-content">{{ insight.insight }}</div>
            <div v-if="insight.effectivenessScore !== null" class="insight-effectiveness">
              Effectiveness: {{ (insight.effectivenessScore * 100).toFixed(0) }}%
            </div>
            <div class="insight-actions">
              <button
                v-if="!insight.appliedToContext"
                class="apply-btn"
                @click="applyUserInsight(insight.id)"
              >
                Apply Insight
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Specialist Stats Tab -->
      <div v-if="activeTab === 'specialists'" class="tab-content">
        <div v-if="specialistStats.length === 0" class="empty-message">
          No specialist statistics available yet.
        </div>
        <div v-else class="specialists-table-wrapper">
          <table class="specialists-table">
            <thead>
              <tr>
                <th>Specialist</th>
                <th>Instrument</th>
                <th>Accuracy</th>
                <th>Analyses</th>
                <th>Avg Confidence</th>
                <th>Conf. When Correct</th>
                <th>Conf. When Incorrect</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in specialistStats" :key="`${stat.specialist}-${stat.instrument}`">
                <td>{{ stat.specialist }}</td>
                <td>{{ stat.instrument || 'All' }}</td>
                <td :class="getAccuracyClass(stat.accuracyPercent)">
                  {{ stat.accuracyPercent?.toFixed(1) || 'N/A' }}%
                </td>
                <td>{{ stat.totalAnalyses }}</td>
                <td>{{ (stat.avgConfidence * 100)?.toFixed(0) || 'N/A' }}%</td>
                <td>{{ (stat.confidenceWhenCorrect * 100)?.toFixed(0) || 'N/A' }}%</td>
                <td>{{ (stat.confidenceWhenIncorrect * 100)?.toFixed(0) || 'N/A' }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Learning Chat Tab -->
      <div v-if="activeTab === 'chat'" class="tab-content chat-tab">
        <div class="chat-container">
          <div class="chat-messages" ref="chatMessagesRef">
            <div v-if="!activeConversation" class="start-chat-prompt">
              <p>Start a learning conversation to discuss predictions, provide feedback, or improve the agent.</p>
              <div class="chat-focus-options">
                <button class="focus-btn" @click="startConversation('general')">
                  General Discussion
                </button>
                <button class="focus-btn" @click="startConversation('performance_review')">
                  Performance Review
                </button>
                <button class="focus-btn" @click="startConversation('threshold_tuning')">
                  Tune Thresholds
                </button>
              </div>
            </div>
            <div v-else class="messages-list">
              <div
                v-for="(msg, idx) in activeConversation.messages"
                :key="idx"
                :class="['message', msg.role]"
              >
                <div class="message-content">{{ msg.content }}</div>
                <div class="message-timestamp">{{ formatTimestamp(msg.timestamp) }}</div>
              </div>
            </div>
          </div>
          <div v-if="activeConversation" class="chat-input-container">
            <textarea
              v-model="chatInput"
              placeholder="Share insights, ask questions, or provide feedback..."
              @keydown.enter.exact.prevent="sendMessage"
              :disabled="isSendingMessage"
            ></textarea>
            <button
              class="send-btn"
              :disabled="!chatInput.trim() || isSendingMessage"
              @click="sendMessage"
            >
              {{ isSendingMessage ? 'Sending...' : 'Send' }}
            </button>
          </div>
          <div v-if="activeConversation" class="chat-actions">
            <button class="end-chat-btn" @click="endConversation">
              End Conversation
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import { predictionLearningService } from '@/services/predictionLearningService';

interface PostmortemSummary {
  id: string;
  instrument: string;
  action: string;
  outcome: string;
  returnPercent: number | null;
  rootCause: string | null;
  keyLearnings: string[];
  appliedToContext: boolean;
}

interface MissedOpportunitySummary {
  id: string;
  instrument: string;
  movePercent: number;
  description: string;
  failureReason: string;
  whatWouldHaveHelped: string[];
  suggestedThresholds: Record<string, number>;
  appliedToContext: boolean;
}

interface UserInsightSummary {
  id: string;
  type: string;
  instrument: string | null;
  insight: string;
  effectivenessScore: number | null;
  appliedToContext: boolean;
}

interface SpecialistStat {
  specialist: string;
  instrument: string | null;
  accuracyPercent: number | null;
  avgConfidence: number;
  totalAnalyses: number;
  confidenceWhenCorrect: number | null;
  confidenceWhenIncorrect: number | null;
}

interface LearningSummary {
  totalRecommendations: number;
  totalOutcomes: number;
  overallAccuracyPercent: number | null;
  totalPostmortems: number;
  unappliedPostmortems: number;
  totalMissedOpportunities: number;
  unappliedMissedOpportunities: number;
  totalUserInsights: number;
  validatedInsights: number;
  unappliedInsights: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface LearningConversation {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  focusType: string;
  messages: ConversationMessage[];
}

const store = usePredictionAgentStore();

const activeTab = ref<'postmortems' | 'missed' | 'insights' | 'specialists' | 'chat'>('postmortems');
const isLoading = ref(false);
const isApplying = ref(false);
const isSendingMessage = ref(false);
const error = ref<string | null>(null);

const summary = ref<LearningSummary>({
  totalRecommendations: 0,
  totalOutcomes: 0,
  overallAccuracyPercent: null,
  totalPostmortems: 0,
  unappliedPostmortems: 0,
  totalMissedOpportunities: 0,
  unappliedMissedOpportunities: 0,
  totalUserInsights: 0,
  validatedInsights: 0,
  unappliedInsights: 0,
});

const postmortems = ref<PostmortemSummary[]>([]);
const missedOpportunities = ref<MissedOpportunitySummary[]>([]);
const userInsights = ref<UserInsightSummary[]>([]);
const specialistStats = ref<SpecialistStat[]>([]);
const activeConversation = ref<LearningConversation | null>(null);
const chatInput = ref('');
const chatMessagesRef = ref<HTMLElement | null>(null);

const unappliedCount = computed(() =>
  summary.value.unappliedPostmortems +
  summary.value.unappliedMissedOpportunities +
  summary.value.unappliedInsights
);

onMounted(async () => {
  await loadLearningData();
});

async function loadLearningData() {
  if (!store.agentId) return;

  isLoading.value = true;
  error.value = null;

  try {
    const [summaryData, postmortemData, missedData, insightData, statsData] =
      await Promise.all([
        predictionLearningService.getLearningSummary(store.agentId),
        predictionLearningService.getPostmortems(store.agentId),
        predictionLearningService.getMissedOpportunities(store.agentId),
        predictionLearningService.getUserInsights(store.agentId),
        predictionLearningService.getSpecialistStats(store.agentId),
      ]);

    summary.value = summaryData;
    postmortems.value = postmortemData;
    missedOpportunities.value = missedData;
    userInsights.value = insightData;
    specialistStats.value = statsData;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load learning data';
  } finally {
    isLoading.value = false;
  }
}

async function applyAllLearnings() {
  if (!store.agentId) return;

  isApplying.value = true;
  try {
    await predictionLearningService.applyAllLearnings(store.agentId);
    await loadLearningData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to apply learnings';
  } finally {
    isApplying.value = false;
  }
}

async function applyPostmortem(postmortemId: string) {
  if (!store.agentId) return;

  try {
    await predictionLearningService.applyPostmortem(store.agentId, postmortemId);
    await loadLearningData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to apply postmortem';
  }
}

async function applyMissedOpportunity(opportunityId: string) {
  if (!store.agentId) return;

  try {
    await predictionLearningService.applyMissedOpportunity(store.agentId, opportunityId);
    await loadLearningData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to apply threshold changes';
  }
}

async function applyUserInsight(insightId: string) {
  if (!store.agentId) return;

  try {
    await predictionLearningService.applyUserInsight(store.agentId, insightId);
    await loadLearningData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to apply insight';
  }
}

async function startConversation(focusType: string) {
  if (!store.agentId) return;

  try {
    const conversation = await predictionLearningService.startConversation(
      store.agentId,
      focusType
    );
    activeConversation.value = conversation;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start conversation';
  }
}

async function sendMessage() {
  if (!activeConversation.value || !chatInput.value.trim()) return;

  const message = chatInput.value.trim();
  chatInput.value = '';
  isSendingMessage.value = true;

  try {
    const response = await predictionLearningService.sendMessage(
      activeConversation.value.id,
      message
    );

    // Add user message
    activeConversation.value.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Add assistant response
    activeConversation.value.messages.push({
      role: 'assistant',
      content: response.response,
      timestamp: new Date().toISOString(),
    });

    // Scroll to bottom
    await nextTick();
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    }

    // If there was a context update suggestion, refresh data
    if (response.shouldApplyUpdate) {
      await loadLearningData();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send message';
  } finally {
    isSendingMessage.value = false;
  }
}

async function endConversation() {
  if (!activeConversation.value) return;

  try {
    await predictionLearningService.endConversation(activeConversation.value.id);
    activeConversation.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to end conversation';
  }
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function getAccuracyClass(accuracy: number | null): string {
  if (accuracy === null) return '';
  if (accuracy >= 70) return 'accuracy-high';
  if (accuracy >= 50) return 'accuracy-medium';
  return 'accuracy-low';
}
</script>

<style scoped>
.learning-component {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.learning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.learning-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.apply-learnings-btn {
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.apply-learnings-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.apply-learnings-btn:hover:not(:disabled) {
  background-color: #059669;
}

.loading-state,
.error-state,
.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  color: #6b7280;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  background-color: #fef2f2;
  color: #991b1b;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  text-align: center;
}

.stat-card.unapplied {
  background-color: #fef3c7;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  overflow-x: auto;
}

.tab {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab:hover:not(.active) {
  color: #374151;
}

.tab-content {
  min-height: 300px;
}

.postmortems-list,
.missed-list,
.insights-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.postmortem-card,
.missed-card,
.insight-card {
  padding: 1rem;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.postmortem-card.applied,
.missed-card.applied,
.insight-card.applied {
  opacity: 0.7;
  background-color: #f0fdf4;
}

.pm-header,
.mo-header,
.insight-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.pm-instrument,
.mo-instrument,
.insight-instrument {
  font-weight: 600;
  color: #111827;
}

.pm-outcome {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.pm-outcome.correct {
  background-color: #d1fae5;
  color: #065f46;
}

.pm-outcome.incorrect {
  background-color: #fee2e2;
  color: #991b1b;
}

.pm-outcome.partial {
  background-color: #fef3c7;
  color: #92400e;
}

.mo-move {
  font-weight: 600;
}

.mo-move.positive {
  color: #059669;
}

.mo-move.negative {
  color: #dc2626;
}

.applied-badge {
  padding: 0.125rem 0.5rem;
  background-color: #d1fae5;
  color: #065f46;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.insight-type {
  padding: 0.125rem 0.5rem;
  background-color: #e0e7ff;
  color: #3730a3;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.pm-details,
.mo-details {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
}

.pm-learnings ul,
.mo-suggestions ul {
  margin: 0.5rem 0 0 1.5rem;
  padding: 0;
}

.pm-learnings li,
.mo-suggestions li {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: #374151;
}

.threshold-changes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.threshold-chip {
  padding: 0.25rem 0.5rem;
  background-color: #fef3c7;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-family: monospace;
}

.pm-actions,
.mo-actions,
.insight-actions {
  margin-top: 0.75rem;
}

.apply-btn {
  padding: 0.375rem 0.75rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}

.apply-btn:hover {
  background-color: #2563eb;
}

.insight-content {
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: #374151;
}

.insight-effectiveness {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.specialists-table-wrapper {
  overflow-x: auto;
}

.specialists-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.specialists-table th,
.specialists-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.specialists-table th {
  font-weight: 600;
  color: #374151;
  background-color: #f9fafb;
}

.accuracy-high {
  color: #059669;
  font-weight: 600;
}

.accuracy-medium {
  color: #d97706;
  font-weight: 600;
}

.accuracy-low {
  color: #dc2626;
  font-weight: 600;
}

.chat-tab {
  display: flex;
  flex-direction: column;
  height: 400px;
}

.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.start-chat-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #6b7280;
}

.chat-focus-options {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.focus-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.focus-btn:hover {
  background-color: #2563eb;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message {
  max-width: 80%;
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.message.user {
  align-self: flex-end;
  background-color: #3b82f6;
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background-color: white;
  border: 1px solid #e5e7eb;
}

.message-content {
  font-size: 0.875rem;
  line-height: 1.5;
}

.message-timestamp {
  font-size: 0.625rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.chat-input-container {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #e5e7eb;
}

.chat-input-container textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  resize: none;
  min-height: 2.5rem;
  max-height: 6rem;
}

.send-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.send-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.chat-actions {
  padding: 0.5rem 1rem;
  background-color: white;
  border-top: 1px solid #e5e7eb;
}

.end-chat-btn {
  padding: 0.375rem 0.75rem;
  background-color: #6b7280;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.end-chat-btn:hover {
  background-color: #4b5563;
}
</style>
