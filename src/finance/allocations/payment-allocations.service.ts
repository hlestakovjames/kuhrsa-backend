import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';

@Injectable()
export class PaymentAllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    paymentId?: string,
    chargeId?: string,
  ) {
    return this.prisma.paymentAllocation.findMany({
      where: {
        ...(paymentId !== undefined && {
          paymentId,
        }),
        ...(chargeId !== undefined && {
          chargeId,
        }),
        payment: {
          organizationId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: {
          include: {
            member: true,
          },
        },
        charge: {
          include: {
            member: true,
            feeSchedule: {
              include: {
                feeDefinition: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const allocation =
      await this.prisma.paymentAllocation.findFirst({
        where: {
          id,
          payment: {
            organizationId,
          },
        },
        include: {
          payment: {
            include: {
              member: true,
            },
          },
          charge: {
            include: {
              member: true,
              feeSchedule: {
                include: {
                  feeDefinition: true,
                },
              },
            },
          },
        },
      });

    if (!allocation) {
      throw new NotFoundException(
        'Payment allocation not found.',
      );
    }

    return allocation;
  }

  async create(
    organizationId: string,
    paymentId: string,
    dto: CreatePaymentAllocationDto,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException(
        'Allocation amount must be greater than zero.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment =
        await tx.payment.findFirst({
          where: {
            id: paymentId,
            organizationId,
          },
          include: {
            allocations: true,
          },
        });

      if (!payment) {
        throw new NotFoundException(
          'Payment not found.',
        );
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          'Only completed payments can be allocated.',
        );
      }

      const charge =
        await tx.memberCharge.findFirst({
          where: {
            id: dto.chargeId,
            organizationId,
          },
          include: {
            feeSchedule: true,
          },
        });

      if (!charge) {
        throw new NotFoundException(
          'Member charge not found.',
        );
      }

      if (charge.memberId !== payment.memberId) {
        throw new BadRequestException(
          'The payment and charge must belong to the same member.',
        );
      }

      if (charge.status === 'CANCELLED') {
        throw new BadRequestException(
          'A cancelled charge cannot receive an allocation.',
        );
      }

      if (charge.status === 'WAIVED') {
        throw new BadRequestException(
          'A waived charge cannot receive an allocation.',
        );
      }

      if (Number(charge.balance) <= 0) {
        throw new BadRequestException(
          'This charge has no outstanding balance.',
        );
      }

      if (payment.currency !== charge.currency) {
        throw new BadRequestException(
          'Payment and charge currencies must match.',
        );
      }

      const existingAllocation =
        await tx.paymentAllocation.findUnique({
          where: {
            paymentId_chargeId: {
              paymentId,
              chargeId: charge.id,
            },
          },
        });

      if (existingAllocation) {
        throw new ConflictException(
          'This payment has already been allocated to this charge.',
        );
      }

      const allocatedAmount =
        payment.allocations.reduce(
          (total, allocation) =>
            total + Number(allocation.amount),
          0,
        );

      const paymentRemaining =
        Number(payment.amount) - allocatedAmount;

      if (dto.amount > paymentRemaining) {
        throw new BadRequestException(
          `Allocation exceeds the unallocated payment balance of ${paymentRemaining.toFixed(2)} ${payment.currency}.`,
        );
      }

      const chargeBalance =
        Number(charge.balance);

      if (dto.amount > chargeBalance) {
        throw new BadRequestException(
          `Allocation exceeds the outstanding charge balance of ${chargeBalance.toFixed(2)} ${charge.currency}.`,
        );
      }

      const newAmountPaid =
        Number(charge.amountPaid) + dto.amount;

      const newBalance =
        Number(charge.amountDue) - newAmountPaid;

      const newStatus =
        newBalance <= 0
          ? 'PAID'
          : 'PARTIALLY_PAID';

      const allocation =
        await tx.paymentAllocation.create({
          data: {
            paymentId,
            chargeId: charge.id,
            amount: dto.amount,
          },
          include: {
            payment: {
              include: {
                member: true,
              },
            },
            charge: {
              include: {
                member: true,
                feeSchedule: {
                  include: {
                    feeDefinition: true,
                  },
                },
              },
            },
          },
        });

      await tx.memberCharge.update({
        where: {
          id: charge.id,
        },
        data: {
          amountPaid: newAmountPaid,
          balance: Math.max(newBalance, 0),
          status: newStatus,
        },
      });

      return allocation;
    });
  }
}
