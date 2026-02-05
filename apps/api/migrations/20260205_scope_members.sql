-- Scope members and roles

create table if not exists huddle_scope_members (
  tenant_id text not null,
  scope_id text not null,
  user_id text not null,
  role text not null,
  primary key (tenant_id, scope_id, user_id)
);

create index if not exists huddle_scope_members_user_idx
  on huddle_scope_members (tenant_id, user_id);

create index if not exists huddle_scope_members_scope_idx
  on huddle_scope_members (tenant_id, scope_id);

-- Backfill creator as ADMIN where available
insert into huddle_scope_members (tenant_id, scope_id, user_id, role)
select tenant_id, id, created_by, 'ADMIN'
from huddle_scopes
where created_by is not null
on conflict (tenant_id, scope_id, user_id) do nothing;
