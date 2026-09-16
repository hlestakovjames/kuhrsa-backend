-- CreateEnum
CREATE TYPE "ConstitutionalMembershipCategory" AS ENUM ('ORDINARY', 'ASSOCIATE', 'ALUMNI', 'HONORARY');

-- CreateEnum
CREATE TYPE "GoodStandingStatus" AS ENUM ('GOOD_STANDING', 'NOT_IN_GOOD_STANDING', 'EXTENSION_GRANTED');

-- CreateEnum
CREATE TYPE "FinancialComplianceStatus" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'EXTENSION_GRANTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "DisciplinaryStatus" AS ENUM ('CLEAR', 'UNDER_REVIEW', 'SANCTIONED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "constitutionalCategory" "ConstitutionalMembershipCategory" NOT NULL DEFAULT 'ORDINARY',
ADD COLUMN     "disciplinaryStatus" "DisciplinaryStatus" NOT NULL DEFAULT 'CLEAR',
ADD COLUMN     "financialStatus" "FinancialComplianceStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "goodStandingStatus" "GoodStandingStatus" NOT NULL DEFAULT 'GOOD_STANDING',
ALTER COLUMN "activationStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Member_constitutionalCategory_idx" ON "Member"("constitutionalCategory");

-- CreateIndex
CREATE INDEX "Member_goodStandingStatus_idx" ON "Member"("goodStandingStatus");

-- CreateIndex
CREATE INDEX "Member_financialStatus_idx" ON "Member"("financialStatus");

-- CreateIndex
CREATE INDEX "Member_disciplinaryStatus_idx" ON "Member"("disciplinaryStatus");
