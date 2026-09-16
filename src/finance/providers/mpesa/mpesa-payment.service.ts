import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MpesaService } from './mpesa.service';
import { InitiateStkDto } from './dto/initiate-stk.dto';

@Injectable()
export class MpesaPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService,
  ) {}

  async initiateStk(
    organizationId: string,
    dto: InitiateStkDto,
  ) {
    const member = await this.prisma.member.findFirst({
      where: {
        id: dto.memberId,
        organizationId,
      },
      select: {
        id: true,
        memberNumber: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        memberId: member.id,
        amount: dto.amount,
        currency: 'KES',
        method: PaymentMethod.MPESA,
        status: PaymentStatus.PENDING,
        description: dto.transactionDescription,
      },
    });

    await this.prisma.mpesaTransaction.create({
      data: {
        paymentId: payment.id,
        phoneNumber: dto.phoneNumber,
      },
    });

    try {
      const stk = await this.mpesaService.initiateStkPush({
        paymentId: payment.id,
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        accountReference:
          dto.accountReference || member.memberNumber,
        transactionDescription:
          dto.transactionDescription,
      });

      const transaction =
        await this.prisma.mpesaTransaction.update({
          where: {
            paymentId: payment.id,
          },
          data: {
            merchantRequestId:
              stk.merchantRequestId,
            checkoutRequestId:
              stk.checkoutRequestId,
          },
        });

      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.PROCESSING,
        },
      });

      return {
        payment: {
          id: payment.id,
          memberId: payment.memberId,
          amount: Number(payment.amount),
          currency: payment.currency,
          method: payment.method,
          status: PaymentStatus.PROCESSING,
        },
        mpesa: {
          merchantRequestId:
            transaction.merchantRequestId,
          checkoutRequestId:
            transaction.checkoutRequestId,
          responseCode: stk.responseCode,
          responseDescription:
            stk.responseDescription,
          customerMessage:
            stk.customerMessage,
        },
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      throw error;
    }
  }

  async getTransaction(
    organizationId: string,
    paymentId: string,
  ) {
    const payment =
      await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          organizationId,
          method: PaymentMethod.MPESA,
        },
        include: {
          mpesaTransaction: true,
          allocations: true,
          receipt: true,
        },
      });

    if (!payment) {
      throw new NotFoundException(
        'M-Pesa payment not found.',
      );
    }

    return {
      payment: {
        id: payment.id,
        memberId: payment.memberId,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt,
        reference: payment.reference,
        externalReference:
          payment.externalReference,
      },
      mpesaTransaction: payment.mpesaTransaction,
      allocations: payment.allocations,
      receipt: payment.receipt,
    };
  }
}
