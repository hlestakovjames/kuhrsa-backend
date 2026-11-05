import { FinancialPeriodStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialPeriodsService } from './financial-periods.service';

describe('FinancialPeriodsService', () => {
  let service: FinancialPeriodsService;
  let tx: {
    $queryRaw: jest.Mock;
    financialPeriod: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const period = {
    id: 'period-1',
    organizationId: 'org-1',
    code: 'FY-2026',
    name: 'Financial Year 2026',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2026-12-31T23:59:59.999Z'),
    status: FinancialPeriodStatus.OPEN,
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(period),
        update: jest.fn().mockResolvedValue(period),
      },
    };

    const prisma = {
      financialPeriod: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(period),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    service = new FinancialPeriodsService(
      prisma as unknown as PrismaService,
    );
  });

  it('locks the organization before checking and creating a financial period', async () => {
    await service.create('org-1', {
      name: 'Financial Year 2027',
      code: 'FY-2027',
      startsAt: '2027-01-01T00:00:00.000Z',
      endsAt: '2027-12-31T23:59:59.999Z',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.financialPeriod.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.financialPeriod.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an overlapping period after acquiring the organization lock', async () => {
    tx.financialPeriod.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(period);

    await expect(
      service.create('org-1', {
        name: 'Overlapping period',
        code: 'FY-2026-ALT',
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2027-05-31T23:59:59.999Z',
      }),
    ).rejects.toThrow(
      'The financial period overlaps an existing financial period.',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.financialPeriod.create).not.toHaveBeenCalled();
  });

  it('locks the organization before re-reading and updating a period', async () => {
    tx.financialPeriod.findFirst
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce(null);

    await service.update('org-1', 'period-1', {
      name: 'Revised financial year',
    });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.financialPeriod.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.financialPeriod.update).toHaveBeenCalledTimes(1);
  });

  it('closes only an open period under the organization lock', async () => {
    await service.close('org-1', 'period-1');

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.financialPeriod.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.financialPeriod.update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: FinancialPeriodStatus.CLOSED },
    });
  });

  it('locks only a closed period under the organization lock', async () => {
    tx.financialPeriod.findFirst.mockResolvedValue({
      ...period,
      status: FinancialPeriodStatus.CLOSED,
    });

    await service.lock('org-1', 'period-1');

    expect(tx.financialPeriod.update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: FinancialPeriodStatus.LOCKED },
    });
  });
});
