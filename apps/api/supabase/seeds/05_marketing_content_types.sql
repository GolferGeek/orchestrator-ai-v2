-- =============================================================================
-- MARKETING CONTENT TYPES SEED DATA
-- =============================================================================
-- Predefined content types for the Marketing Swarm
-- Created: 2025-12-11
-- =============================================================================

-- Blog Post
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'blog-post',
    'demo-org',
    'Blog Post',
    'Long-form blog content for company websites and content marketing',
    'You are writing a blog post. Focus on:
- Engaging introduction that hooks the reader
- Clear structure with headers and subheaders
- Actionable insights and practical advice
- Natural, conversational tone
- Strong call-to-action at the end
- SEO-friendly without keyword stuffing
- Length: 800-1500 words'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- LinkedIn Post
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'linkedin-post',
    'demo-org',
    'LinkedIn Post',
    'Professional social media content for LinkedIn',
    'You are writing a LinkedIn post. Focus on:
- Hook in the first line (this shows before "see more")
- Professional but personable tone
- Use line breaks for readability
- Include a clear point or lesson
- End with engagement prompt (question or call-to-action)
- Optional: relevant hashtags (3-5 max)
- Length: 150-300 words (under 3000 characters)'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Twitter/X Thread
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'twitter-thread',
    'demo-org',
    'Twitter/X Thread',
    'Multi-tweet thread for Twitter/X',
    'You are writing a Twitter/X thread. Focus on:
- First tweet must hook and stand alone
- Number each tweet (1/, 2/, etc.)
- Each tweet under 280 characters
- Build narrative across tweets
- Use simple, punchy language
- Final tweet: summary + CTA
- 5-10 tweets total
- Avoid hashtags mid-thread (save for last tweet)'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Email Newsletter
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'email-newsletter',
    'demo-org',
    'Email Newsletter',
    'Email newsletter content for subscribers',
    'You are writing an email newsletter. Focus on:
- Compelling subject line (include it first)
- Preview text that complements subject
- Personal greeting and warm opening
- One main topic or theme
- Scannable format with short paragraphs
- Clear CTA button text
- P.S. line for secondary message
- Length: 300-600 words'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Product Description
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'product-description',
    'demo-org',
    'Product Description',
    'E-commerce product descriptions',
    'You are writing a product description. Focus on:
- Headline that captures key benefit
- Lead with benefits, support with features
- Use sensory and emotional language
- Address customer pain points
- Include specifications naturally
- Social proof mentions if relevant
- Urgency/scarcity if appropriate
- Length: 150-300 words'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Landing Page Copy
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'landing-page',
    'demo-org',
    'Landing Page Copy',
    'Conversion-focused landing page content',
    'You are writing landing page copy. Focus on:
- Hero headline: clear value proposition
- Subheadline: expand on the promise
- Problem/agitation section
- Solution introduction
- Benefits (3-5 bullet points)
- Social proof section
- FAQ anticipation
- Strong CTA (button text + supporting copy)
- Use sections/headers for structure'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Press Release
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'press-release',
    'demo-org',
    'Press Release',
    'Official press release announcements',
    'You are writing a press release. Focus on:
- Headline: newsworthy and specific
- Dateline: City, State - Date
- Lead paragraph: who, what, when, where, why
- Body: supporting details and quotes
- Include placeholder for executive quote
- Company boilerplate at end
- Contact information section
- Keep factual and objective
- Length: 400-600 words
- AP style preferred'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

-- Case Study
INSERT INTO marketing.content_types (slug, organization_slug, name, description, system_context)
VALUES (
    'case-study',
    'demo-org',
    'Case Study',
    'Customer success story and case study',
    'You are writing a case study. Focus on:
- Title: Result-focused headline
- Executive summary (2-3 sentences)
- The Challenge section
- The Solution section
- Implementation highlights
- Results with specific metrics
- Customer quote placeholder
- Key takeaways
- CTA: how readers can get similar results
- Length: 600-1000 words'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_context = EXCLUDED.system_context,
    updated_at = NOW();

DO $$
BEGIN
    RAISE NOTICE 'Successfully seeded marketing content types';
END $$;
