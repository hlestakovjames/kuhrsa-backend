import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentStatus,
  ReceiptStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ReceiptsService } from './receipts.service';

describe('ReceiptsService', () => {
  let service: ReceiptsService;

  let prisma: {
    receipt: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      findFirst: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  let tx: {
    receipt: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      findFirst: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  const organizationId = 'org-1';
  const paymentId = 'payment-1';
  const receiptId = 'receipt-1';
  const memberId = 'member-1';
  const userId = 'user-1';

  const completedPayment = {
    id: paymentId,
    organizationId,
    memberId,
    amount: 250,
    currency: 'KES',
    status: PaymentStatus.COMPLETED,
    receipt: null,
    allocations: [],
    member: { id: memberId },
  };

  const issuedReceipt = {
    id: receiptId,
    organizationId,
    memberId,
    paymentId,
    receiptNumber: 'KUHRSA-2026-123456',
    status: ReceiptStatus.ISSUED,
    amount: 250,
    currency: 'KES',
    member: { id: memberId },
    payment: { id: paymentId },
  };

  beforeEach(() => {
    tx = {
      receipt: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    prisma = {
      receipt: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    };

    service = new ReceiptsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('locks the payment before reading it and issuing a receipt', async () => {
      tx.payment.findFirst.mockResolvedValue(completedPayment);
      tx.receipt.findFirst.mockResolvedValue(null);
      tx.receipt.create.mockResolvedValue(issuedReceipt);

      const result = await service.create(organizationId, {
        paymentId,
      } as any);

      expect(result).toEqual(issuedReceipt);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId, organizationId },
        }),
      );
      expect(tx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            memberId,
            paymentId,
            status: ReceiptStatus.ISSUED,
            amount: completedPayment.amount,
            currency: completedPayment.currency,
          }),
        }),
      );

      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.payment.findFirst.mock.invocationCallOrder[0],
      );
      expect(tx.payment.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
        tx.receipt.create.mock.invocationCallOrder[0],
      );
    });

    it('rejects when the payment does not exist', async () => {
      tx.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.create(organizationId, { paymentId } as any),
      ).rejects.toThrow(NotFoundException);

      expect(tx.receipt.create).not.toHaveBeenCalled();
    });

    it('rejects payments that are not completed', async () => {
      tx.payment.findFirst.mockResolvedValue({
        ...completedPayment,
        status: PaymentStatus.PENDING,
      });

      await expect(
        service.create(organizationId, { paymentId } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.receipt.create).not.toHaveBeenCalled();
    });

    it('rejects zero-value payments', async () => {
      tx.payment.findFirst.mockResolvedValue({
        ...completedPayment,
        amount: 0,
      });

      await expect(
        service.create(organizationId, { paymentId } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.receipt.create).not.toHaveBeenCalled();
    });

    it('rejects a payment that already has a receipt', async () => {
      tx.payment.findFirst.mockResolvedValue({
        ...completedPayment,
        receipt: issuedReceipt,
      });

      await expect(
        service.create(organizationId, { paymentId } as any),
      ).rejects.toThrow(ConflictException);

      expect(tx.receipt.create).not.toHaveBeenCalled();
    });
  });

  describe('void', () => {
    it('locks the receipt before reading and voiding it', async () => {
      tx.receipt.findFirst.mockResolvedValue(issuedReceipt);
      tx.receipt.update.mockResolvedValue({
        ...issuedReceipt,
        status: ReceiptStatus.VOIDED,
        voidedBy: userId,
        voidReason: 'Duplicate receipt',
      });

      const result = await service.void(
        organizationId,
        receiptId,
        { reason: '  Duplicate receipt  ' } as any,
        userId,
      );

      expect(result.status).toBe(ReceiptStatus.VOIDED);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.receipt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: receiptId, organizationId },
        }),
      );
      expect(tx.receipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: receiptId },
          data: expect.objectContaining({
            status: ReceiptStatus.VOIDED,
            voidedBy: userId,
            voidReason: 'Duplicate receipt',
            voidedAt: expect.any(Date),
          }),
        }),
      );

      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.receipt.findFirst.mock.invocationCallOrder[0],
      );
      expect(tx.receipt.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
        tx.receipt.update.mock.invocationCallOrder[0],
      );
    });

    it('rejects when the receipt does not exist', async () => {
      tx.receipt.findFirst.mockResolvedValue(null);

      await expect(
        service.void(
          organizationId,
          receiptId,
          { reason: 'Duplicate receipt' } as any,
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(tx.receipt.update).not.toHaveBeenCalled();
    });

    it('returns an already-voided receipt without updating it again', async () => {
      const voidedReceipt = {
        ...issuedReceipt,
        status: ReceiptStatus.VOIDED,
        voidReason: 'Previously voided',
      };

      tx.receipt.findFirst.mockResolvedValue(voidedReceipt);

      const result = await service.void(
        organizationId,
        receiptId,
        { reason: '' } as any,
        userId,
      );

      expect(result).toEqual(voidedReceipt);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.receipt.update).not.toHaveBeenCalled();
    });

    it('rejects an empty void reason', async () => {
      tx.receipt.findFirst.mockResolvedValue(issuedReceipt);

      await expect(
        service.void(
          organizationId,
          receiptId,
          { reason: '   ' } as any,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(tx.receipt.update).not.toHaveBeenCalled();
    });
  });
});
