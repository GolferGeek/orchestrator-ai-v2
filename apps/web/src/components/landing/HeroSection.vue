<template>
  <section class="hero-section">
    <div class="hero-content landing-section">
      <!-- Video Player Section -->
      <div class="video-section">
        <h2>AI for Small Business</h2>
        
        <!-- Video Player -->
        <VideoPlayer :current-video="currentVideo" />
        
        <!-- Video Buttons -->
        <div class="video-buttons-grid">
          <button 
            v-for="video in featuredVideos" 
            :key="video.id"
            class="video-button"
            :class="{ active: currentVideo?.id === video.id }"
            @click="selectVideo(video)"
          >
            <span class="play-icon-wrapper">▶</span>
            <span>{{ video.title }}</span>
          </button>
        </div>

        <!-- Demo Highlight Card -->
        <ion-card class="demo-highlight-box">
          <ion-card-header>
            <ion-card-title class="demo-highlight-title">
              🚀 Try the Full App Now
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="demo-highlight-text">
              <strong>Jump right in:</strong> The demo environment is a <span class="highlight">fully functional system</span>—everything you see here (and in the videos) is live and ready for you to explore.
            </p>
            <ul class="demo-highlight-list">
              <li>Log in instantly with the provided demo credentials.</li>
              <li>All agents are active and ready—ask what they do, then try them out!</li>
              <li>Switch between LLM models to see real-time differences in performance.</li>
              <li>This is the exact system we deploy for you, inside your own infrastructure.</li>
            </ul>
            <p class="demo-highlight-text">
              <em>Experience OrchestratorAI hands-on—no waiting, no limitations.</em>
            </p>
            <div class="demo-actions">
              <ion-button size="large" @click="goToDemo">
                Launch Full App
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton } from '@ionic/vue';
import { useLandingStore } from '@/stores/landingStore';
import { useRouter } from 'vue-router';
import VideoPlayer from './VideoPlayer.vue';
import { videoService } from '@/services/videoService';

// Interface for video player (simplified)
interface VideoPlayerVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

const landingStore = useLandingStore();
const router = useRouter();

// Get featured videos for the hero section
const featuredVideos = computed(() => {
  const videos: VideoPlayerVideo[] = [];
  
  // Get all categories in order
  const categoriesInOrder = videoService.getCategoriesInOrder();
  
  categoriesInOrder.forEach(({ key: _key, category }) => {
    // Get all featured videos from this category
    const featuredVideosInCategory = category.videos.filter(video => video.featured);
    
    featuredVideosInCategory.forEach(video => {
      videos.push({
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl: video.url
      });
    });
  });
  
  return videos;
});

// Current video state
const currentVideo = ref<VideoPlayerVideo | null>(null);

function selectVideo(video: VideoPlayerVideo) {
  currentVideo.value = video;
}

function goToDemo() {
  router.push('/login');
}

onMounted(() => {
  // Track hero section view
  landingStore.trackSectionView('hero');
  
  // Set the first video as the default when the page loads
  if (featuredVideos.value.length > 0) {
    currentVideo.value = featuredVideos.value[0];
  }
});
</script>

<style scoped>
.hero-section {
  background: var(--landing-gradient, linear-gradient(135deg, #8b5a3c 0%, #a16c4a 70%, #15803d 100%));
  color: var(--landing-white, #fffbf7);
  padding: var(--space-16, 4rem) 0;
  min-height: 60vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.hero-content {
  max-width: var(--container-max-width, 1200px);
  margin: 0 auto;
  padding: 0 var(--space-8, 2rem);
  text-align: center;
  position: relative;
  z-index: 1;
}

.video-section h2 {
  font-size: var(--text-4xl, 2.25rem);
  margin-bottom: var(--space-8, 2rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--landing-white, #fffbf7);
}

.video-buttons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4, 1rem);
  max-width: 800px;
  margin: 0 auto var(--space-8, 2rem);
}

.video-button {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: var(--landing-white, white);
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-radius: var(--radius-xl, 12px);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  gap: var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.95rem);
  backdrop-filter: blur(10px);
  width: 100%;
}

.video-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.play-icon-wrapper {
  background: transparent;
  color: white;
  width: 20px;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  padding-left: 2px; /* Visual adjustment to center the triangle */
  flex-shrink: 0;
  box-sizing: border-box;
}

.video-button.active {
  background: var(--landing-accent);
  border-color: var(--landing-accent);
  color: var(--landing-white, white);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);
}

/* Demo Highlight Card */
.demo-highlight-box {
  margin: var(--space-8, 2rem) auto;
  max-width: 800px;
  --background: rgba(255, 255, 255, 0.97);
  --color: var(--landing-dark);
  border-radius: var(--radius-2xl);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.demo-highlight-box ion-card-header {
  padding-bottom: var(--space-2);
}

.demo-highlight-box ion-card-content {
  padding-top: var(--space-2);
}

.demo-highlight-title {
  font-size: var(--text-2xl, 1.5rem);
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0;
  text-align: center;
}

.demo-highlight-text {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--landing-dark);
  margin: var(--space-4) 0;
  font-weight: var(--font-weight-normal);
}

.demo-highlight-text .highlight {
  background: var(--landing-gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: var(--font-weight-semibold);
}

.demo-highlight-list {
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0;
  text-align: left;
}

.demo-highlight-list li {
  padding: var(--space-2) 0;
  position: relative;
  padding-left: var(--space-6);
  color: var(--landing-dark);
  font-size: 1rem;
  line-height: 1.4;
}

.demo-highlight-list li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: var(--space-2);
  color: var(--landing-secondary);
  font-weight: var(--font-weight-bold);
}

.demo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: center;
  margin-top: var(--space-6);
}

.demo-actions ion-button {
  --background: var(--landing-accent);
  --color: var(--landing-white);
  --border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  width: 100%;
}

@media (max-width: 768px) {
  .hero-section {
    padding: var(--space-8, 2rem) 0;
    min-height: 50vh;
  }
  
  .video-section h2 {
    font-size: var(--text-3xl, 2rem);
    margin-bottom: var(--space-6, 1.5rem);
  }
  
  .video-buttons-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3, 0.75rem);
  }
  
  .video-button {
    padding: var(--space-3.5, 0.875rem) var(--space-4, 1rem);
    font-size: var(--text-sm, 0.9rem);
  }
}
</style>
