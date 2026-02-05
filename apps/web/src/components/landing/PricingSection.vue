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
        <div class="card-badge">Most Popular</div>
        <h3 class="package-title">1 Week Free Trial</h3>
        <div class="price-container">
          <span class="package-price">$0</span>
          <span class="price-tag">to start</span>
        </div>
        <ul class="package-features">
          <li>
            <span class="check-icon">✓</span>
            <span>System setup on your infrastructure</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Build your first agents/workflows</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>See real results before paying</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>No obligation to continue</span>
          </li>
        </ul>
        <ion-button size="large" class="cta-button primary" @click="$emit('scheduleCall')">
          Start Free Trial
        </ion-button>
      </div>
      <!-- After Trial -->
      <div class="pricing-card">
        <h3 class="package-title">After Trial</h3>
        <div class="price-container">
          <span class="package-price">$5K</span>
          <span class="price-tag">system</span>
        </div>
        <div class="price-container secondary">
          <span class="package-price secondary">+ $5K</span>
          <span class="price-tag">consulting</span>
        </div>
        <ul class="package-features">
          <li>
            <span class="check-icon">✓</span>
            <span>Keep the system and agents we built</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Or we return all code and documentation</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Your choice - no pressure</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Full ownership of everything</span>
          </li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
          Learn More
        </ion-button>
      </div>
      <!-- Ongoing Development -->
      <div class="pricing-card">
        <h3 class="package-title">Development</h3>
        <div class="price-container">
          <span class="package-price">$120<span class="price-unit">/hr</span></span>
          <span class="price-tag">Founder</span>
        </div>
        <div class="price-container secondary">
          <span class="package-price secondary">$50<span class="price-unit">/hr</span></span>
          <span class="price-tag">Interns</span>
        </div>
        <ul class="package-features">
          <li>
            <span class="check-icon">✓</span>
            <span>Pay-as-you-go development</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Mix founder & intern hours</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Happy to train your team anytime</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Transition to subscription when ready</span>
          </li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
          Discuss Your Project
        </ion-button>
      </div>
      <!-- System Licensing -->
      <div class="pricing-card">
        <h3 class="package-title">System License</h3>
        <div class="price-container">
          <span class="package-price">$20K<span class="price-unit">/year</span></span>
          <span class="price-tag">ongoing</span>
        </div>
        <ul class="package-features">
          <li>
            <span class="check-icon">✓</span>
            <span>Continuous system updates</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>New features and improvements</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Switch to subscription anytime</span>
          </li>
          <li>
            <span class="check-icon">✓</span>
            <span>Your code stays yours forever</span>
          </li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
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
  padding: var(--space-20) 0 var(--space-24);
  position: relative;
}

.section-header {
  text-align: center;
  margin-bottom: var(--space-16);
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.section-header h2 {
  font-size: var(--text-4xl);
  color: var(--landing-dark);
  margin-bottom: var(--space-4);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.section-subtitle {
  font-size: var(--text-lg);
  color: var(--landing-dark-light);
  line-height: 1.7;
  font-weight: var(--font-weight-normal);
  opacity: 0.9;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
  padding: 0 var(--space-8);
  max-width: 1400px;
  margin: 0 auto;
  align-items: stretch;
}

.pricing-card {
  background: var(--landing-white);
  border-radius: var(--radius-3xl);
  padding: var(--space-8) var(--space-6);
  border: 2px solid rgba(139, 90, 60, 0.15);
  position: relative;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  height: 100%;
}

.pricing-card.highlight {
  border: 2px solid var(--landing-secondary);
  background: var(--landing-white);
  box-shadow: var(--shadow-green);
}

.pricing-card.highlight::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--landing-gradient-accent);
  border-radius: var(--radius-3xl) var(--radius-3xl) 0 0;
}

.pricing-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-xl);
  border-color: var(--landing-secondary);
}

.pricing-card.highlight:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-xl);
}

.card-badge {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: var(--landing-gradient-accent);
  color: white;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: var(--shadow-sm);
}

.package-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-dark);
  margin-bottom: var(--space-6);
  margin-top: var(--space-2);
  line-height: 1.3;
  text-align: center;
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.price-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: var(--space-4);
  text-align: center;
  min-height: 4rem;
  justify-content: center;
}

.price-container.secondary {
  margin-bottom: var(--space-3);
  min-height: 3rem;
}

.package-price {
  font-size: var(--text-4xl);
  font-weight: var(--font-weight-extrabold);
  color: var(--landing-accent);
  line-height: 1;
  margin-bottom: var(--space-1);
  letter-spacing: -0.03em;
}

.package-price.secondary {
  font-size: var(--text-2xl);
  color: var(--landing-primary-dark);
  font-weight: var(--font-weight-bold);
}

.price-unit {
  font-size: 0.6em;
  font-weight: var(--font-weight-semibold);
  opacity: 0.8;
}

.price-tag {
  font-size: var(--text-sm);
  color: var(--landing-gray);
  font-weight: var(--font-weight-medium);
  text-transform: lowercase;
}

.package-features {
  list-style: none;
  padding: 0;
  margin: var(--space-8) 0 var(--space-8);
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.package-features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--landing-dark);
  font-size: var(--text-base);
  line-height: 1.6;
  font-weight: var(--font-weight-normal);
}

.check-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background: var(--landing-accent);
  color: white;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  margin-top: 2px;
  border: 2px solid var(--landing-accent);
  box-shadow: 0 2px 4px rgba(22, 101, 52, 0.25);
}

.pricing-card.highlight .check-icon {
  background: var(--landing-accent);
  border-color: var(--landing-accent);
  box-shadow: 0 2px 6px rgba(22, 101, 52, 0.35);
}

.cta-button {
  margin-top: auto;
  --border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-base);
  height: 48px;
  text-transform: none;
  letter-spacing: 0.01em;
  transition: var(--transition-smooth);
}

.cta-button.primary {
  --background: var(--landing-gradient-accent);
  --color: white;
  --box-shadow: var(--shadow-md);
}

.cta-button.primary:hover {
  --box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.cta-button.secondary {
  --background: var(--landing-white);
  --color: var(--landing-accent);
  --border-width: 2px;
  --border-color: var(--landing-accent);
  --border-style: solid;
  --box-shadow: var(--shadow-sm);
}

.cta-button.secondary:hover {
  --background: rgba(22, 101, 52, 0.08);
  --box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

@media (max-width: 1200px) {
  .pricing-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-6);
  }
}

@media (max-width: 1024px) {
  .pricing-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-5);
  }
}

@media (max-width: 768px) {
  .pricing-section {
    padding: var(--space-16) 0 var(--space-20);
  }
  
  .section-header h2 {
    font-size: var(--text-3xl);
  }
  
  .pricing-grid {
    grid-template-columns: 1fr;
    padding: 0 var(--space-4);
    gap: var(--space-6);
  }
  
  .pricing-card {
    padding: var(--space-6) var(--space-5);
    height: auto;
  }
  
  .package-title {
    min-height: auto;
  }
  
  .price-container {
    min-height: auto;
  }
  
  .price-container.secondary {
    min-height: auto;
  }
  
  .package-title {
    font-size: var(--text-xl);
  }
  
  .package-price {
    font-size: var(--text-3xl);
  }
  
  .package-price.secondary {
    font-size: var(--text-xl);
  }
  
  .package-features {
    margin: var(--space-6) 0;
    gap: var(--space-3);
  }
  
  .package-features li {
    font-size: var(--text-sm);
  }
}
</style>
