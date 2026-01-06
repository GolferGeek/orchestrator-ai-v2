<template>
  <div class="document-upload">
    <div class="upload-header">
      <h2>Legal Document Analysis</h2>
      <p>Upload a legal document to analyze for risks, obligations, and recommendations</p>
    </div>

    <!-- Drag-Drop Zone -->
    <div
      class="drop-zone"
      :class="{ 'drag-over': isDragging, 'has-file': uploadedFile }"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.docx,.doc,image/*"
        @change="handleFileSelect"
        hidden
      />

      <div v-if="!uploadedFile" class="drop-zone-content">
        <ion-icon :icon="cloudUploadOutline" class="upload-icon" />
        <p class="drop-text">Drag and drop your document here</p>
        <p class="or-text">or</p>
        <ion-button>Browse Files</ion-button>
        <p class="supported-formats">
          Supported formats: PDF, DOCX, Images (PNG, JPG)
        </p>
      </div>

      <div v-else class="uploaded-file-info">
        <ion-icon :icon="documentTextOutline" class="file-icon" />
        <div class="file-details">
          <h3>{{ uploadedFile.name }}</h3>
          <p>{{ formatFileSize(uploadedFile.size) }}</p>
        </div>
        <ion-button
          fill="clear"
          color="danger"
          @click.stop="removeFile"
        >
          <ion-icon :icon="closeCircleOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <!-- Upload Progress -->
    <div v-if="isUploading" class="upload-progress">
      <ion-progress-bar value="indeterminate" />
      <p>Uploading document...</p>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ error }}</p>
    </div>

    <!-- Analysis Options -->
    <div v-if="uploadedFile && !isUploading" class="analysis-options">
      <h3>Analysis Options</h3>

      <ion-list>
        <ion-item>
          <ion-checkbox
            v-model="options.extractKeyTerms"
            slot="start"
          />
          <ion-label>
            <h4>Extract Key Terms</h4>
            <p>Identify important legal terms and definitions</p>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-checkbox
            v-model="options.identifyRisks"
            slot="start"
          />
          <ion-label>
            <h4>Identify Risks</h4>
            <p>Analyze potential legal risks and liabilities</p>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-checkbox
            v-model="options.generateRecommendations"
            slot="start"
          />
          <ion-label>
            <h4>Generate Recommendations</h4>
            <p>Provide actionable recommendations</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </div>

    <!-- Action Buttons -->
    <div v-if="uploadedFile && !isUploading" class="action-buttons">
      <ion-button
        expand="block"
        @click="handleStartAnalysis"
        :disabled="isStarting"
      >
        <ion-icon :icon="analyticsOutline" slot="start" />
        {{ isStarting ? 'Starting Analysis...' : 'Start Analysis' }}
      </ion-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import {
  IonButton,
  IonIcon,
  IonProgressBar,
  IonList,
  IonItem,
  IonCheckbox,
  IonLabel,
} from '@ionic/vue';
import {
  cloudUploadOutline,
  documentTextOutline,
  closeCircleOutline,
  alertCircleOutline,
  analyticsOutline,
} from 'ionicons/icons';
import { legalDepartmentService } from '../legalDepartmentService';
import { useRbacStore } from '@/stores/rbacStore';
import type { DocumentType, UploadedDocument } from '../legalDepartmentTypes';

// Emits
const emit = defineEmits<{
  (e: 'analysis-started', data: { documentId: string; documentName: string; options: Record<string, boolean> }): void;
}>();

// State
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const uploadedFile = ref<UploadedDocument | null>(null);
const isUploading = ref(false);
const isStarting = ref(false);
const error = ref<string | null>(null);

// Analysis options
const options = ref({
  extractKeyTerms: true,
  identifyRisks: true,
  generateRecommendations: true,
});

// RBAC store for org slug
const rbacStore = useRbacStore();

// Methods
function triggerFileInput() {
  if (!uploadedFile.value && fileInput.value) {
    fileInput.value.click();
  }
}

function handleDragOver(e: DragEvent) {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
}

async function processFile(file: File) {
  error.value = null;

  // Validate file type
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];

  if (!validTypes.includes(file.type)) {
    error.value = 'Invalid file type. Please upload a PDF, DOCX, or image file.';
    return;
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    error.value = 'File size exceeds 10MB. Please upload a smaller file.';
    return;
  }

  // Upload file
  isUploading.value = true;
  try {
    const orgSlug = rbacStore.currentOrganization || 'demo-org';
    const uploaded = await legalDepartmentService.uploadDocument(file, orgSlug);
    uploadedFile.value = uploaded;
    console.log('[DocumentUpload] File uploaded successfully:', uploaded);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to upload file';
    console.error('[DocumentUpload] Upload failed:', err);
  } finally {
    isUploading.value = false;
  }
}

function removeFile() {
  uploadedFile.value = null;
  error.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

async function handleStartAnalysis() {
  if (!uploadedFile.value) return;

  isStarting.value = true;
  error.value = null;

  try {
    // Determine document type
    const documentType: DocumentType = uploadedFile.value.name.endsWith('.pdf')
      ? 'pdf'
      : uploadedFile.value.name.match(/\.(docx?|doc)$/i)
      ? 'docx'
      : 'image';

    // Emit to parent with document info and options
    emit('analysis-started', {
      documentId: uploadedFile.value.id,
      documentName: uploadedFile.value.name,
      options: options.value,
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start analysis';
    console.error('[DocumentUpload] Failed to start analysis:', err);
  } finally {
    isStarting.value = false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
</script>

<style scoped>
.document-upload {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.upload-header {
  margin-bottom: 32px;
  text-align: center;
}

.upload-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.upload-header p {
  margin: 0;
  color: var(--ion-color-medium);
}

.drop-zone {
  border: 2px dashed var(--ion-color-medium);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--ion-color-light);
}

.drop-zone:hover {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
}

.drop-zone.drag-over {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
  transform: scale(1.02);
}

.drop-zone.has-file {
  border-style: solid;
  background: var(--ion-color-success-tint);
  border-color: var(--ion-color-success);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 64px;
  color: var(--ion-color-primary);
}

.drop-text {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.or-text {
  color: var(--ion-color-medium);
  margin: 0;
}

.supported-formats {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 8px 0 0 0;
}

.uploaded-file-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.file-icon {
  font-size: 48px;
  color: var(--ion-color-success);
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-details h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.file-details p {
  margin: 0;
  font-size: 14px;
  color: var(--ion-color-medium);
}

.upload-progress {
  margin-top: 24px;
  text-align: center;
}

.upload-progress p {
  margin: 8px 0 0 0;
  color: var(--ion-color-medium);
}

.error-message {
  margin-top: 24px;
  padding: 16px;
  background: var(--ion-color-danger-tint);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-message ion-icon {
  font-size: 24px;
}

.error-message p {
  margin: 0;
  color: var(--ion-color-danger-shade);
}

.analysis-options {
  margin-top: 32px;
}

.analysis-options h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.action-buttons {
  margin-top: 32px;
}
</style>
