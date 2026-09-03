-- CreateEnum
CREATE TYPE "MemberSource" AS ENUM ('REGISTRATION', 'MIGRATION_IMPORT', 'MIGRATION_MANUAL');

-- CreateEnum
CREATE TYPE "MemberActivationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "activationStatus" "MemberActivationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "source" "MemberSource" NOT NULL DEFAULT 'REGISTRATION';

-- CreateTable
CREATE TABLE "MemberActivation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberActivation_memberId_key" ON "MemberActivation"("memberId");

-- CreateIndex
CREATE INDEX "MemberActivation_expiresAt_idx" ON "MemberActivation"("expiresAt");

-- CreateIndex
CREATE INDEX "Member_source_idx" ON "Member"("source");

-- CreateIndex
CREATE INDEX "Member_activationStatus_idx" ON "Member"("activationStatus");

-- AddForeignKey
ALTER TABLE "MemberActivation" ADD CONSTRAINT "MemberActivation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
