/*
  Warnings:

  - The `yearOfStudy` column on the `Member` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[nationalId]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[staffNumber]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "staffNumber" TEXT,
DROP COLUMN "yearOfStudy",
ADD COLUMN     "yearOfStudy" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Member_nationalId_key" ON "Member"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_staffNumber_key" ON "Member"("staffNumber");
