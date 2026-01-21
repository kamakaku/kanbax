-- Add linked task ids
ALTER TABLE "Task" ADD COLUMN "linkedTaskIds" JSONB;
