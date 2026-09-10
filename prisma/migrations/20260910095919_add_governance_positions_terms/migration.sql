-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PositionAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "PositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isExecutive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TermStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "PositionAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "endedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAssignmentRole" (
    "id" TEXT NOT NULL,
    "positionAssignmentId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "PositionAssignmentRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_organizationId_idx" ON "Position"("organizationId");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_isExecutive_idx" ON "Position"("isExecutive");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_code_key" ON "Position"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Term_organizationId_idx" ON "Term"("organizationId");

-- CreateIndex
CREATE INDEX "Term_status_idx" ON "Term"("status");

-- CreateIndex
CREATE INDEX "Term_startsAt_endsAt_idx" ON "Term"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Term_organizationId_code_key" ON "Term"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PositionAssignment_organizationId_idx" ON "PositionAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "PositionAssignment_memberId_idx" ON "PositionAssignment"("memberId");

-- CreateIndex
CREATE INDEX "PositionAssignment_positionId_idx" ON "PositionAssignment"("positionId");

-- CreateIndex
CREATE INDEX "PositionAssignment_termId_idx" ON "PositionAssignment"("termId");

-- CreateIndex
CREATE INDEX "PositionAssignment_status_idx" ON "PositionAssignment"("status");

-- CreateIndex
CREATE INDEX "PositionAssignment_startsAt_endsAt_idx" ON "PositionAssignment"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PositionAssignment_memberId_positionId_termId_key" ON "PositionAssignment"("memberId", "positionId", "termId");

-- CreateIndex
CREATE INDEX "PositionAssignmentRole_positionAssignmentId_idx" ON "PositionAssignmentRole"("positionAssignmentId");

-- CreateIndex
CREATE INDEX "PositionAssignmentRole_roleId_idx" ON "PositionAssignmentRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionAssignmentRole_positionAssignmentId_roleId_key" ON "PositionAssignmentRole"("positionAssignmentId", "roleId");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignmentRole" ADD CONSTRAINT "PositionAssignmentRole_positionAssignmentId_fkey" FOREIGN KEY ("positionAssignmentId") REFERENCES "PositionAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAssignmentRole" ADD CONSTRAINT "PositionAssignmentRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
