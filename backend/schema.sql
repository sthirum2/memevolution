-- Canonical Supabase/PostgreSQL schema. The app also creates these tables on startup.
create table if not exists experiments (
  id text primary key,
  generation integer not null,
  parent_id text references experiments(id),
  status text not null default 'selected',
  hypothesis text not null,
  mutations jsonb not null default '[]'::jsonb,
  deployment_platform text not null default 'tiktok',
  post_id text,
  created_at timestamptz not null default now(),
  deployed_at timestamptz
);

create table if not exists genomes (
  experiment_id text primary key references experiments(id) on delete cascade,
  topic text not null, humor text not null, format text not null, hook text not null,
  absurdity double precision not null, irony double precision not null,
  relatability double precision not null, trend_relevance double precision not null,
  video_length integer not null
);

create table if not exists predictions (
  experiment_id text primary key references experiments(id) on delete cascade,
  predicted_fitness double precision not null,
  model_version text not null
);

create table if not exists engagement_snapshots (
  id bigserial primary key,
  experiment_id text not null references experiments(id) on delete cascade,
  timestamp timestamptz not null default now(),
  views integer not null, likes integer not null, comments integer not null,
  shares integer not null, saves integer not null, fitness double precision
);

create index if not exists experiments_generation_idx on experiments(generation);
create index if not exists engagement_snapshots_experiment_idx on engagement_snapshots(experiment_id);

create table if not exists agent_states (
  generation integer primary key,
  strategy_json jsonb not null,
  created_at timestamptz not null default now()
);