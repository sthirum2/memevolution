-- PostgreSQL only; run after schema.sql, inside a transaction.
-- Also run automatically by application startup. Requires TimescaleDB >= 2.13.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Additive application migrations for databases created before the content
-- column was introduced. The default backfills existing rows safely.
ALTER TABLE experiments
    ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS experiments_status_idx ON experiments(status);
-- New experiments are Instagram-only; retain historical rows as recorded.
ALTER TABLE experiments ALTER COLUMN deployment_platform SET DEFAULT 'instagram';

-- Lock the referenced table first when migrating existing observations.
LOCK TABLE experiments IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE engagement_snapshots IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE
    existing_key text;
BEGIN
    SELECT conname INTO existing_key
    FROM pg_constraint
    WHERE conrelid = 'engagement_snapshots'::regclass AND contype = 'p'
      AND NOT (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'engagement_snapshots'::regclass
                 AND attname = 'timestamp') = ANY(conkey);
    IF existing_key IS NOT NULL THEN
        EXECUTE format('ALTER TABLE engagement_snapshots DROP CONSTRAINT %I', existing_key);
        ALTER TABLE engagement_snapshots ADD PRIMARY KEY (id, timestamp);
    END IF;
END $$;

SELECT create_hypertable('engagement_snapshots', by_range('timestamp'),
                        if_not_exists => TRUE, migrate_data => TRUE);
CREATE INDEX IF NOT EXISTS engagement_snapshots_experiment_time_idx
    ON engagement_snapshots (experiment_id, timestamp, id);
