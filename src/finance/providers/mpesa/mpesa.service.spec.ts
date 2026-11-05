import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MpesaService } from './mpesa.service';

describe('MpesaService callback processing', () => {
  let service: MpesaService;
  let prisma: {
    payment: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    mpesaTransaction: { update: jest.Mock };
    payment: { updateMany: jest.Mock };
    memberCharge: { findMany: jest.Mock; update: jest.Mock };
    paymentAllocation: { create: jest.Mock };
    receipt: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  };

  const payment = {
    id: 'payment-1',
    organizationId: 'org-1',
    memberId: 'member-1',
    amount: new Prisma.Decimal(150),
    currency: 'KES',
    status: 'PROCESSING',
    reference: null,
    mpesaTransaction: {
      paymentId: 'payment-1',
      checkoutRequestId: 'ws_CO_123',
      merchantRequestId: 'merchant-1',
      mpesaReceiptNumber: null,
      phoneNumber: '254712345678',
      transactionDate: null,
    },
  };

  const callback = (resultCode = 0, amount = 150) => ({
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant-1',
        CheckoutRequestID: 'ws_CO_123',
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? 'Success' : 'Cancelled by user',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: amount },
            { Name: 'MpesaReceiptNumber', Value: 'QAB123XYZ' },
            { Name: 'PhoneNumber', Value: 254712345678 },
            { Name: 'TransactionDate', Value: 20261105163000 },
          ],
        },
      },
    },
  });

  beforeEach(() => {
    tx = {
      mpesaTransaction: { update: jest.fn().mockResolvedValue({}) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      memberCharge: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'charge-1',
            amountDue: new Prisma.Decimal(100),
            amountPaid: new Prisma.Decimal(0),
            balance: new Prisma.Decimal(100),
          },
          {
            id: 'charge-2',
            amountDue: new Prisma.Decimal(100),
            amountPaid: new Prisma.Decimal(0),
            balance: new Prisma.Decimal(100),
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentAllocation: { create: jest.fn().mockResolvedValue({}) },
      receipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn((work) => work(tx)),
    };

    service = new MpesaService(prisma as unknown as PrismaService);
  });

  it('allocates a successful payment oldest-first and issues one receipt', async () => {
    await service.handleCallback(callback() as never);

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'payment-1' }),
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(tx.paymentAllocation.create).toHaveBeenCalledTimes(2);
    expect(tx.paymentAllocation.create).toHaveBeenNthCalledWith(1, {
      data: { paymentId: 'payment-1', chargeId: 'charge-1', amount: new Prisma.Decimal(100) },
    });
    expect(tx.paymentAllocation.create).toHaveBeenNthCalledWith(2, {
      data: { paymentId: 'payment-1', chargeId: 'charge-2', amount: new Prisma.Decimal(50) },
    });
    expect(tx.memberCharge.update).toHaveBeenCalledTimes(2);
    expect(tx.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          memberId: 'member-1',
          paymentId: 'payment-1',
          amount: new Prisma.Decimal(150),
          currency: 'KES',
        }),
      }),
    );
  });

  it('does not allocate or issue a receipt when another callback already completed the payment', async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 0 });

    await service.handleCallback(callback() as never);

    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
    expect(tx.memberCharge.update).not.toHaveBeenCalled();
    expect(tx.receipt.create).not.toHaveBeenCalled();
  });

  it('marks a failed STK callback without allocating or issuing a receipt', async () => {
    await service.handleCallback(callback(1032) as never);

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
    expect(tx.receipt.create).not.toHaveBeenCalled();
  });

  it('rejects a callback amount mismatch from completing the payment', async () => {
    await service.handleCallback(callback(0, 120) as never);

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
    expect(tx.receipt.create).not.toHaveBeenCalled();
    expect(tx.mpesaTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultDescription: expect.stringContaining('Callback amount mismatch'),
        }),
      }),
    );
  });
});
