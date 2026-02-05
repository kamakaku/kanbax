-- Per-user task favorites

create table if not exists huddle_task_favorites (
  tenant_id text not null,
  task_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, task_id, user_id)
);

create index if not exists huddle_task_favorites_user_idx
  on huddle_task_favorites (tenant_id, user_id);

create index if not exists huddle_task_favorites_task_idx
  on huddle_task_favorites (tenant_id, task_id);
