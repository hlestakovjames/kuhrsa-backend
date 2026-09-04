-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "address" TEXT,
ADD COLUMN     "admissionNumber" TEXT,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "programme" TEXT,
ADD COLUMN     "yearOfStudy" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
