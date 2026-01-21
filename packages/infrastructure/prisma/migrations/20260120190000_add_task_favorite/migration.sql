-- Add favorite flag to Task
ALTER TABLE "Task" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
