import { PaymentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { PaymentAllocationsService } from './payment-allocations.service';

describe('PaymentAllocationsService allocation integrity', () => {
  let service: PaymentAllocationsService;
  let tx: {
    $queryRaw: jest.Mock;
    payment: { findFirst: jest.Mock };
    memberCharge: { findFirst: jest.Mock; update: jest.Mock };
    paymentAllocation: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let prisma: {
    $transaction: jest.Mock;
  };

  const payment = {
    id: 'payment-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amount: 100,
    currency: 'KES',
    status: PaymentStatus.COMPLETED,
    allocations: [],
  };

  const charge = {
    id: 'charge-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amountDue: 100,
    amountPaid: 0,
    balance: 100,
    currency: 'KES',
    status: 'UNPAID',
    feeSchedule: {},
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payment: {
        findFirst: jest.fn().mockResolvedValue(payment),
      },
      memberCharge: {
        findFirst: jest.fn().mockResolvedValue(charge),
        update: jest.fn().mockResolvedValue(charge),
      },
      paymentAllocation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'allocation-1',
          paymentId: payment.id,
          chargeId: charge.id,
          amount: 50,
        }),
      },
    };

    prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    service = new PaymentAllocationsService(
      prisma as unknown as PrismaService,
    );
  });

  it('locks the organization-scoped payment and charge before reading balances', async () => {
    const dto: CreatePaymentAllocationDto = {
      chargeId: charge.id,
      amount: 50,
    };

    await service.create('org-1', payment.id, dto);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.payment.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.memberCharge.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.paymentAllocation.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an allocation that exceeds the remaining payment balance', async () => {
    tx.payment.findFirst.mockResolvedValue({
      ...payment,
      allocations: [{ amount: 80 }],
    });

    await expect(
      service.create('org-1', payment.id, {
        chargeId: charge.id,
        amount: 30,
      }),
    ).rejects.toThrow(
      'Allocation exceeds the unallocated payment balance of 20.00 KES.',
    );

    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
  });

  it('rejects allocations across different members', async () => {
    tx.memberCharge.findFirst.mockResolvedValue({
      ...charge,
      memberId: 'another-member',
    });

    await expect(
      service.create('org-1', payment.id, {
        chargeId: charge.id,
        amount: 50,
      }),
    ).rejects.toThrow(
      'The payment and charge must belong to the same member.',
    );

    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
  });
});
