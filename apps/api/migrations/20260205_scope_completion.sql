-- Scope completion metadata

alter table if exists huddle_scopes
  add column if not exists completion_status text;

alter table if exists huddle_scopes
  add column if not exists completion_comment text;

alter table if exists huddle_scopes
  add column if not exists completed_at timestamptz;

alter table if exists huddle_scopes
  add column if not exists completed_by text;
