/**
 * HITL (Human-in-the-Loop) Components
 *
 * Components for handling human approval workflows in LangGraph agents.
 *
 * Usage:
 * 1. Import the components and composable
 * 2. Use useHitl composable for state management
 * 3. Show HitlStatusBanner when an agent is awaiting review
 * 4. Use HitlApprovalModal for the review interface
 *
 * The HITL flow uses A2A transport types - calls go through the main API.
 */

export { default as HitlStatusBanner } from './HitlStatusBanner.vue';
export { default as HitlApprovalModal } from './HitlApprovalModal.vue';
export { default as HitlReviewModal } from './HitlReviewModal.vue';
export { default as HitlPendingCard } from './HitlPendingCard.vue';
export { default as HitlPendingList } from './HitlPendingList.vue';

// Re-export types from transport-types via service
export type {
  HitlStatus,
  HitlDecision,
  HitlGeneratedContent,
} from '@/services/hitlService';

// Re-export the composable for convenience
export { useHitl } from '@/composables/useHitl';
export type { UseHitlOptions, UseHitlReturn } from '@/composables/useHitl';
