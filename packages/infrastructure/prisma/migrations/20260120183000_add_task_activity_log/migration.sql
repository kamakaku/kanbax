-- Add activity log to Task
ALTER TABLE "Task" ADD COLUMN "activityLog" JSONB;
