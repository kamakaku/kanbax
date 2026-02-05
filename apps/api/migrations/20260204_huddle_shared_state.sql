-- Shared state for inbox, timeline overrides, and scopes per huddle (tenant)

create table if not exists huddle_inbox_items (
  tenant_id text not null,
  id text not null,
  title text not null,
  description text,
  source text,
  suggested_action text,
  priority text,
  kind text,
  creator_id text,
  creator_label text,
  creator_avatar_url text,
  created_at timestamptz not null,
  status text not null default 'eingang',
  primary key (tenant_id, id)
);

create index if not exists huddle_inbox_items_tenant_status_idx
  on huddle_inbox_items (tenant_id, status);

create table if not exists huddle_timeline_overrides (
  tenant_id text not null,
  task_id text not null,
  date timestamptz not null,
  is_point boolean not null default false,
  duration_days int,
  primary key (tenant_id, task_id)
);

create table if not exists huddle_scopes (
  tenant_id text not null,
  id text not null,
  name text not null,
  description text,
  start_date date,
  end_date date,
  task_ids jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
