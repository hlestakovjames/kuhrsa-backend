-- CreateEnum
CREATE TYPE "MembershipPeriodStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MembershipPeriod" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipYear" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "MembershipPeriodStatus" NOT NULL DEFAULT 'PENDING',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipPeriod_organizationId_idx" ON "MembershipPeriod"("organizationId");

-- CreateIndex
CREATE INDEX "MembershipPeriod_status_idx" ON "MembershipPeriod"("status");

-- CreateIndex
CREATE INDEX "MembershipPeriod_startsAt_endsAt_idx" ON "MembershipPeriod"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPeriod_memberId_membershipYear_key" ON "MembershipPeriod"("memberId", "membershipYear");

-- CreateIndex
CREATE INDEX "UserRole_startsAt_idx" ON "UserRole"("startsAt");

-- CreateIndex
CREATE INDEX "UserRole_endsAt_idx" ON "UserRole"("endsAt");

-- CreateIndex
CREATE INDEX "UserRole_revokedAt_idx" ON "UserRole"("revokedAt");

-- AddForeignKey
ALTER TABLE "MembershipPeriod" ADD CONSTRAINT "MembershipPeriod_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPeriod" ADD CONSTRAINT "MembershipPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
