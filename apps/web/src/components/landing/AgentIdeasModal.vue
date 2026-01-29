<template>
  <ion-modal
    :is-open="store.isOpen"
    @did-dismiss="store.closeModal"
    :backdrop-dismiss="true"
    class="agent-ideas-modal"
  >
    <div class="modal-content">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <ion-button
            v-if="canGoBack"
            fill="clear"
            @click="goBack"
            class="back-button"
          >
            <ion-icon :icon="arrowBackOutline"></ion-icon>
          </ion-button>
          <h2>{{ headerTitle }}</h2>
        </div>
        <ion-button
          fill="clear"
          @click="store.closeModal"
          class="close-button"
        >
          <ion-icon :icon="closeOutline"></ion-icon>
        </ion-button>
      </div>

      <!-- Step 1: Industry Input -->
      <div v-if="store.currentStep === 'industry'" class="step-content">
        <div class="industry-step">
          <p class="step-description">
            Tell us about your business and we'll suggest AI agents that could save you time and money.
          </p>

          <div class="input-group">
            <label for="industry-input">What's your business or industry?</label>
            <input
              id="industry-input"
              v-model="industryInputValue"
              type="text"
              placeholder="e.g., dental practice, real estate, accounting firm..."
              class="industry-input"
              @keyup.enter="handleGetRecommendations"
              :disabled="store.isLoading"
            />
          </div>

          <div v-if="store.error" class="error-message">
            {{ store.error }}
          </div>

          <ion-button
            expand="block"
            class="primary-button"
            :disabled="!industryInputValue.trim() || store.isLoading"
            @click="handleGetRecommendations"
          >
            <ion-spinner v-if="store.isLoading" name="crescent" class="button-spinner"></ion-spinner>
            <span v-else>Get Recommendations</span>
          </ion-button>

          <p v-if="store.isLoading" class="loading-text">
            Analyzing your industry...
          </p>
        </div>
      </div>

      <!-- Step 2: Recommendations -->
      <div v-else-if="store.currentStep === 'recommendations'" class="step-content">
        <div class="recommendations-step">
          <div class="industry-banner" v-if="store.normalizedIndustry">
            <span class="industry-label">Recommendations for:</span>
            <span class="industry-name">{{ store.normalizedIndustry }}</span>
            <span v-if="store.isFallback" class="fallback-badge">General</span>
          </div>

          <p v-if="store.isFallback" class="fallback-notice">
            Showing general recommendations. These can be customized for your specific business.
          </p>

          <div class="selection-actions">
            <span class="selection-count">{{ store.selectedCount }} selected</span>
            <div class="action-buttons">
              <ion-button fill="clear" size="small" @click="store.selectAllAgents">
                Select All
              </ion-button>
              <ion-button fill="clear" size="small" @click="store.deselectAllAgents">
                Clear
              </ion-button>
            </div>
          </div>

          <div class="recommendations-grid">
            <div
              v-for="agent in store.recommendations"
              :key="agent.name"
              class="agent-card"
              :class="{ selected: store.selectedAgentNames.has(agent.name) }"
              @click="store.toggleAgentSelection(agent.name)"
            >
              <div class="card-header">
                <div class="card-checkbox">
                  <ion-icon
                    :icon="store.selectedAgentNames.has(agent.name) ? checkboxOutline : squareOutline"
                  ></ion-icon>
                </div>
                <span class="category-badge">{{ agent.category }}</span>
              </div>

              <h3 class="agent-name">{{ agent.name }}</h3>
              <p class="agent-tagline">{{ agent.tagline }}</p>

              <div class="time-saved">
                <ion-icon :icon="timeOutline"></ion-icon>
                <span>{{ agent.time_saved }}</span>
              </div>

              <div class="expandable-content">
                <p class="agent-description">{{ agent.description }}</p>

                <div class="use-case">
                  <strong>Example:</strong> {{ agent.use_case_example }}
                </div>

                <div class="wow-factor">
                  <ion-icon :icon="sparklesOutline"></ion-icon>
                  <span>{{ agent.wow_factor }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="store.error" class="error-message">
            {{ store.error }}
          </div>

          <ion-button
            expand="block"
            class="primary-button"
            :disabled="!store.hasSelections"
            @click="store.goToStep('contact')"
          >
            I Want These Built For Me ({{ store.selectedCount }})
          </ion-button>
        </div>
      </div>

      <!-- Step 3: Contact Form -->
      <div v-else-if="store.currentStep === 'contact'" class="step-content">
        <div class="contact-step">
          <p class="step-description">
            We'll build demo agents for you to try! Enter your email and we'll notify you when your custom agent demos are ready.
          </p>

          <div class="selected-summary">
            <strong>Selected agents ({{ store.selectedCount }}):</strong>
            <ul>
              <li v-for="agent in store.selectedAgents" :key="agent.name">
                {{ agent.name }}
              </li>
            </ul>
          </div>

          <form @submit.prevent="handleSubmit" class="contact-form">
            <div class="input-group">
              <label for="email">Email *</label>
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="you@company.com"
                required
                :disabled="store.isLoading"
              />
            </div>

            <div class="input-group">
              <label for="name">Name</label>
              <input
                id="name"
                v-model="name"
                type="text"
                placeholder="Your name"
                :disabled="store.isLoading"
              />
            </div>

            <div class="input-group">
              <label for="company">Company</label>
              <input
                id="company"
                v-model="company"
                type="text"
                placeholder="Your company"
                :disabled="store.isLoading"
              />
            </div>

            <div class="input-group">
              <label for="phone">Phone</label>
              <input
                id="phone"
                v-model="phone"
                type="tel"
                placeholder="Your phone number"
                :disabled="store.isLoading"
              />
            </div>

            <p class="privacy-note">
              We'll only contact you about your agent demos. No spam, ever.
            </p>

            <div v-if="store.error" class="error-message">
              {{ store.error }}
            </div>

            <ion-button
              expand="block"
              type="submit"
              class="primary-button"
              :disabled="!email || store.isLoading"
            >
              <ion-spinner v-if="store.isLoading" name="crescent" class="button-spinner"></ion-spinner>
              <span v-else>Request My Demo Agents</span>
            </ion-button>
          </form>
        </div>
      </div>

      <!-- Step 4: Success -->
      <div v-else-if="store.currentStep === 'success'" class="step-content">
        <div class="success-step">
          <div class="success-icon">
            <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
          </div>

          <h3>We're on it!</h3>

          <p class="success-message">
            We'll build these agents and email you when they're ready to try.
          </p>

          <div class="success-agents">
            <strong>Your requested agents:</strong>
            <ul>
              <li v-for="agent in store.selectedAgents" :key="agent.name">
                {{ agent.name }}
              </li>
            </ul>
          </div>

          <ion-button
            expand="block"
            class="primary-button"
            @click="store.closeModal"
          >
            Close
          </ion-button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonModal, IonButton, IonIcon, IonSpinner } from '@ionic/vue';
import {
  closeOutline,
  arrowBackOutline,
  checkboxOutline,
  squareOutline,
  timeOutline,
  sparklesOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { useAgentIdeasStore } from '@/stores/agentIdeasStore';

const store = useAgentIdeasStore();

// Form state
const industryInputValue = ref('');
const email = ref('');
const name = ref('');
const company = ref('');
const phone = ref('');

// Computed
const headerTitle = computed(() => {
  switch (store.currentStep) {
    case 'industry':
      return 'How can agents help you?';
    case 'recommendations':
      return 'Select Your Agents';
    case 'contact':
      return 'Get Your Demo Agents';
    case 'success':
      return 'Request Submitted';
    default:
      return '';
  }
});

const canGoBack = computed(() => {
  return store.currentStep === 'recommendations' || store.currentStep === 'contact';
});

// Actions
function goBack() {
  if (store.currentStep === 'contact') {
    store.goToStep('recommendations');
  } else if (store.currentStep === 'recommendations') {
    store.goToStep('industry');
  }
}

async function handleGetRecommendations() {
  if (!industryInputValue.value.trim()) return;

  try {
    await store.fetchRecommendations(industryInputValue.value.trim());
  } catch {
    // Error is already set in store
  }
}

async function handleSubmit() {
  if (!email.value) return;

  try {
    await store.submitInterest({
      email: email.value,
      name: name.value || undefined,
      company: company.value || undefined,
      phone: phone.value || undefined,
    });
  } catch {
    // Error is already set in store
  }
}
</script>

<style scoped>
.agent-ideas-modal {
  --width: 90%;
  --max-width: 900px;
  --height: 90%;
  --max-height: 700px;
  --border-radius: 16px;
}

.modal-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 16px;
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: var(--landing-gradient);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.back-button,
.close-button {
  --color: white;
  --background: rgba(255, 255, 255, 0.1);
  --border-radius: 50%;
  width: 44px;
  height: 44px;
  transition: all 0.3s ease;
}

.back-button ion-icon,
.close-button ion-icon {
  font-size: 24px;
}

.back-button:hover,
.close-button:hover {
  --background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

/* Step Content */
.step-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.step-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

/* Industry Step */
.industry-step {
  max-width: 500px;
  margin: 0 auto;
  padding-top: 2rem;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.input-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: white;
  color: #374151;
}

.input-group input:focus {
  outline: none;
  border-color: var(--landing-primary);
  box-shadow: 0 0 0 3px rgba(139, 90, 60, 0.1);
}

.input-group input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.loading-text {
  text-align: center;
  color: #6b7280;
  font-style: italic;
  margin-top: 1rem;
}

/* Recommendations Step */
.recommendations-step {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.industry-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f5f2;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.industry-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.industry-name {
  font-weight: 600;
  color: var(--landing-primary);
}

.fallback-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.fallback-notice {
  background: #fef3c7;
  color: #92400e;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.selection-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.selection-count {
  font-weight: 500;
  color: #374151;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-buttons ion-button {
  --color: var(--landing-primary);
  font-size: 0.875rem;
}

/* Agent Cards Grid */
.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.agent-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.agent-card:hover {
  border-color: var(--landing-primary);
  box-shadow: 0 4px 12px rgba(139, 90, 60, 0.1);
}

.agent-card.selected {
  border-color: var(--landing-primary);
  background: #fdf8f6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-checkbox ion-icon {
  font-size: 1.25rem;
  color: var(--landing-primary);
}

.category-badge {
  background: var(--landing-primary-50, #f8f5f2);
  color: var(--landing-primary);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.agent-name {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.agent-tagline {
  margin: 0 0 0.75rem 0;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.4;
}

.time-saved {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--landing-accent, #2d5a3d);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.time-saved ion-icon {
  font-size: 1rem;
}

.expandable-content {
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
}

.agent-description {
  margin: 0 0 0.75rem 0;
  color: #4b5563;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.use-case {
  background: #f9fafb;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #4b5563;
  margin-bottom: 0.75rem;
}

.use-case strong {
  color: #374151;
}

.wow-factor {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  color: #7c3aed;
  font-size: 0.8125rem;
}

.wow-factor ion-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

/* Contact Step */
.contact-step {
  max-width: 500px;
  margin: 0 auto;
}

.selected-summary {
  background: #f8f5f2;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.selected-summary strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
}

.selected-summary ul {
  margin: 0;
  padding-left: 1.25rem;
}

.selected-summary li {
  color: #6b7280;
  font-size: 0.875rem;
  padding: 0.125rem 0;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.privacy-note {
  color: #9ca3af;
  font-size: 0.75rem;
  margin: 0.5rem 0 1rem;
}

/* Success Step */
.success-step {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
  padding-top: 2rem;
}

.success-icon {
  margin-bottom: 1.5rem;
}

.success-icon ion-icon {
  font-size: 4rem;
  color: var(--landing-accent, #2d5a3d);
}

.success-step h3 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.success-message {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.success-agents {
  background: #f8f5f2;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  text-align: left;
}

.success-agents strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
}

.success-agents ul {
  margin: 0;
  padding-left: 1.25rem;
}

.success-agents li {
  color: #6b7280;
  font-size: 0.875rem;
  padding: 0.125rem 0;
}

/* Buttons */
.primary-button {
  --background: var(--landing-primary);
  --color: white;
  --border-radius: 8px;
  font-weight: 600;
  margin-top: 1rem;
}

.primary-button:disabled {
  --background: #d1d5db;
  --color: #9ca3af;
}

.button-spinner {
  width: 20px;
  height: 20px;
}

/* Error */
.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin: 1rem 0;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .agent-ideas-modal {
    --width: 100%;
    --height: 100%;
    --max-height: none;
    --border-radius: 0;
  }

  .modal-content {
    border-radius: 0;
  }

  .recommendations-grid {
    grid-template-columns: 1fr;
  }

  .modal-header h2 {
    font-size: 1.125rem;
  }

  .step-content {
    padding: 1rem;
  }
}
</style>
