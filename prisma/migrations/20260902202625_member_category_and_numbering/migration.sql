-- CreateEnum
CREATE TYPE "MemberCategory" AS ENUM ('STUDENT', 'ALUMNI', 'LECTURER');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "category" "MemberCategory" NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE "MemberNumberSequence" (
    "id" TEXT NOT NULL,
    "category" "MemberCategory" NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberNumberSequence_category_key" ON "MemberNumberSequence"("category");
