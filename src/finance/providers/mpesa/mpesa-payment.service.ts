import {
  BadRequestException,
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
import { InitiateMemberStkDto } from './dto/initiate-member-stk.dto';

@Injectable()
export class MpesaPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService,
  ) {}

  async initiateMemberStk(
    organizationId: string,
    userId: string,
    dto: InitiateMemberStkDto,
  ) {
    const member = await this.prisma.member.findFirst({
      where: { organizationId, userId },
      select: { id: true, memberNumber: true },
    });

    if (!member) {
      throw new NotFoundException(
        'No member record is linked to this account.',
      );
    }

    const outstandingCharges = await this.prisma.memberCharge.findMany({
      where: {
        organizationId,
        memberId: member.id,
        status: { notIn: ['WAIVED', 'CANCELLED'] },
      },
      select: { balance: true },
    });

    const outstandingBalance = outstandingCharges.reduce(
      (total, charge) => total + Number(charge.balance),
      0,
    );

    if (outstandingBalance <= 0) {
      throw new BadRequestException(
        'There is no outstanding membership balance to pay.',
      );
    }

    if (dto.amount > outstandingBalance) {
      throw new BadRequestException(
        `Payment amount cannot exceed your outstanding balance of ${outstandingBalance.toFixed(2)} KES.`,
      );
    }

    return this.initiateStk(organizationId, {
      memberId: member.id,
      amount: dto.amount,
      phoneNumber: dto.phoneNumber,
      accountReference: member.memberNumber,
      transactionDescription: 'KUHRSA membership payment',
    });
  }

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

      /*
       * The provider callback may complete the payment before this
       * request resumes. Only move the initial PENDING state forward;
       * never overwrite a state written by the callback.
       */
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          organizationId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PROCESSING,
        },
      });

      const currentPayment = await this.prisma.payment.findFirst({
        where: {
          id: payment.id,
          organizationId,
        },
        select: {
          status: true,
        },
      });

      return {
        payment: {
          id: payment.id,
          memberId: payment.memberId,
          amount: Number(payment.amount),
          currency: payment.currency,
          method: payment.method,
          status: currentPayment?.status ?? PaymentStatus.PROCESSING,
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
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          organizationId,
          status: {
            in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
          },
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
