<template>
  <button
    v-if="isVisible"
    class="super-admin-command-btn"
    :class="{ 'pulse': !hasOpened }"
    @click="handleClick"
    title="Claude Code Panel (Super Admin)"
  >
    <ion-icon :icon="terminalOutline" />
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { terminalOutline } from 'ionicons/icons';
import { useRbacStore } from '@/stores/rbacStore';
import { isDevMode } from '@/utils/devMode';

const emit = defineEmits<{
  (e: 'open'): void;
}>();

const rbacStore = useRbacStore();
const hasOpened = ref(false);

const isVisible = computed(() => {
  return rbacStore.isSuperAdmin && isDevMode();
});

function handleClick() {
  hasOpened.value = true;
  emit('open');
}
</script>

<style scoped>
.super-admin-command-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.super-admin-command-btn:hover {
  background: var(--ion-color-primary-shade);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.super-admin-command-btn:active {
  transform: scale(0.95);
}

.super-admin-command-btn ion-icon {
  font-size: 20px;
}

.super-admin-command-btn.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--ion-color-primary-rgb), 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--ion-color-primary-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--ion-color-primary-rgb), 0);
  }
}
</style>
