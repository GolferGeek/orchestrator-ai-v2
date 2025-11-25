-- LangGraph Checkpoint Schema Migration
-- Creates the schema and tables required for LangGraph persistence
-- Based on @langchain/langgraph-checkpoint-postgres requirements

-- Create langgraph schema
CREATE SCHEMA IF NOT EXISTS langgraph;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA langgraph TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA langgraph TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA langgraph GRANT ALL ON TABLES TO postgres;

-- Checkpoints table - stores graph state at each checkpoint
CREATE TABLE IF NOT EXISTS langgraph.checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- Index for faster lookup by thread
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id
    ON langgraph.checkpoints(thread_id);

-- Index for parent checkpoint lookups (for history traversal)
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent
    ON langgraph.checkpoints(thread_id, checkpoint_ns, parent_checkpoint_id);

-- Checkpoint blobs table - stores large binary data separately
CREATE TABLE IF NOT EXISTS langgraph.checkpoint_blobs (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    blob BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

-- Index for blob lookups
CREATE INDEX IF NOT EXISTS idx_checkpoint_blobs_thread
    ON langgraph.checkpoint_blobs(thread_id, checkpoint_ns);

-- Checkpoint writes table - stores pending writes before commit
CREATE TABLE IF NOT EXISTS langgraph.checkpoint_writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    blob BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- Index for write lookups
CREATE INDEX IF NOT EXISTS idx_checkpoint_writes_thread
    ON langgraph.checkpoint_writes(thread_id, checkpoint_ns, checkpoint_id);

-- Comments for documentation
COMMENT ON SCHEMA langgraph IS 'LangGraph checkpoint persistence schema';
COMMENT ON TABLE langgraph.checkpoints IS 'Stores graph state checkpoints for resumable workflows';
COMMENT ON TABLE langgraph.checkpoint_blobs IS 'Stores large binary channel data separately from checkpoints';
COMMENT ON TABLE langgraph.checkpoint_writes IS 'Stores pending writes before checkpoint commit';
