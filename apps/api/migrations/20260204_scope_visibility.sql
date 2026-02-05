-- Add visibility + creator to scopes

alter table if exists huddle_scopes
  add column if not exists visibility text not null default 'shared';

alter table if exists huddle_scopes
  add column if not exists created_by text;

create index if not exists huddle_scopes_visibility_idx
  on huddle_scopes (tenant_id, visibility);

create index if not exists huddle_scopes_created_by_idx
  on huddle_scopes (tenant_id, created_by);
