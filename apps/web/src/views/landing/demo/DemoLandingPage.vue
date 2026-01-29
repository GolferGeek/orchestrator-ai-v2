<template>
  <ion-page class="landing-page">
    <!-- Landing Header -->
    <LandingHeader />
      
      <ion-content :fullscreen="true" class="landing-content">
      <!-- Hero Section -->
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
                  <ion-icon :icon="playCircleOutline"></ion-icon>
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

      <!-- Small Company Advantage Section -->
        <section id="small-company-advantage" class="small-company-section landing-section animate-on-scroll">
          <div class="section-header">
            <h2>Why Small Companies Win with AI</h2>
            <p class="section-subtitle">
              While big companies focus on efficiency, small companies can use AI for something far more powerful: 
              <strong>growth of opportunity</strong>.
            </p>
          </div>
          <div class="advantage-grid">
            <!-- Growth vs Efficiency -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="trendingUpOutline"></ion-icon>
              </div>
              <h3>Growth vs Efficiency Mindset</h3>
              <p>
                <strong>Big companies:</strong> "How can AI make our existing processes 10% faster?"<br>
                <strong>Small companies:</strong> "What new opportunities can AI unlock that we never had before?"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">A small marketing agency uses AI to offer 24/7 customer service, 
                creating a competitive advantage that big agencies can't match.</span>
              </div>
            </div>
            <!-- Innovation Advantage -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="bulbOutline"></ion-icon>
              </div>
              <h3>Innovation vs Risk Aversion</h3>
              <p>
                <strong>Big companies:</strong> Innovation committees, months of approval processes, 
                "proven solutions only"<br>
                <strong>Small companies:</strong> "Let's try this tomorrow and see what happens"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">A small law firm deploys AI contract review in a week, 
                while big firms spend months evaluating "enterprise solutions."</span>
              </div>
            </div>
            <!-- Speed Advantage -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="flashOutline"></ion-icon>
              </div>
              <h3>Speed of Implementation</h3>
              <p>
                <strong>Big companies:</strong> 18-month AI rollouts, vendor lock-in, 
                "we need to train 10,000 people"<br>
                <strong>Small companies:</strong> Deploy in days, customize in hours, 
                "let's see what works"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">A small restaurant chain adds AI-powered inventory management 
                in a weekend, while big chains plan for years.</span>
              </div>
            </div>
            <!-- Personal Touch -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="peopleOutline"></ion-icon>
              </div>
              <h3>Personal + AI = Unstoppable</h3>
              <p>
                <strong>Big companies:</strong> "Replace human interaction with AI"<br>
                <strong>Small companies:</strong> "Use AI to make our human touch even more valuable"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">A small consulting firm uses AI for research and analysis, 
                then delivers personalized insights that big firms can't match.</span>
              </div>
            </div>
            <!-- American Labor -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="flagOutline"></ion-icon>
              </div>
              <h3>American Labor Advantage</h3>
              <p>
                <strong>Big companies:</strong> "Outsource to the cheapest global workforce"<br>
                <strong>Small companies:</strong> "Work with native English speakers in your timezone"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">No language barriers, no timezone delays, no cultural miscommunications. 
                Just clear communication and immediate responses during your business hours.</span>
              </div>
            </div>
            <!-- Mentorship -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="schoolOutline"></ion-icon>
              </div>
              <h3>Family-First Mentorship</h3>
              <p>
                <strong>Big companies:</strong> "Hire the cheapest talent, maximize profit margins"<br>
                <strong>Small companies:</strong> "Invest in people, build lasting relationships"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">We hire and mentor family members and local talent, creating a team that's 
                personally invested in your success, not just another client number.</span>
              </div>
            </div>
            <!-- AI Realism -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="eyeOutline"></ion-icon>
              </div>
              <h3>AI Realism vs Hype</h3>
              <p>
                <strong>Big companies:</strong> "AI will solve everything! Revolutionary disruption!"<br>
                <strong>Small companies:</strong> "Here's what AI can actually do for your specific problems"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">No VC-driven hype cycles or impossible promises. Just honest assessments 
                of what AI can and can't do, with realistic timelines and expectations.</span>
              </div>
            </div>
            <!-- Small Clientele -->
            <div class="advantage-card">
              <div class="advantage-icon">
                <ion-icon :icon="diamondOutline"></ion-icon>
              </div>
              <h3>Exclusive Attention</h3>
              <p>
                <strong>Big companies:</strong> "You're one of 10,000 clients competing for support"<br>
                <strong>Small companies:</strong> "You're one of 5-10 partners getting our full focus"
              </p>
              <div class="advantage-example">
                <span class="example-label">Example:</span>
                <span class="example-text">No waiting in support queues or competing for developer time. 
                You get direct access to the founder and immediate attention to your needs.</span>
              </div>
            </div>
          </div>
        </section>


      <!-- Pricing Section -->
        <section id="pricing" class="pricing-section animate-on-scroll">
          <div class="pricing-content">
            <div class="section-header">
              <h2>Pricing</h2>
              <p class="section-subtitle">
                Transparent, partnership-oriented pricing. No hidden fees, no long-term lock-ins.
                We grow with you.
              </p>
            </div>
            <div class="pricing-grid">
            <!-- Setup Package -->
            <div class="pricing-card highlight">
              <div class="pricing-header">
                <h3 class="package-title">Founding Partner Setup</h3>
                <p class="best-for">Best for: Teams starting a long-term build</p>
                <div class="pricing-info">
                  <div class="package-price">$25,000</div>
                  <div class="price-tag">one-time</div>
                </div>
              </div>
              <ul class="package-features">
                <li>Private fork deployed on your server</li>
                <li>Security-hardened Docker container</li>
                <li>80 hours customization credit</li>
                <li>Priority roadmap influence</li>
              </ul>
            </div>
            <!-- Ongoing Development -->
            <div class="pricing-card">
              <div class="pricing-header">
                <h3 class="package-title">Ongoing Development</h3>
                <p class="best-for">Best for: Active projects needing flexible support</p>
                <div class="pricing-info">
                  <div class="package-price">$100/hr</div>
                  <div class="price-tag">Founder</div>
                </div>
                <div class="pricing-info secondary">
                  <div class="package-price secondary">$40/hr</div>
                  <div class="price-tag">Interns</div>
                </div>
              </div>
              <ul class="package-features">
                <li>Pay-as-you-go, billed weekly</li>
                <li>Mix founder & intern hours as needed</li>
                <li>Time-tracking transparency</li>
                <li>10 hrs/mo included retainer</li>
              </ul>
            </div>
            <!-- Updates & Separation -->
            <div class="pricing-card">
              <div class="pricing-header">
                <h3 class="package-title">Updates & Separation</h3>
                <p class="best-for">Best for: Companies wanting long-term independence</p>
                <div class="pricing-info">
                  <div class="package-price">Continuous Updates</div>
                  <div class="price-tag">free while active</div>
                </div>
                <div class="pricing-info secondary">
                  <div class="package-price secondary">$25,000</div>
                  <div class="price-tag">separation fee*</div>
                </div>
              </div>
              <ul class="package-features">
                <li>Automated merges of core system</li>
                <li>We avoid conflicts with your custom agents</li>
                <li>You keep your code fork forever</li>
                <li>*Waived after $50k development spend</li>
              </ul>
            </div>
          </div>
          </div>
        </section>


      <!-- CTA Section -->
        <section id="cta-section" class="cta-section">
          <div class="landing-section">
            <div class="cta-content">
              <h2>Contact Us</h2>
              <p class="cta-subtitle">
                Ready to explore how AI can transform your business? Get in touch to discuss your specific needs 
                and learn how our platform can be customized for your organization.
              </p>
              <div class="cta-options">
                <div class="cta-option">
                  <h3>Call Us Today</h3>
                  <p>Speak directly with our team to discuss your business challenges and explore how our AI platform can help.</p>
                  <button 
                    class="cta-button primary"
                    @click="callPhone"
                  >
                    <ion-icon :icon="callOutline"></ion-icon>
                    Call us today
                  </button>
                </div>
                <div class="cta-option">
                  <h3>Send a Message</h3>
                  <p>Prefer email? Send us your questions and we'll respond within 24 hours with detailed information.</p>
                  <button 
                    class="cta-button secondary"
                    @click="openEmailForm"
                  >
                    <ion-icon :icon="mailOutline"></ion-icon>
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="landing-footer">
          <div class="footer-content">
            <p>2026 – Orchestrator AI</p>
          </div>
        </footer>

      </ion-content>
    
    <!-- Video Modal -->
    <VideoModal
      :is-open="isVideoModalOpen"
      :video-title="currentVideo?.title || ''"
      :video-description="currentVideo?.description || ''"
      :video-url="currentVideo?.videoUrl"
      @close="closeVideoModal"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonContent, IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';
import { 
  playCircleOutline,
  peopleOutline,
  flashOutline,
  trendingUpOutline,
  callOutline,
  bulbOutline,
  mailOutline,
  flagOutline,
  schoolOutline,
  eyeOutline,
  diamondOutline
} from 'ionicons/icons';
// Import remaining components
import LandingHeader from '@/components/landing/LandingHeader.vue';
import VideoModal from '@/components/landing/VideoModal.vue';
import VideoPlayer from '@/components/landing/VideoPlayer.vue';
// Landing page store
import { useLandingStore } from '@/stores/landingStore';
// Video service
import { videoService, type Video } from '@/services/videoService';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/rbacStore';

// Interface for video player (simplified)
interface VideoPlayerVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

const landingStore = useLandingStore();
const router = useRouter();
const _authStore = useAuthStore();

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<VideoPlayerVideo | null>(null);

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

// Refs for animation
const featuresGrid = ref<HTMLElement>();

// Hero section functions
function selectVideo(video: VideoPlayerVideo) {
  currentVideo.value = video;
}

function goToDemo() {
  router.push('/login');
}

// Video modal functions
function _openWhatWeBuiltVideoModal() {
  handleSectionVideoModal('what-we-built');
}

function _openCTAVideoModal() {
  handleSectionVideoModal('how-we-work');
}

// CTA functions
function openCalendly() {
  // Open Calendly in a new window/tab
  window.open('https://calendly.com/orchestrator-ai/founding-partner-consultation', '_blank');
}

function callPhone() {
  // Initiate phone call
  window.location.href = 'tel:+17632200146';
}

function openEmailForm() {
  // Open email form or trigger email modal
  window.location.href = 'mailto:hello@orchestrator-ai.com?subject=Founding Partner AI Workforce Consultation&body=Hi there,%0D%0A%0D%0AI\'m interested in learning more about your AI workforce platform and the founding partner opportunity.%0D%0A%0D%0AHere\'s a bit about my business:%0D%0A%0D%0A%0D%0A%0D%0AWhat specific challenges are you hoping AI could help with?%0D%0A%0D%0AThanks!';
}

// Scroll functions
function _handleScrollToPricing() {
  const pricingElement = document.getElementById('pricing');
  if (pricingElement) {
    pricingElement.scrollIntoView({ behavior: 'smooth' });
  }
}

function _handleScheduleCall() {
  openCalendly();
}

// Intersection Observer for scroll animations
let observer: IntersectionObserver | null = null;

// SectionNavigation removed

function handleOpenVideoModal(video: Video) {
  currentVideo.value = {
    id: video.id,
    title: video.title,
    description: video.description,
    videoUrl: video.url
  };
  isVideoModalOpen.value = true;
}

function handleSectionVideoModal(sectionId: string) {
  // Map section IDs to video categories
  const sectionVideoMap: Record<string, string> = {
    'what-we-built': 'features',
    'small-company-advantage': 'benefits', 
    'anti-influencer': 'philosophy',
    'pricing': 'pricing',
    'our-purpose': 'mission',
    'how-we-work': 'process'
  };
  
  const categoryKey = sectionVideoMap[sectionId] || 'introduction';
  
  // Get the featured video from the specified category
  const category = videoService.getCategory(categoryKey);
  if (category) {
    const featuredVideo = category.videos.find(video => video.featured);
    if (featuredVideo) {
      handleOpenVideoModal(featuredVideo);
    }
  }
}

function closeVideoModal() {
  isVideoModalOpen.value = false;
  currentVideo.value = null;
}

onMounted(() => {
  // Track page view
  landingStore.trackPageView('demo-landing');
  
  // Track hero section view
  landingStore.trackSectionView('hero');
  
  // Set the first video as the default when the page loads
  if (featuredVideos.value.length > 0) {
    currentVideo.value = featuredVideos.value[0];
  }
  
  // Set up intersection observer for scroll animations
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  );
  
  // Observe all elements with animate-on-scroll class
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  animateElements.forEach((el) => {
    if (observer) {
      observer.observe(el);
    }
  });
  
  // Add stagger animation to features grid after a slight delay
  setTimeout(() => {
    if (featuresGrid.value) {
      featuresGrid.value.classList.add('animate');
    }
  }, 300);
  
  // Check URL hash for direct navigation
  if (window.location.hash) {
    const sectionId = window.location.hash.substring(1); // Remove the #
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
  
  // Listen for hash changes
  const handleHashChange = () => {
    if (window.location.hash) {
      const sectionId = window.location.hash.substring(1);
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
  
  window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style scoped>
/* Landing page consolidated styles - uses variables from landing.css */

/* Ensure the page has basic styling even if variables fail */
.landing-page {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
}

.landing-content {
  background: #fdf8f6;
}

/* Fallback styles in case CSS variables fail to load */
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
  color: var(--landing-white);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-xl);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  backdrop-filter: blur(10px);
}

.video-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.video-button.active {
  background: var(--landing-accent);
  border-color: var(--landing-accent);
  color: var(--landing-white);
}

/* ===================================================
   UNIFIED CARD SYSTEM
   - All cards use consistent shadow: 0 4px 16px rgba(0,0,0,0.08)
   - Soft physical appearance without hover transforms
   - Consistent border: 1px solid rgba(0,0,0,0.06)
   - No gradient backgrounds bleeding to edges
   =================================================== */

/* Demo Highlight Card */
.demo-highlight-box {
  margin: var(--space-8) auto;
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
  font-size: var(--text-2xl);
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

/* Section Styles */
.what-we-built-section,
.small-company-section,
.anti-influencer-section,
.pricing-section,
.purpose-section {
  padding: var(--space-16, 4rem) 0;
}

.landing-section {
  max-width: var(--container-max-width, 1200px);
  margin: 0 auto;
  padding: 0 var(--space-8, 2rem);
}

.what-we-built-section {
  background: var(--landing-white);
}

.small-company-section,
.purpose-section {
  background: var(--landing-primary-50);
  padding-top: var(--space-20);
}

.anti-influencer-section {
  background: var(--landing-white);
}

.pricing-section {
  background: var(--landing-gradient);
  color: var(--landing-white);
}

.section-header {
  text-align: center;
  margin-bottom: var(--space-16);
}

.pricing-section .section-header {
  margin-bottom: var(--space-12);
}

.section-header h2 {
  font-size: var(--text-4xl);
  color: var(--landing-dark);
  margin-bottom: var(--space-4);
  font-weight: var(--font-weight-bold);
}

.pricing-section .section-header h2 {
  color: var(--landing-white);
}

.pricing-section .section-subtitle {
  color: rgba(255, 255, 255, 0.95);
  font-weight: var(--font-weight-normal);
}

.section-subtitle {
  font-size: var(--text-xl);
  color: var(--landing-dark-light, #57341f);
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
  font-weight: var(--font-weight-normal);
}



/* CTA Buttons - Match hero button styling exactly */
.cta-button {
  background: var(--landing-accent, var(--landing-secondary)) !important;
  color: var(--landing-white) !important;
  border: none !important;
  border-radius: var(--radius-lg) !important;
  padding: var(--space-4) var(--space-6) !important;
  font-size: var(--text-base) !important;
  font-weight: var(--font-weight-semibold) !important;
  font-family: inherit !important;
  width: 100% !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: var(--space-2) !important;
  transition: all 0.2s ease !important;
  box-shadow: none !important;
  outline: none !important;
}

.cta-button:hover {
  background: var(--landing-accent, var(--landing-secondary)) !important;
  color: var(--landing-white) !important;
  opacity: 0.9 !important;
  transform: translateY(-1px) !important;
}

.cta-button:focus {
  background: var(--landing-accent, var(--landing-secondary)) !important;
  color: var(--landing-white) !important;
  outline: none !important;
  opacity: 0.9 !important;
}

.cta-button:active {
  background: var(--landing-accent, var(--landing-secondary)) !important;
  color: var(--landing-white) !important;
  opacity: 0.8 !important;
  transform: translateY(0) !important;
}

.cta-button ion-icon {
  font-size: 1.2em !important;
  color: var(--landing-white) !important;
}


.section-cta {
  text-align: center;
  padding: var(--space-12) var(--space-8);
  background: var(--landing-primary);
  border-radius: var(--radius-3xl);
  color: var(--landing-white);
}

.section-cta h3 {
  font-size: var(--text-2xl);
  margin-bottom: var(--space-2);
  font-weight: var(--font-weight-bold);
}

.section-cta p {
  font-size: var(--text-lg);
  margin-bottom: var(--space-8);
  opacity: 0.95;
  font-weight: var(--font-weight-normal);
}


/* Grid layouts for different sections */
.advantage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-10);
  margin-bottom: var(--space-16);
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.comparison-grid,
.purpose-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--space-8);
  margin-bottom: var(--space-12);
}

.advantage-card {
  background: var(--landing-white);
  border-radius: var(--radius-3xl);
  padding: var(--space-8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.advantage-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--landing-gradient);
}

.comparison-card,
.purpose-card {
  background: var(--landing-white);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.comparison-card.highlight,
.purpose-card.highlight {
  background: var(--landing-white);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Card content styles */
.advantage-card h3 {
  font-size: var(--text-2xl);
  color: var(--landing-dark);
  margin-bottom: var(--space-3);
  font-weight: var(--font-weight-bold);
  line-height: 1.3;
}

.advantage-card p {
  color: var(--landing-dark-light, #57341f);
  line-height: 1.7;
  margin-bottom: auto;
  font-size: 1rem;
  flex-grow: 1;
  font-weight: var(--font-weight-normal);
}

.comparison-card h3,
.purpose-card h3 {
  font-size: var(--text-xl);
  color: var(--landing-dark);
  margin-bottom: var(--space-4);
  font-weight: var(--font-weight-semibold);
}

.comparison-card p,
.purpose-card p {
  color: var(--landing-dark-light, #57341f);
  line-height: 1.6;
  margin-bottom: var(--space-6);
  font-size: 1rem;
  font-weight: var(--font-weight-normal);
}

/* Advantage section specific styles */
.advantage-example {
  background: var(--landing-primary-50);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  margin-top: var(--space-6);
  border-left: 3px solid var(--landing-secondary);
  margin-bottom: 0;
}

.example-label {
  font-weight: var(--font-weight-bold);
  color: var(--landing-secondary);
  display: block;
  margin-bottom: var(--space-3);
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.example-text {
  color: var(--landing-dark);
  font-size: 1rem;
  line-height: 1.6;
  font-style: italic;
}


.cta-content h3 {
  font-size: var(--text-2xl);
  color: var(--landing-dark);
  margin-bottom: var(--space-4);
  font-weight: var(--font-weight-bold);
}

.cta-content p {
  font-size: var(--text-lg);
  color: var(--landing-dark-light, #57341f);
  margin-bottom: var(--space-8);
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  font-weight: var(--font-weight-normal);
}

/* Comparison section specific styles */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.path-list {
  list-style: none;
  padding: 0;
  margin-bottom: var(--space-6);
}

.path-list li {
  margin-bottom: var(--space-3);
  color: var(--landing-dark);
  font-size: 1rem;
  line-height: 1.5;
}

.path-outcome {
  background: var(--landing-primary-50);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border-left: 3px solid var(--landing-secondary);
  font-size: 1rem;
  line-height: 1.5;
}




/* Icons for different sections */
.advantage-icon {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-2xl);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
  margin-bottom: var(--space-6);
  background: var(--landing-gradient);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.advantage-icon ion-icon {
  font-size: 2rem;
}

.path-icon,
.purpose-icon {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
  margin-bottom: var(--space-6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.path-icon.influencer {
  background: #ef4444;
}

.path-icon.builder,
.purpose-icon.doing {
  background: var(--landing-primary);
}

.purpose-icon.not {
  background: #ef4444;
}

/* Pricing Section */
.pricing-content {
  max-width: var(--container-max-width, 1200px);
  margin: 0 auto;
  padding: 0 var(--space-8, 2rem);
  position: relative;
  z-index: 1;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
}

.pricing-card {
  background: var(--landing-white);
  border-radius: var(--radius-3xl);
  padding: var(--space-6);
  position: relative;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  overflow: hidden;
  height: 100%;
  min-height: 400px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}


.pricing-card.highlight {
  background: var(--landing-white);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
}



/* Ensure no Ionic card hover effects */
ion-card.pricing-card {
  --box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  --border-width: 1px;
  --border-color: rgba(0, 0, 0, 0.06);
}

ion-card.pricing-card.highlight {
  --box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.pricing-header {
  margin-bottom: var(--space-4);
  width: 100%;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.package-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-dark);
  margin-bottom: var(--space-1);
  line-height: 1.3;
  text-align: center;
}

.best-for {
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--landing-dark-light, #57341f);
  opacity: 0.75;
  margin: 0 0 var(--space-3) 0;
  text-align: center;
  font-weight: var(--font-weight-normal);
}

.pricing-info {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
  min-height: 44px;
}

.pricing-info.secondary {
  margin-bottom: var(--space-2);
  min-height: 32px;
}

.pricing-info:last-child {
  margin-bottom: 0;
}

.package-price {
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-secondary);
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.package-price.secondary {
  font-size: var(--text-xl);
  color: var(--landing-secondary);
  font-weight: var(--font-weight-bold);
}

.price-tag {
  font-size: var(--text-sm);
  color: var(--landing-dark-light, #57341f);
  font-weight: var(--font-weight-normal);
  background: transparent;
  padding: 0;
  border-radius: 0;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.7;
}

.package-features {
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0 0;
  text-align: left;
  width: 100%;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-grow: 1;
}

.package-features li {
  margin-bottom: var(--space-3);
  color: var(--landing-dark);
  font-size: 1rem;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  line-height: 1.4;
}

.package-features li::before {
  content: "✓";
  font-weight: var(--font-weight-bold);
  font-size: var(--text-xs);
  flex-shrink: 0;
  margin-top: 2px;
  width: 16px;
  height: 16px;
  background: var(--landing-secondary);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
}

/* CTA Section */
.cta-section {
  background: var(--landing-white);
  color: var(--landing-dark);
  padding: var(--space-12) 0 0 0;
}

.cta-content {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 var(--space-8);
}

.cta-content h2 {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-3);
  font-weight: var(--font-weight-bold);
}

.cta-subtitle {
  font-size: var(--text-xl);
  margin-bottom: var(--space-8);
  color: var(--landing-dark-light, #57341f);
  line-height: 1.6;
  font-weight: var(--font-weight-normal);
}

.cta-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-10);
  margin-bottom: var(--space-8);
}

.cta-option {
  background: var(--landing-white);
  border-radius: var(--radius-3xl);
  padding: var(--space-8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-align: left;
  height: 100%;
}

.cta-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--landing-gradient);
}

.cta-option h3 {
  font-size: var(--text-lg);
  margin-bottom: var(--space-3);
  font-weight: var(--font-weight-bold);
  color: var(--landing-dark);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cta-option h3::before {
  content: '';
  width: 4px;
  height: 24px;
  background: var(--landing-secondary);
  border-radius: var(--radius-full);
}

.cta-option p {
  margin-bottom: var(--space-6);
  color: var(--landing-dark-light, #57341f);
  line-height: 1.5;
  flex-grow: 1;
  font-size: 1rem;
  font-weight: var(--font-weight-normal);
}

.cta-note {
  background: var(--landing-primary-50);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  border: 1px solid rgba(0, 0, 0, 0.06);
  text-align: center;
}

.cta-note p {
  margin: 0 0 var(--space-3) 0;
  font-size: 1rem;
  color: var(--landing-dark-light, #57341f);
  font-weight: var(--font-weight-normal);
}

.view-video-button {
  --color: var(--landing-primary);
  --background: var(--landing-primary-100);
  --border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-2);
}

.view-video-button:hover {
  --color: var(--landing-primary-dark);
  --background: var(--landing-primary-200);
}


/* Footer */
.landing-footer {
  background: var(--landing-gradient);
  color: var(--landing-white);
  padding: var(--space-8) 0;
  text-align: center;
  margin-top: var(--space-16);
}

.footer-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 var(--space-8);
}

.footer-content p {
  margin: 0;
  font-size: 1rem;
  color: var(--landing-white);
  font-weight: var(--font-weight-normal);
}

/* Animation classes */
.animate-on-scroll {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.animate-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}


/* Tablet responsive */
@media (max-width: 1024px) and (min-width: 769px) {
  .advantage-grid {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    max-width: 800px;
  }
  
  .advantage-card {
    padding: var(--space-8);
  }

  .small-company-section {
    padding-top: var(--space-16);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .hero-section {
    padding: var(--space-8) 0;
    min-height: 50vh;
  }
  
  .video-section h2 {
    font-size: var(--text-3xl);
    margin-bottom: var(--space-6);
  }
  
  .video-buttons-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  
  .video-button {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
  }


  .section-header h2 {
    font-size: var(--text-3xl);
  }

  .section-subtitle {
    font-size: 1rem;
  }


  .advantage-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
    margin-bottom: var(--space-12);
  }

  .advantage-card {
    padding: var(--space-6);
  }

  .advantage-icon {
    width: 60px;
    height: 60px;
    margin-bottom: var(--space-5);
  }

  .advantage-icon ion-icon {
    font-size: 1.5rem;
  }

  .advantage-card h3 {
    font-size: var(--text-xl);
  }

  .advantage-example {
    padding: var(--space-4);
    margin-top: var(--space-4);
    margin-bottom: 0;
  }

  .small-company-section {
    padding-top: var(--space-16);
  }

  .comparison-grid,
  .purpose-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .pricing-content {
    padding: 0 var(--space-4);
  }

  .pricing-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .pricing-card {
    padding: var(--space-4);
    min-height: 350px;
  }

  .pricing-card.highlight {
    transform: none;
  }

  .package-title {
    font-size: var(--text-xl);
  }

  .best-for {
    font-size: var(--text-xs);
    margin-bottom: var(--space-2);
  }

  .pricing-info {
    min-height: 36px;
  }

  .pricing-info.secondary {
    min-height: 28px;
  }

  .package-price {
    font-size: var(--text-2xl);
  }

  .package-price.secondary {
    font-size: var(--text-lg);
  }

  .pricing-header {
    margin-bottom: var(--space-3);
    min-height: 120px;
  }

  .package-features {
    margin: var(--space-3) 0 0;
    min-height: 120px;
  }

  .package-features li {
    font-size: 1rem;
    margin-bottom: var(--space-2);
  }

  .pricing-header {
    min-height: 120px;
  }

  .cta-options {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .cta-content h2 {
    font-size: var(--text-3xl);
  }

  .cta-subtitle {
    font-size: 1rem;
  }

  .landing-footer {
    padding: var(--space-6) 0;
    margin-top: var(--space-12);
  }

  .footer-content {
    padding: 0 var(--space-4);
  }
}
</style>
