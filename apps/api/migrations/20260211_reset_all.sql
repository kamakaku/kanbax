-- Full reset: delete all users, items, tasks, scopes, initiatives, and related data
do $$
declare
  t text;
  tables text[] := array[
    'public.huddle_inbox_items',
    'public.huddle_timeline_overrides',
    'public.huddle_scopes',
    'public.huddle_scope_members',
    'public.huddle_task_favorites',
    'public."TaskFavorite"',
    'public."Task"',
    'public."Board"',
    'public."Objective"',
    'public."KeyResult"',
    'public."TeamInvite"',
    'public."TeamMembership"',
    'public."PolicyContext"',
    'public."AuditEvent"',
    'public."RolePermission"',
    'public."Role"',
    'public."Permission"',
    'public."PrincipalRole"',
    'public."Principal"',
    'public."Secret"',
    'public."Tenant"',
    'public."User"'
  ];
begin
  foreach t in array tables loop
    if to_regclass(t) is not null then
      execute 'truncate table ' || t || ' cascade';
    end if;
  end loop;
end $$;
