import { randomUUID } from 'crypto';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_TEST_URL;

const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('M-Pesa member allocation PostgreSQL lock', () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
  });

  const organizationId = randomUUID();
  const memberId = randomUUID();
  const organizationCode = `MPESA_LOCK_TEST_${organizationId}`;
  const memberNumber = `MPESA-LOCK-${memberId}`;

  beforeAll(async () => {
    await pool.query(
      'INSERT INTO "Organization" ("id", "name", "code", "updatedAt") VALUES ($1, $2, $3, NOW())',
      [organizationId, 'M-Pesa lock integration test', organizationCode],
    );

    await pool.query(
      'INSERT INTO "Member" ("id", "organizationId", "memberNumber", "updatedAt") VALUES ($1, $2, $3, NOW())',
      [memberId, organizationId, memberNumber],
    );
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM "Member" WHERE "id" = $1', [memberId]);
      await pool.query('DELETE FROM "Organization" WHERE "id" = $1', [
        organizationId,
      ]);
    } finally {
      await pool.end();
    }
  });

  it(
    'blocks a second payment transaction until the first member lock commits',
    async () => {
      const first = await pool.connect();
      const second = await pool.connect();
      let secondLockAcquired = false;

      try {
        await first.query('BEGIN');
        await first.query(
          'SELECT "id" FROM "Member" WHERE "id" = $1 FOR UPDATE',
          [memberId],
        );

        await second.query('BEGIN');
        const secondLock = second
          .query(
            'SELECT "id" FROM "Member" WHERE "id" = $1 FOR UPDATE',
            [memberId],
          )
          .then(() => {
            secondLockAcquired = true;
          });

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(secondLockAcquired).toBe(false);

        await first.query('COMMIT');
        await secondLock;

        expect(secondLockAcquired).toBe(true);
        await second.query('COMMIT');
      } catch (error) {
        await first.query('ROLLBACK').catch(() => undefined);
        await second.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        first.release();
        second.release();
      }
    },
    15000,
  );
});
