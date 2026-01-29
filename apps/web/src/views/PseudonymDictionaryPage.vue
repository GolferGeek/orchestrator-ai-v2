<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Pseudonym Dictionary Management</h2>
    </div>

    <div class="detail-body">
      <div class="pseudonym-dictionary-container">
        <PseudonymDictionaryManager />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PseudonymDictionaryManager from '@/components/PII/PseudonymDictionaryManager.vue';
</script>

<style scoped>
/* Detail View Container */
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
}

.pseudonym-dictionary-container {
  padding: 1rem;
  height: 100%;
}
</style>
