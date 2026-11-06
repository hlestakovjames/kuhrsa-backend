import {
  PaymentMethod,
  PaymentStatus,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MpesaService } from './mpesa.service';
import { MpesaPaymentService } from './mpesa-payment.service';

describe('MpesaPaymentService', () => {
  let service: MpesaPaymentService;
  let paymentUpdateMany: jest.Mock;
  let paymentFindFirst: jest.Mock;
  let initiateStkPush: jest.Mock;

  const payment = {
    id: 'payment-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amount: 250,
    currency: 'KES',
    method: PaymentMethod.MPESA,
    status: PaymentStatus.PENDING,
  };

  beforeEach(() => {
    paymentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    paymentFindFirst = jest.fn().mockResolvedValue({
      status: PaymentStatus.PROCESSING,
    });
    initiateStkPush = jest.fn().mockResolvedValue({
      merchantRequestId: 'merchant-1',
      checkoutRequestId: 'checkout-1',
      responseCode: '0',
      responseDescription: 'Accepted',
      customerMessage: 'Request accepted',
    });

    const prisma = {
      member: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'member-1',
          memberNumber: 'KUHRSA-001',
        }),
      },
      memberCharge: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        create: jest.fn().mockResolvedValue(payment),
        updateMany: paymentUpdateMany,
        findFirst: paymentFindFirst,
      },
      mpesaTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'mpesa-1' }),
        update: jest.fn().mockResolvedValue({
          merchantRequestId: 'merchant-1',
          checkoutRequestId: 'checkout-1',
        }),
      },
    };

    service = new MpesaPaymentService(
      prisma as unknown as PrismaService,
      { initiateStkPush } as unknown as MpesaService,
    );
  });

  it('does not overwrite a payment completed by a fast callback', async () => {
    paymentFindFirst.mockResolvedValue({
      status: PaymentStatus.COMPLETED,
    });

    const result = await service.initiateStk('org-1', {
      memberId: 'member-1',
      amount: 250,
      phoneNumber: '0712345678',
      accountReference: 'KUHRSA-001',
      transactionDescription: 'Membership payment',
    });

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        organizationId: 'org-1',
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.PROCESSING },
    });
    expect(result.payment.status).toBe(PaymentStatus.COMPLETED);
  });

  it('returns PROCESSING when the payment is still awaiting its callback', async () => {
    const result = await service.initiateStk('org-1', {
      memberId: 'member-1',
      amount: 250,
      phoneNumber: '0712345678',
      accountReference: 'KUHRSA-001',
      transactionDescription: 'Membership payment',
    });

    expect(result.payment.status).toBe(PaymentStatus.PROCESSING);
  });

  it('does not mark a callback-completed payment as failed when initiation handling throws', async () => {
    initiateStkPush.mockRejectedValue(new Error('Provider timeout'));

    await expect(
      service.initiateStk('org-1', {
        memberId: 'member-1',
        amount: 250,
        phoneNumber: '0712345678',
        accountReference: 'KUHRSA-001',
        transactionDescription: 'Membership payment',
      }),
    ).rejects.toThrow('Provider timeout');

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        organizationId: 'org-1',
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
        },
      },
      data: { status: PaymentStatus.FAILED },
    });
  });
});
