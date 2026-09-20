-- PostgreSQL/Tiger schema. Run timescale.sql afterward in the same transaction.
-- Application startup handles both automatically; SQLite uses SQLAlchemy only.
create table if not exists experiments (
  id varchar(100) primary key,
  generation integer not null,
  parent_id varchar(100) references experiments(id),
  status text not null default 'selected',
  hypothesis text not null,
  mutations jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  deployment_platform text not null default 'instagram',
  post_id varchar(200),
  created_at timestamptz not null default now(),
  deployed_at timestamptz
);

create table if not exists genomes (
  experiment_id varchar(100) primary key references experiments(id) on delete cascade,
  topic text not null, humor text not null, format text not null, hook text not null,
  absurdity double precision not null, irony double precision not null,
  relatability double precision not null, trend_relevance double precision not null,
  video_length integer not null
);

create table if not exists predictions (
  experiment_id varchar(100) primary key references experiments(id) on delete cascade,
  predicted_fitness double precision not null,
  model_version text not null
);

create table if not exists engagement_snapshots (
  id serial,
  experiment_id varchar(100) not null references experiments(id) on delete cascade,
  timestamp timestamptz not null default now(),
  views integer, likes integer, comments integer,
  shares integer, saves integer, fitness double precision,
  primary key (id, timestamp)
);

create index if not exists experiments_generation_idx on experiments(generation);
create index if not exists experiments_status_idx on experiments(status);
create index if not exists engagement_snapshots_experiment_idx on engagement_snapshots(experiment_id);

create table if not exists agent_states (
  generation integer primary key,
  strategy_json jsonb not null,
  created_at timestamptz not null default now()
);
