-- Add comments and checklist to Task
ALTER TABLE "Task" ADD COLUMN "comments" JSONB;
ALTER TABLE "Task" ADD COLUMN "checklist" JSONB;
