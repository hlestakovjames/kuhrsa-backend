-- CreateEnum
CREATE TYPE "MigrationBatchStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'IMPORTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "MigrationBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" "MemberSource" NOT NULL,
    "status" "MigrationBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationBatchRow" (
    "id" TEXT NOT NULL,
    "migrationBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "MigrationRowStatus" NOT NULL DEFAULT 'PENDING',
    "category" "MemberCategory",
    "firstName" TEXT,
    "lastName" TEXT,
    "registrationNumber" TEXT,
    "nationalId" TEXT,
    "staffNumber" TEXT,
    "yearOfStudy" INTEGER,
    "graduationYear" INTEGER,
    "programme" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "county" TEXT,
    "memberId" TEXT,
    "memberNumber" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationBatchRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationBatch_organizationId_idx" ON "MigrationBatch"("organizationId");

-- CreateIndex
CREATE INDEX "MigrationBatch_status_idx" ON "MigrationBatch"("status");

-- CreateIndex
CREATE INDEX "MigrationBatch_createdBy_idx" ON "MigrationBatch"("createdBy");

-- CreateIndex
CREATE INDEX "MigrationBatch_createdAt_idx" ON "MigrationBatch"("createdAt");

-- CreateIndex
CREATE INDEX "MigrationBatchRow_migrationBatchId_idx" ON "MigrationBatchRow"("migrationBatchId");

-- CreateIndex
CREATE INDEX "MigrationBatchRow_status_idx" ON "MigrationBatchRow"("status");

-- CreateIndex
CREATE INDEX "MigrationBatchRow_memberId_idx" ON "MigrationBatchRow"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationBatchRow_migrationBatchId_rowNumber_key" ON "MigrationBatchRow"("migrationBatchId", "rowNumber");

-- AddForeignKey
ALTER TABLE "MigrationBatch" ADD CONSTRAINT "MigrationBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationBatchRow" ADD CONSTRAINT "MigrationBatchRow_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "MigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
