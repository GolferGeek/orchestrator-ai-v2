<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>PII Detection Testing</h2>
    </div>

    <div class="detail-body">
      <div class="pii-testing-container">
        <PIITestingInterface />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PIITestingInterface from '@/components/PII/PIITestingInterface.vue';
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

.pii-testing-container {
  padding: 1rem;
  height: 100%;
}
</style>
