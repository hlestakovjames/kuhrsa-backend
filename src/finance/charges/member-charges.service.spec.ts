import { ChargeStatus, FeeScheduleStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberChargesService } from './member-charges.service';

describe('MemberChargesService allocation coordination', () => {
  let service: MemberChargesService;
  let tx: {
    $queryRaw: jest.Mock;
    member: { findFirst: jest.Mock };
    feeSchedule: { findFirst: jest.Mock };
    memberCharge: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    paymentAllocation: { findMany: jest.Mock };
  };

  const charge = {
    id: 'charge-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amountDue: 100,
    amountPaid: 0,
    balance: 100,
    status: ChargeStatus.UNPAID,
    dueDate: null,
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      member: {
        findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
      feeSchedule: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'schedule-1',
          organizationId: 'org-1',
          status: FeeScheduleStatus.ACTIVE,
          currency: 'KES',
        }),
      },
      memberCharge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(charge),
        update: jest.fn().mockResolvedValue(charge),
      },
      paymentAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = {
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    service = new MemberChargesService(
      prisma as unknown as PrismaService,
    );
  });

  it('locks the member before checking and creating a charge', async () => {
    await service.create('org-1', {
      memberId: 'member-1',
      feeScheduleId: 'schedule-1',
      amountDue: 100,
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.member.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.member.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.memberCharge.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.memberCharge.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.memberCharge.create.mock.invocationCallOrder[0],
    );
  });

  it('does not create a charge when the member does not exist', async () => {
    tx.member.findFirst.mockResolvedValue(null);

    await expect(
      service.create('org-1', {
        memberId: 'missing-member',
        feeScheduleId: 'schedule-1',
        amountDue: 100,
      }),
    ).rejects.toThrow('Member not found.');

    expect(tx.memberCharge.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate charge', async () => {
    tx.memberCharge.findFirst.mockResolvedValue(charge);

    await expect(
      service.create('org-1', {
        memberId: 'member-1',
        feeScheduleId: 'schedule-1',
        amountDue: 100,
      }),
    ).rejects.toThrow('A matching member charge already exists.');

    expect(tx.memberCharge.create).not.toHaveBeenCalled();
  });

  it('locks the charge before changing its amount or description', async () => {
    await service.update('org-1', 'charge-1', {
      description: 'Updated charge',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.memberCharge.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.memberCharge.update).toHaveBeenCalledTimes(1);
  });

  it('locks and re-reads the charge before waiving it', async () => {
    await service.waive(
      'org-1',
      'charge-1',
      { reason: 'Approved waiver' },
      'admin-1',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.memberCharge.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.memberCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ChargeStatus.WAIVED,
        }),
      }),
    );
  });

  it('does not cancel a charge that has received allocations', async () => {
    tx.memberCharge.findFirst.mockResolvedValue({
      ...charge,
      amountPaid: 25,
      balance: 75,
      status: ChargeStatus.PARTIALLY_PAID,
    });

    await expect(
      service.cancel('org-1', 'charge-1'),
    ).rejects.toThrow(
      'A charge with payments cannot be cancelled.',
    );

    expect(tx.memberCharge.update).not.toHaveBeenCalled();
  });

  it('locks the charge before recalculating its allocation total', async () => {
    await service.recalculate('org-1', 'charge-1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.memberCharge.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.paymentAllocation.findMany).toHaveBeenCalledTimes(1);
  });
});
