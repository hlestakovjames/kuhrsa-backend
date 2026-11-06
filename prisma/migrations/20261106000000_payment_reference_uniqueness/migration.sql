-- Enforce the same organisation-scoped uniqueness already checked by
-- PaymentsService. Abort with a clear message rather than silently losing
-- or rewriting existing payment records if historical duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Payment"
    WHERE "reference" IS NOT NULL
    GROUP BY "organizationId", "reference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce payment reference uniqueness: duplicate non-null references exist within an organization. Resolve duplicates before retrying this migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Payment"
    WHERE "externalReference" IS NOT NULL
    GROUP BY "organizationId", "externalReference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce external payment reference uniqueness: duplicate non-null external references exist within an organization. Resolve duplicates before retrying this migration.';
  END IF;
END $;

-- Remove the former single-column indexes replaced by the
-- organization-scoped composite unique indexes below.
DROP INDEX IF EXISTS "Payment_reference_idx";
DROP INDEX IF EXISTS "Payment_externalReference_idx";

CREATE UNIQUE INDEX "Payment_organizationId_reference_key"
ON "Payment"("organizationId", "reference");

CREATE UNIQUE INDEX "Payment_organizationId_externalReference_key"
ON "Payment"("organizationId", "externalReference");
