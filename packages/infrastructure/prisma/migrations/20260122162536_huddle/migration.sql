-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "boardId" TEXT NOT NULL DEFAULT 'default-board';

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("tenantId","id")
);

-- Seed default board for existing tenants to satisfy FK
INSERT INTO "Board" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT 'default-board', "id", 'Main Board', NOW(), NOW()
FROM "Tenant"
ON CONFLICT ("tenantId", "id") DO NOTHING;

-- CreateIndex
CREATE INDEX "Board_tenantId_idx" ON "Board"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Board_tenantId_name_key" ON "Board"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_tenantId_boardId_fkey" FOREIGN KEY ("tenantId", "boardId") REFERENCES "Board"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
