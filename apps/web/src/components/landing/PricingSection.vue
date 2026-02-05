<template>
  <section id="pricing" class="pricing-section landing-section animate-on-scroll">
    <div class="section-header">
      <h2>Partnership Pricing</h2>
      <p class="section-subtitle">
        Try before you commit. We build your first agents for free, then you decide.
      </p>
    </div>
    <div class="pricing-grid">
      <!-- Trial Week -->
      <div class="pricing-card highlight">
        <h3 class="package-title">1 Week Free Trial</h3>
        <p class="package-price">$0 <span class="price-tag">to start</span></p>
        <ul class="package-features">
          <li>System setup on your infrastructure</li>
          <li>Build your first agents/workflows</li>
          <li>See real results before paying</li>
          <li>No obligation to continue</li>
        </ul>
        <ion-button size="large" class="cta-button" @click="$emit('scheduleCall')">
          Start Free Trial
        </ion-button>
      </div>
      <!-- After Trial -->
      <div class="pricing-card">
        <h3 class="package-title">After Trial</h3>
        <p class="package-price">$5K <span class="price-tag">system</span> + $5K <span class="price-tag">consulting</span></p>
        <ul class="package-features">
          <li>Keep the system and agents we built</li>
          <li>Or we return all code and documentation</li>
          <li>Your choice - no pressure</li>
          <li>Full ownership of everything</li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
          Learn More
        </ion-button>
      </div>
      <!-- Ongoing Development -->
      <div class="pricing-card">
        <h3 class="package-title">Development</h3>
        <p class="package-price">$100/hr <span class="price-tag">Founder</span></p>
        <p class="sub-price">$40-50/hr <span class="price-tag">Interns</span></p>
        <ul class="package-features">
          <li>Pay-as-you-go development</li>
          <li>Mix founder & intern hours</li>
          <li>Happy to train your team anytime</li>
          <li>Transition to subscription when ready</li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
          Discuss Your Project
        </ion-button>
      </div>
      <!-- System Licensing -->
      <div class="pricing-card">
        <h3 class="package-title">System License</h3>
        <p class="package-price">$10K <span class="price-tag">at 4 weeks</span></p>
        <p class="sub-price">$10K <span class="price-tag">at 6 months</span></p>
        <p class="sub-price">$20K/year <span class="price-tag">ongoing</span></p>
        <ul class="package-features">
          <li>Continuous system updates</li>
          <li>New features and improvements</li>
          <li>Switch to subscription anytime</li>
          <li>Your code stays yours forever</li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button" @click="$emit('scheduleCall')">
          Schedule Call
        </ion-button>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { IonButton } from '@ionic/vue';
/**
 * Emits:
 *  - schedule-call: trigger parent to scroll to CTA or open Calendly
 */
defineEmits<{
  scheduleCall: []
}>();
</script>
<style scoped>
.pricing-section {
  background: var(--landing-white);
  padding: 4rem 0;
}
.section-header {
  text-align: center;
  margin-bottom: 2rem;
}
.section-header h2 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 700;
}
.section-subtitle {
  font-size: 1.1rem;
  color: var(--landing-gray);
  opacity: 0.8;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0 2rem;
}
.pricing-card {
  background: var(--landing-primary-50);
  border-radius: 20px;
  padding: 2rem 1.5rem;
  border: 2px solid transparent;
  position: relative;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.pricing-card.highlight {
  border-color: var(--landing-secondary);
  background: linear-gradient(135deg, var(--landing-secondary-light), var(--landing-primary-50));
  box-shadow: var(--shadow-green);
}
.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--landing-secondary);
}
.package-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--landing-dark);
  margin-bottom: 0.75rem;
}
.package-price {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--landing-secondary);
  margin-bottom: 0.25rem;
}
.sub-price {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--landing-primary-dark);
  margin-bottom: 0.75rem;
}
.price-tag {
  font-size: 0.8rem;
  color: var(--landing-gray);
  font-weight: 500;
}
.package-features {
  list-style: none;
  padding: 0;
  margin: 1rem 0 2rem;
  text-align: left;
}
.package-features li {
  margin-bottom: 0.5rem;
  color: var(--landing-dark);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cta-button {
  --background: var(--landing-accent);
  --color: white;
  --border-radius: 8px;
  font-weight: 600;
  width: 100%;
}
.cta-button.secondary {
  --background: var(--landing-white);
  --color: var(--landing-secondary);
  border: 2px solid var(--landing-secondary);
  --box-shadow: var(--shadow-sm);
}
@media (max-width: 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    padding: 0 1rem;
  }
  .pricing-card {
    padding: 1.5rem 1.25rem;
  }
}
</style>
