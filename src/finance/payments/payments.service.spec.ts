import {
  PaymentMethod,
  PaymentStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

describe('PaymentsService status lifecycle', () => {
  let service: PaymentsService;
  let memberFindFirst: jest.Mock;
  let paymentFindFirst: jest.Mock;
  let paymentCreate: jest.Mock;
  let paymentUpdate: jest.Mock;
  let notificationsService: { notifyMemberPaymentConfirmed: jest.Mock };
  let prisma: {
    member: { findFirst: jest.Mock };
    payment: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const existingPayment = {
    id: 'payment-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amount: 250,
    currency: 'KES',
    method: PaymentMethod.MANUAL,
    status: PaymentStatus.PENDING,
    reference: null,
    externalReference: null,
    description: null,
    paidAt: null,
    allocations: [],
    receipt: null,
    mpesaTransaction: null,
  };

  beforeEach(() => {
    memberFindFirst = jest.fn().mockResolvedValue({ id: 'member-1' });
    paymentFindFirst = jest.fn().mockResolvedValue(existingPayment);
    paymentCreate = jest.fn().mockResolvedValue(existingPayment);
    paymentUpdate = jest.fn().mockResolvedValue(existingPayment);
    notificationsService = {
      notifyMemberPaymentConfirmed: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    const transactionClient = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payment: {
        findFirst: paymentFindFirst,
        update: paymentUpdate,
      },
    };

    prisma = {
      member: {
        findFirst: memberFindFirst,
      },
      payment: {
        findFirst: paymentFindFirst,
        create: paymentCreate,
        update: paymentUpdate,
      },
      $transaction: jest.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>,
        ) => callback(transactionClient),
      ),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      notificationsService as never,
    );
  });

  it('always creates a pending payment, even if a legacy caller supplies COMPLETED', async () => {
    const dto = {
      memberId: 'member-1',
      amount: 250,
      method: PaymentMethod.MANUAL,
      status: PaymentStatus.COMPLETED,
    } as unknown as CreatePaymentDto;

    await service.create('org-1', dto);

    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          memberId: 'member-1',
          status: PaymentStatus.PENDING,
          paidAt: null,
        }),
      }),
    );
  });

  it('does not allow a legacy status field through generic update', async () => {
    paymentFindFirst
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(null);

    const dto = {
      reference: 'manual-reference-1',
      status: PaymentStatus.COMPLETED,
    } as unknown as UpdatePaymentDto;

    await service.update('org-1', 'payment-1', dto);

    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1' },
        data: {
          reference: 'manual-reference-1',
        },
      }),
    );
    expect(paymentUpdate.mock.calls[0][0].data).not.toHaveProperty(
      'status',
    );
    expect(paymentUpdate.mock.calls[0][0].data).not.toHaveProperty(
      'paidAt',
    );
  });

  it('maps a database uniqueness race on payment creation to a conflict', async () => {
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create('org-1', {
        memberId: 'member-1',
        amount: 250,
        method: PaymentMethod.MANUAL,
        reference: 'manual-reference-1',
      }),
    ).rejects.toThrow(
      'A payment with this reference or external reference already exists.',
    );
  });

  it('maps a database uniqueness race on payment update to a conflict', async () => {
    paymentFindFirst
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(null);
    paymentUpdate.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.update('org-1', 'payment-1', {
        externalReference: 'bank-reference-1',
      }),
    ).rejects.toThrow(
      'A payment with this reference or external reference already exists.',
    );
  });

  it('uses the dedicated completion operation to transition a pending payment', async () => {
    await service.markCompleted('org-1', 'payment-1');

    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('creates one in-app confirmation after a payment transitions to completed', async () => {
    paymentUpdate.mockResolvedValue({
      ...existingPayment,
      status: PaymentStatus.COMPLETED,
    });

    await service.markCompleted('org-1', 'payment-1');

    expect(notificationsService.notifyMemberPaymentConfirmed).toHaveBeenCalledTimes(1);
    expect(notificationsService.notifyMemberPaymentConfirmed).toHaveBeenCalledWith(
      'member-1',
      'org-1',
      '250',
      'KES',
    );
  });

  it('does not send another confirmation when a payment is already completed', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      status: PaymentStatus.COMPLETED,
    });

    await service.markCompleted('org-1', 'payment-1');

    expect(notificationsService.notifyMemberPaymentConfirmed).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('does not manually complete an M-Pesa payment outside its verified callback', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      method: PaymentMethod.MPESA,
    });

    await expect(
      service.markCompleted('org-1', 'payment-1'),
    ).rejects.toThrow(
      'M-Pesa payments can only be completed through a verified provider callback.',
    );

    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('does not restore a partially refunded payment to completed', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      status: PaymentStatus.PARTIALLY_REFUNDED,
    });

    await expect(
      service.markCompleted('org-1', 'payment-1'),
    ).rejects.toThrow(
      'This payment cannot be marked as completed from its current status.',
    );

    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('does not cancel a completed payment', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
    });

    await expect(
      service.cancel('org-1', 'payment-1'),
    ).rejects.toThrow(
      'A completed or partially refunded payment cannot be cancelled.',
    );

    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('does not cancel a payment with an issued receipt', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      receipt: { id: 'receipt-1', status: 'ISSUED' },
    });

    await expect(
      service.cancel('org-1', 'payment-1'),
    ).rejects.toThrow(
      'A payment with an issued receipt cannot be cancelled.',
    );

    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('does not cancel a payment that already has allocations', async () => {
    paymentFindFirst.mockResolvedValue({
      ...existingPayment,
      allocations: [{ id: 'allocation-1' }],
    });

    await expect(
      service.cancel('org-1', 'payment-1'),
    ).rejects.toThrow(
      'A payment with allocations cannot be cancelled.',
    );

    expect(paymentUpdate).not.toHaveBeenCalled();
  });
});
