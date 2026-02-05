-- Dev reset: delete all huddles, tasks, scopes, inbox items, timeline overrides

-- Shared state tables
truncate table if exists huddle_inbox_items cascade;
truncate table if exists huddle_timeline_overrides cascade;
truncate table if exists huddle_scopes cascade;

-- Core domain tables (Prisma)
truncate table if exists "Task" cascade;
truncate table if exists "Board" cascade;
truncate table if exists "Objective" cascade;
truncate table if exists "KeyResult" cascade;
truncate table if exists "TeamInvite" cascade;
truncate table if exists "TeamMembership" cascade;
truncate table if exists "Tenant" cascade;
