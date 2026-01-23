/*
  Warnings:

  - The `confidence` column on the `Objective` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Objective" DROP COLUMN "confidence",
ADD COLUMN     "confidence" INTEGER;
