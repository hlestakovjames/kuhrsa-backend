/*
  Warnings:

  - A unique constraint covering the columns `[registrationNumber]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "registrationNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_registrationNumber_key" ON "Member"("registrationNumber");
