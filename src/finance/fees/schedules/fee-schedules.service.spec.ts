import { FeeScheduleStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeeSchedulesService } from './fee-schedules.service';

describe('FeeSchedulesService', () => {
  let service: FeeSchedulesService;
  let tx: {
    $queryRaw: jest.Mock;
    feeDefinition: { findFirst: jest.Mock };
    feeSchedule: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let prismaFeeScheduleFindMany: jest.Mock;
  let prismaFeeScheduleFindFirst: jest.Mock;

  const schedule = {
    id: 'schedule-1',
    organizationId: 'org-1',
    feeDefinitionId: 'fee-definition-1',
    name: 'Annual membership',
    amount: 200,
    currency: 'KES',
    status: FeeScheduleStatus.DRAFT,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    constitutionalCategory: null,
    memberCategory: null,
    feeDefinition: { id: 'fee-definition-1', isActive: true },
  };

  beforeEach(() => {
    prismaFeeScheduleFindMany = jest.fn().mockResolvedValue([]);
    prismaFeeScheduleFindFirst = jest.fn().mockResolvedValue(schedule);

    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      feeDefinition: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fee-definition-1',
          organizationId: 'org-1',
          isActive: true,
        }),
      },
      feeSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(schedule),
        create: jest.fn().mockResolvedValue(schedule),
        update: jest.fn().mockResolvedValue(schedule),
      },
    };

    const prisma = {
      feeSchedule: {
        findMany: prismaFeeScheduleFindMany,
        findFirst: prismaFeeScheduleFindFirst,
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    service = new FeeSchedulesService(
      prisma as unknown as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists schedules only for the requested fee definition and organization', async () => {
    await service.findAll('org-1', 'fee-definition-1');

    expect(prismaFeeScheduleFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        feeDefinitionId: 'fee-definition-1',
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { feeDefinition: true },
    });
  });

  it('finds a schedule only within the requested fee definition and organization', async () => {
    await expect(
      service.findOne('org-1', 'fee-definition-1', 'schedule-1'),
    ).resolves.toBe(schedule);

    expect(prismaFeeScheduleFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'schedule-1',
        organizationId: 'org-1',
        feeDefinitionId: 'fee-definition-1',
      },
      include: { feeDefinition: true },
    });
  });

  it('does not find a schedule through a different fee definition URL', async () => {
    prismaFeeScheduleFindFirst.mockResolvedValue(null);

    await expect(
      service.findOne('org-1', 'fee-definition-2', 'schedule-1'),
    ).rejects.toThrow('Fee schedule not found.');
  });

  it('locks the fee definition before checking overlap and creating a schedule', async () => {
    await service.create('org-1', 'fee-definition-1', {
      name: 'Annual membership',
      amount: 200,
      effectiveFrom: '2027-01-01T00:00:00.000Z',
      status: FeeScheduleStatus.DRAFT,
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.feeDefinition.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.feeSchedule.findMany).toHaveBeenCalledTimes(1);
    expect(tx.feeSchedule.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an overlapping schedule while holding the fee-definition lock', async () => {
    tx.feeSchedule.findMany.mockResolvedValue([schedule]);

    await expect(
      service.create('org-1', 'fee-definition-1', {
        name: 'Overlapping schedule',
        amount: 250,
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        status: FeeScheduleStatus.DRAFT,
      }),
    ).rejects.toThrow(
      'The fee schedule overlaps an existing schedule for the same fee applicability.',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.feeSchedule.create).not.toHaveBeenCalled();
  });

  it('locks the fee definition before re-reading and updating a schedule', async () => {
    await service.update(
      'org-1',
      'fee-definition-1',
      'schedule-1',
      { name: 'Revised annual membership' },
    );

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.feeSchedule.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.feeSchedule.update).toHaveBeenCalledTimes(1);
  });
});
