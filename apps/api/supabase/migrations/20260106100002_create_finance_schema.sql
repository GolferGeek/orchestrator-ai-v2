-- =============================================================================
-- FINANCE LEARNING-LOOP SCHEMA
-- =============================================================================
-- Finance trading intelligence system with:
-- - Universe configuration and versioning
-- - Market data bars and engineered features
-- - News/world events tracking
-- - Agenda/manipulation detection (LLM-extracted)
-- - Trading recommendations with evaluation
-- - Postmortem analysis and learning loop
-- Created: 2026-01-06
-- =============================================================================

-- Create finance schema
CREATE SCHEMA IF NOT EXISTS finance;
COMMENT ON SCHEMA finance IS 'Finance learning-loop agent data: market data, features, recommendations, outcomes, learning';

-- Grant usage on schema
GRANT USAGE ON SCHEMA finance TO postgres, anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON SEQUENCES TO service_role;

-- =============================================================================
-- UNIVERSES TABLE
-- =============================================================================
-- Trading universe configuration (org_slug gated to 'finance')
-- =============================================================================

CREATE TABLE finance.universes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_slug TEXT NOT NULL REFERENCES public.organizations(slug) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Unique constraint
    UNIQUE(org_slug, slug)
);

-- Indexes for common queries
CREATE INDEX idx_finance_universes_org ON finance.universes(org_slug);
CREATE INDEX idx_finance_universes_slug ON finance.universes(slug);
CREATE INDEX idx_finance_universes_created_by ON finance.universes(created_by);
CREATE INDEX idx_finance_universes_created_at ON finance.universes(created_at DESC);

COMMENT ON TABLE finance.universes IS 'Trading universe definitions (org_slug gated to finance)';
COMMENT ON COLUMN finance.universes.slug IS 'URL-safe unique identifier within org';
COMMENT ON COLUMN finance.universes.metadata IS 'JSON: additional universe configuration';

-- =============================================================================
-- UNIVERSE VERSIONS TABLE
-- =============================================================================
-- Version tracking for universe configurations
-- =============================================================================

CREATE TABLE finance.universe_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES finance.universes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT false,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per universe
    UNIQUE(universe_id, version)
);

-- Indexes for common queries
CREATE INDEX idx_finance_universe_versions_universe ON finance.universe_versions(universe_id);
CREATE INDEX idx_finance_universe_versions_active ON finance.universe_versions(universe_id, is_active) WHERE is_active = true;
CREATE INDEX idx_finance_universe_versions_created_at ON finance.universe_versions(created_at DESC);

COMMENT ON TABLE finance.universe_versions IS 'Version history for universe configurations';
COMMENT ON COLUMN finance.universe_versions.config_json IS 'JSON: instruments, feature definitions, model parameters';
COMMENT ON COLUMN finance.universe_versions.is_active IS 'Only one version can be active per universe';

-- =============================================================================
-- MARKET BARS TABLE
-- =============================================================================
-- Raw OHLCV market data
-- =============================================================================

CREATE TABLE finance.market_bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    open NUMERIC(20, 8) NOT NULL,
    high NUMERIC(20, 8) NOT NULL,
    low NUMERIC(20, 8) NOT NULL,
    close NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 8),
    vendor TEXT,
    ingestion_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per instrument and timestamp
    UNIQUE(instrument, ts)
);

-- Indexes for common queries
CREATE INDEX idx_finance_market_bars_instrument ON finance.market_bars(instrument);
CREATE INDEX idx_finance_market_bars_ts ON finance.market_bars(ts DESC);
CREATE INDEX idx_finance_market_bars_instrument_ts ON finance.market_bars(instrument, ts DESC);
CREATE INDEX idx_finance_market_bars_vendor ON finance.market_bars(vendor);
CREATE INDEX idx_finance_market_bars_created_at ON finance.market_bars(created_at DESC);

COMMENT ON TABLE finance.market_bars IS 'Raw OHLCV market data from vendors';
COMMENT ON COLUMN finance.market_bars.instrument IS 'Instrument identifier (e.g., AAPL, BTC-USD)';
COMMENT ON COLUMN finance.market_bars.ts IS 'Bar timestamp';
COMMENT ON COLUMN finance.market_bars.ingestion_metadata IS 'JSON: vendor-specific metadata, data quality flags';

-- =============================================================================
-- MARKET FEATURES TABLE
-- =============================================================================
-- Engineered features derived from market data
-- =============================================================================

CREATE TABLE finance.market_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_version_id UUID NOT NULL REFERENCES finance.universe_versions(id) ON DELETE CASCADE,
    asof_ts TIMESTAMPTZ NOT NULL,
    instrument TEXT NOT NULL,
    feature_set_version_id TEXT NOT NULL,
    features_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(universe_version_id, asof_ts, instrument, feature_set_version_id)
);

-- Indexes for common queries
CREATE INDEX idx_finance_market_features_universe_version ON finance.market_features(universe_version_id);
CREATE INDEX idx_finance_market_features_asof_ts ON finance.market_features(asof_ts DESC);
CREATE INDEX idx_finance_market_features_instrument ON finance.market_features(instrument);
CREATE INDEX idx_finance_market_features_feature_set ON finance.market_features(feature_set_version_id);
CREATE INDEX idx_finance_market_features_universe_ts ON finance.market_features(universe_version_id, asof_ts DESC);
CREATE INDEX idx_finance_market_features_created_at ON finance.market_features(created_at DESC);

COMMENT ON TABLE finance.market_features IS 'Engineered features derived from market bars';
COMMENT ON COLUMN finance.market_features.asof_ts IS 'Point-in-time timestamp for feature values';
COMMENT ON COLUMN finance.market_features.feature_set_version_id IS 'Version of feature engineering pipeline';
COMMENT ON COLUMN finance.market_features.features_json IS 'JSON: technical indicators, derived features';

-- =============================================================================
-- NEWS ITEMS TABLE
-- =============================================================================
-- News and world events for sentiment analysis
-- =============================================================================

CREATE TABLE finance.news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    url TEXT,
    title TEXT NOT NULL,
    snippet TEXT,
    vendor_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    retrieval_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint on URL if provided
    UNIQUE NULLS NOT DISTINCT(url)
);

-- Indexes for common queries
CREATE INDEX idx_finance_news_items_source ON finance.news_items(source);
CREATE INDEX idx_finance_news_items_published_at ON finance.news_items(published_at DESC);
CREATE INDEX idx_finance_news_items_vendor_ids ON finance.news_items USING GIN(vendor_ids);
CREATE INDEX idx_finance_news_items_created_at ON finance.news_items(created_at DESC);

COMMENT ON TABLE finance.news_items IS 'News and world events for sentiment analysis';
COMMENT ON COLUMN finance.news_items.source IS 'News source (e.g., Reuters, Bloomberg)';
COMMENT ON COLUMN finance.news_items.vendor_ids IS 'Array of vendor-specific identifiers';
COMMENT ON COLUMN finance.news_items.retrieval_metadata IS 'JSON: scraping metadata, API response data';

-- =============================================================================
-- AGENDA EVENTS TABLE
-- =============================================================================
-- LLM-extracted market manipulation signals and narratives
-- =============================================================================

CREATE TABLE finance.agenda_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asof_ts TIMESTAMPTZ NOT NULL,
    source_refs TEXT[] DEFAULT ARRAY[]::TEXT[],
    narrative TEXT NOT NULL,
    suspected_incentive TEXT,
    target_instruments TEXT[] DEFAULT ARRAY[]::TEXT[],
    confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    evidence_json JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_finance_agenda_events_asof_ts ON finance.agenda_events(asof_ts DESC);
CREATE INDEX idx_finance_agenda_events_target_instruments ON finance.agenda_events USING GIN(target_instruments);
CREATE INDEX idx_finance_agenda_events_confidence ON finance.agenda_events(confidence DESC);
CREATE INDEX idx_finance_agenda_events_created_at ON finance.agenda_events(created_at DESC);

COMMENT ON TABLE finance.agenda_events IS 'LLM-extracted market manipulation signals and narratives';
COMMENT ON COLUMN finance.agenda_events.asof_ts IS 'When the agenda event was detected';
COMMENT ON COLUMN finance.agenda_events.source_refs IS 'Array of news_items.id or external URLs';
COMMENT ON COLUMN finance.agenda_events.narrative IS 'Human-readable description of detected agenda';
COMMENT ON COLUMN finance.agenda_events.suspected_incentive IS 'Who benefits from this narrative';
COMMENT ON COLUMN finance.agenda_events.target_instruments IS 'Instruments likely affected';
COMMENT ON COLUMN finance.agenda_events.confidence IS 'Model confidence score (0-1)';
COMMENT ON COLUMN finance.agenda_events.evidence_json IS 'JSON: supporting quotes, patterns, correlations';

-- =============================================================================
-- AGENDA FEATURES TABLE
-- =============================================================================
-- Derived features from agenda events for model input
-- =============================================================================

CREATE TABLE finance.agenda_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_version_id UUID NOT NULL REFERENCES finance.universe_versions(id) ON DELETE CASCADE,
    asof_ts TIMESTAMPTZ NOT NULL,
    instrument TEXT NOT NULL,
    agenda_features_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(universe_version_id, asof_ts, instrument)
);

-- Indexes for common queries
CREATE INDEX idx_finance_agenda_features_universe_version ON finance.agenda_features(universe_version_id);
CREATE INDEX idx_finance_agenda_features_asof_ts ON finance.agenda_features(asof_ts DESC);
CREATE INDEX idx_finance_agenda_features_instrument ON finance.agenda_features(instrument);
CREATE INDEX idx_finance_agenda_features_universe_ts ON finance.agenda_features(universe_version_id, asof_ts DESC);
CREATE INDEX idx_finance_agenda_features_created_at ON finance.agenda_features(created_at DESC);

COMMENT ON TABLE finance.agenda_features IS 'Derived features from agenda events for model input';
COMMENT ON COLUMN finance.agenda_features.asof_ts IS 'Point-in-time timestamp for feature values';
COMMENT ON COLUMN finance.agenda_features.agenda_features_json IS 'JSON: sentiment scores, narrative embeddings, event counts';

-- =============================================================================
-- RECOMMENDATION RUNS TABLE
-- =============================================================================
-- Batch execution tracking for trading recommendations
-- =============================================================================

CREATE TABLE finance.recommendation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_version_id UUID NOT NULL REFERENCES finance.universe_versions(id) ON DELETE CASCADE,
    run_ts TIMESTAMPTZ NOT NULL,
    produced_by_agent TEXT NOT NULL,
    inputs_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'running',
        'completed',
        'failed'
    )),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_finance_recommendation_runs_universe_version ON finance.recommendation_runs(universe_version_id);
CREATE INDEX idx_finance_recommendation_runs_run_ts ON finance.recommendation_runs(run_ts DESC);
CREATE INDEX idx_finance_recommendation_runs_agent ON finance.recommendation_runs(produced_by_agent);
CREATE INDEX idx_finance_recommendation_runs_status ON finance.recommendation_runs(status);
CREATE INDEX idx_finance_recommendation_runs_created_at ON finance.recommendation_runs(created_at DESC);

COMMENT ON TABLE finance.recommendation_runs IS 'Batch execution tracking for trading recommendations';
COMMENT ON COLUMN finance.recommendation_runs.run_ts IS 'When the recommendation run started';
COMMENT ON COLUMN finance.recommendation_runs.produced_by_agent IS 'Agent identifier (org_slug/agent_slug)';
COMMENT ON COLUMN finance.recommendation_runs.inputs_hash IS 'Hash of input features for reproducibility';

-- =============================================================================
-- RECOMMENDATIONS TABLE
-- =============================================================================
-- Individual trading recommendations with rationale
-- =============================================================================

CREATE TABLE finance.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES finance.recommendation_runs(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'hold')),
    timing_window JSONB,
    entry_style TEXT CHECK (entry_style IN ('market', 'limit', 'stop', 'scaled')),
    intended_price NUMERIC(20, 8),
    sizing_json JSONB DEFAULT '{}'::jsonb,
    rationale TEXT,
    model_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_finance_recommendations_run ON finance.recommendations(run_id);
CREATE INDEX idx_finance_recommendations_instrument ON finance.recommendations(instrument);
CREATE INDEX idx_finance_recommendations_action ON finance.recommendations(action);
CREATE INDEX idx_finance_recommendations_created_at ON finance.recommendations(created_at DESC);

COMMENT ON TABLE finance.recommendations IS 'Individual trading recommendations with rationale';
COMMENT ON COLUMN finance.recommendations.action IS 'Trading action: buy, sell, hold';
COMMENT ON COLUMN finance.recommendations.timing_window IS 'JSON: {start_ts, end_ts} for execution window';
COMMENT ON COLUMN finance.recommendations.entry_style IS 'Order type for execution';
COMMENT ON COLUMN finance.recommendations.intended_price IS 'Target price for limit/stop orders';
COMMENT ON COLUMN finance.recommendations.sizing_json IS 'JSON: position sizing, risk parameters';
COMMENT ON COLUMN finance.recommendations.model_metadata IS 'JSON: model version, feature importance, confidence';

-- =============================================================================
-- RECOMMENDATION OUTCOMES TABLE
-- =============================================================================
-- Realized performance metrics for recommendations
-- =============================================================================

CREATE TABLE finance.recommendation_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES finance.recommendations(id) ON DELETE CASCADE,
    realized_return_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    win_loss TEXT CHECK (win_loss IN ('win', 'loss', 'neutral')),
    evaluation_notes TEXT,
    evaluated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint (one outcome per recommendation)
    UNIQUE(recommendation_id)
);

-- Indexes for common queries
CREATE INDEX idx_finance_recommendation_outcomes_recommendation ON finance.recommendation_outcomes(recommendation_id);
CREATE INDEX idx_finance_recommendation_outcomes_win_loss ON finance.recommendation_outcomes(win_loss);
CREATE INDEX idx_finance_recommendation_outcomes_evaluated_at ON finance.recommendation_outcomes(evaluated_at DESC);
CREATE INDEX idx_finance_recommendation_outcomes_created_at ON finance.recommendation_outcomes(created_at DESC);

COMMENT ON TABLE finance.recommendation_outcomes IS 'Realized performance metrics for recommendations';
COMMENT ON COLUMN finance.recommendation_outcomes.realized_return_metrics_json IS 'JSON: PnL, Sharpe, max drawdown, fill price, execution quality';
COMMENT ON COLUMN finance.recommendation_outcomes.win_loss IS 'Simple classification of outcome';
COMMENT ON COLUMN finance.recommendation_outcomes.evaluated_at IS 'When the outcome was evaluated';

-- =============================================================================
-- POSTMORTEMS TABLE
-- =============================================================================
-- Learning loop analysis linking outcomes to agenda events
-- =============================================================================

CREATE TABLE finance.postmortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES finance.recommendations(id) ON DELETE CASCADE,
    what_happened TEXT NOT NULL,
    why_it_happened TEXT,
    links_to_agenda_events UUID[] DEFAULT ARRAY[]::UUID[],
    lessons TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_finance_postmortems_recommendation ON finance.postmortems(recommendation_id);
CREATE INDEX idx_finance_postmortems_agenda_events ON finance.postmortems USING GIN(links_to_agenda_events);
CREATE INDEX idx_finance_postmortems_created_at ON finance.postmortems(created_at DESC);

COMMENT ON TABLE finance.postmortems IS 'Learning loop analysis linking outcomes to agenda events';
COMMENT ON COLUMN finance.postmortems.what_happened IS 'Factual description of outcome';
COMMENT ON COLUMN finance.postmortems.why_it_happened IS 'Root cause analysis';
COMMENT ON COLUMN finance.postmortems.links_to_agenda_events IS 'Array of agenda_events.id that influenced outcome';
COMMENT ON COLUMN finance.postmortems.lessons IS 'Actionable learnings for future recommendations';

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

-- Universes updated_at trigger
CREATE TRIGGER set_finance_universes_updated_at
    BEFORE UPDATE ON finance.universes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE finance.universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.universe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.market_bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.market_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.agenda_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.recommendation_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.postmortems ENABLE ROW LEVEL SECURITY;

-- Universes: viewable by finance org members only
CREATE POLICY "universes_finance_org_read" ON finance.universes
    FOR SELECT USING (
        org_slug = 'finance'
        AND org_slug IN (
            SELECT o.slug FROM public.organizations o
            JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
            WHERE r.user_id = auth.uid()
        )
    );

-- Universe versions: viewable if parent universe is viewable
CREATE POLICY "universe_versions_read" ON finance.universe_versions
    FOR SELECT USING (
        universe_id IN (
            SELECT id FROM finance.universes
            WHERE org_slug = 'finance'
            AND org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- Market bars: viewable by finance org members
CREATE POLICY "market_bars_finance_org_read" ON finance.market_bars
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organizations o
            JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
            WHERE r.user_id = auth.uid()
            AND o.slug = 'finance'
        )
    );

-- Market features: viewable if parent universe version is viewable
CREATE POLICY "market_features_read" ON finance.market_features
    FOR SELECT USING (
        universe_version_id IN (
            SELECT uv.id FROM finance.universe_versions uv
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- News items: viewable by finance org members
CREATE POLICY "news_items_finance_org_read" ON finance.news_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organizations o
            JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
            WHERE r.user_id = auth.uid()
            AND o.slug = 'finance'
        )
    );

-- Agenda events: viewable by finance org members
CREATE POLICY "agenda_events_finance_org_read" ON finance.agenda_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organizations o
            JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
            WHERE r.user_id = auth.uid()
            AND o.slug = 'finance'
        )
    );

-- Agenda features: viewable if parent universe version is viewable
CREATE POLICY "agenda_features_read" ON finance.agenda_features
    FOR SELECT USING (
        universe_version_id IN (
            SELECT uv.id FROM finance.universe_versions uv
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- Recommendation runs: viewable if parent universe version is viewable
CREATE POLICY "recommendation_runs_read" ON finance.recommendation_runs
    FOR SELECT USING (
        universe_version_id IN (
            SELECT uv.id FROM finance.universe_versions uv
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- Recommendations: viewable if parent run is viewable
CREATE POLICY "recommendations_read" ON finance.recommendations
    FOR SELECT USING (
        run_id IN (
            SELECT rr.id FROM finance.recommendation_runs rr
            JOIN finance.universe_versions uv ON uv.id = rr.universe_version_id
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- Recommendation outcomes: viewable if parent recommendation is viewable
CREATE POLICY "recommendation_outcomes_read" ON finance.recommendation_outcomes
    FOR SELECT USING (
        recommendation_id IN (
            SELECT rec.id FROM finance.recommendations rec
            JOIN finance.recommendation_runs rr ON rr.id = rec.run_id
            JOIN finance.universe_versions uv ON uv.id = rr.universe_version_id
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- Postmortems: viewable if parent recommendation is viewable
CREATE POLICY "postmortems_read" ON finance.postmortems
    FOR SELECT USING (
        recommendation_id IN (
            SELECT rec.id FROM finance.recommendations rec
            JOIN finance.recommendation_runs rr ON rr.id = rec.run_id
            JOIN finance.universe_versions uv ON uv.id = rr.universe_version_id
            JOIN finance.universes u ON u.id = uv.universe_id
            WHERE u.org_slug = 'finance'
            AND u.org_slug IN (
                SELECT o.slug FROM public.organizations o
                JOIN public.rbac_user_org_roles r ON r.organization_slug = o.slug
                WHERE r.user_id = auth.uid()
            )
        )
    );

-- =============================================================================
-- SERVICE ROLE BYPASS
-- =============================================================================

CREATE POLICY "service_role_universes" ON finance.universes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_universe_versions" ON finance.universe_versions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_market_bars" ON finance.market_bars
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_market_features" ON finance.market_features
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_news_items" ON finance.news_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_agenda_events" ON finance.agenda_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_agenda_features" ON finance.agenda_features
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_recommendation_runs" ON finance.recommendation_runs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_recommendations" ON finance.recommendations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_recommendation_outcomes" ON finance.recommendation_outcomes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_postmortems" ON finance.postmortems
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get active universe version configuration
CREATE OR REPLACE FUNCTION finance.get_active_universe_config(p_universe_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT config_json
    INTO result
    FROM finance.universe_versions
    WHERE universe_id = p_universe_id
    AND is_active = true
    LIMIT 1;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION finance.get_active_universe_config IS 'Get the active configuration for a universe';

-- Function to get recommendation performance summary
CREATE OR REPLACE FUNCTION finance.get_recommendation_performance(p_run_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'run_id', p_run_id,
        'total_recommendations', COUNT(r.id),
        'evaluated_count', COUNT(ro.id),
        'wins', COUNT(CASE WHEN ro.win_loss = 'win' THEN 1 END),
        'losses', COUNT(CASE WHEN ro.win_loss = 'loss' THEN 1 END),
        'neutral', COUNT(CASE WHEN ro.win_loss = 'neutral' THEN 1 END),
        'win_rate',
            CASE
                WHEN COUNT(ro.id) > 0 THEN
                    ROUND(COUNT(CASE WHEN ro.win_loss = 'win' THEN 1 END)::NUMERIC / COUNT(ro.id)::NUMERIC, 4)
                ELSE 0
            END,
        'postmortem_count', COUNT(pm.id)
    )
    INTO result
    FROM finance.recommendations r
    LEFT JOIN finance.recommendation_outcomes ro ON ro.recommendation_id = r.id
    LEFT JOIN finance.postmortems pm ON pm.recommendation_id = r.id
    WHERE r.run_id = p_run_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION finance.get_recommendation_performance IS 'Get performance summary for a recommendation run';

-- Function to link recommendations to relevant agenda events
CREATE OR REPLACE FUNCTION finance.get_recommendation_agenda_context(
    p_recommendation_id UUID,
    p_lookback_hours INTEGER DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
    rec_instrument TEXT;
    rec_created TIMESTAMPTZ;
    result JSONB;
BEGIN
    -- Get recommendation details
    SELECT r.instrument, r.created_at
    INTO rec_instrument, rec_created
    FROM finance.recommendations r
    WHERE r.id = p_recommendation_id;

    -- Find relevant agenda events
    SELECT jsonb_agg(jsonb_build_object(
        'agenda_event_id', ae.id,
        'narrative', ae.narrative,
        'suspected_incentive', ae.suspected_incentive,
        'confidence', ae.confidence,
        'asof_ts', ae.asof_ts
    ) ORDER BY ae.confidence DESC, ae.asof_ts DESC)
    INTO result
    FROM finance.agenda_events ae
    WHERE rec_instrument = ANY(ae.target_instruments)
    AND ae.asof_ts >= rec_created - (p_lookback_hours || ' hours')::INTERVAL
    AND ae.asof_ts <= rec_created;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION finance.get_recommendation_agenda_context IS 'Get relevant agenda events for a recommendation';

-- =============================================================================
-- LOG SUCCESS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Finance schema created successfully';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - finance.universes (trading universe definitions)';
    RAISE NOTICE '  - finance.universe_versions (version tracking)';
    RAISE NOTICE '  - finance.market_bars (raw OHLCV data)';
    RAISE NOTICE '  - finance.market_features (engineered features)';
    RAISE NOTICE '  - finance.news_items (news and world events)';
    RAISE NOTICE '  - finance.agenda_events (LLM-extracted manipulation signals)';
    RAISE NOTICE '  - finance.agenda_features (derived agenda features)';
    RAISE NOTICE '  - finance.recommendation_runs (batch execution tracking)';
    RAISE NOTICE '  - finance.recommendations (trading recommendations)';
    RAISE NOTICE '  - finance.recommendation_outcomes (performance metrics)';
    RAISE NOTICE '  - finance.postmortems (learning loop analysis)';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - finance.get_active_universe_config()';
    RAISE NOTICE '  - finance.get_recommendation_performance()';
    RAISE NOTICE '  - finance.get_recommendation_agenda_context()';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'RLS policies: All tables gated to org_slug = finance';
    RAISE NOTICE 'Service role: Bypass policies enabled on all tables';
    RAISE NOTICE '================================================';
END $$;
