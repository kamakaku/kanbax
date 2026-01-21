-- Add due date and attachments to Task
ALTER TABLE "Task" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "attachments" JSONB;
