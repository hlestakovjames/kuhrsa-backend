import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import {
  PaymentMethod,
  PaymentStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async findAll(
    organizationId: string,
    memberId?: string,
  ) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        ...(memberId !== undefined && {
          memberId,
        }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        member: true,
        allocations: {
          include: {
            charge: true,
          },
        },
        receipt: true,
        mpesaTransaction: true,
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const payment =
      await this.prisma.payment.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          member: true,
          allocations: {
            include: {
              charge: {
                include: {
                  feeSchedule: {
                    include: {
                      feeDefinition: true,
                    },
                  },
                },
              },
            },
          },
          receipt: true,
          mpesaTransaction: true,
        },
      });

    if (!payment) {
      throw new NotFoundException(
        'Payment not found.',
      );
    }

    return payment;
  }

  async create(
    organizationId: string,
    dto: CreatePaymentDto,
  ) {
    const member =
      await this.prisma.member.findFirst({
        where: {
          id: dto.memberId,
          organizationId,
        },
      });

    if (!member) {
      throw new NotFoundException(
        'Member not found.',
      );
    }

    if (dto.amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }

    const reference =
      dto.reference?.trim() || undefined;

    const externalReference =
      dto.externalReference?.trim() || undefined;

    if (reference) {
      const existing =
        await this.prisma.payment.findFirst({
          where: {
            organizationId,
            reference,
          },
        });

      if (existing) {
        throw new ConflictException(
          'A payment with this reference already exists.',
        );
      }
    }

    if (externalReference) {
      const existing =
        await this.prisma.payment.findFirst({
          where: {
            organizationId,
            externalReference,
          },
        });

      if (existing) {
        throw new ConflictException(
          'A payment with this external reference already exists.',
        );
      }
    }

    try {
      return await this.prisma.payment.create({
        data: {
          organizationId,
          memberId: dto.memberId,
          amount: dto.amount,
          currency:
            dto.currency?.trim().toUpperCase() ||
            'KES',
          method: dto.method,
          status: PaymentStatus.PENDING,
          reference: reference ?? null,
          externalReference:
            externalReference ?? null,
          description:
            dto.description?.trim() || null,
          paidAt: null,
        },
        include: {
          member: true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A payment with this reference or external reference already exists.',
        );
      }

      throw error;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdatePaymentDto,
  ) {
    const payment = await this.findOne(
      organizationId,
      id,
    );

    if (
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'A fully refunded payment cannot be modified.',
      );
    }

    const reference =
      dto.reference !== undefined
        ? dto.reference.trim() || null
        : payment.reference;

    const externalReference =
      dto.externalReference !== undefined
        ? dto.externalReference.trim() || null
        : payment.externalReference;

    if (
      reference !== null &&
      reference !== payment.reference
    ) {
      const existing =
        await this.prisma.payment.findFirst({
          where: {
            organizationId,
            reference,
            id: {
              not: payment.id,
            },
          },
        });

      if (existing) {
        throw new ConflictException(
          'A payment with this reference already exists.',
        );
      }
    }

    if (
      externalReference !== null &&
      externalReference !==
        payment.externalReference
    ) {
      const existing =
        await this.prisma.payment.findFirst({
          where: {
            organizationId,
            externalReference,
            id: {
              not: payment.id,
            },
          },
        });

      if (existing) {
        throw new ConflictException(
          'A payment with this external reference already exists.',
        );
      }
    }

    try {
      return await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          ...(dto.reference !== undefined && {
            reference,
          }),
          ...(dto.externalReference !== undefined && {
            externalReference,
          }),
          ...(dto.description !== undefined && {
            description:
              dto.description.trim() || null,
          }),
        },
        include: {
          member: true,
          allocations: true,
          receipt: true,
          mpesaTransaction: true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A payment with this reference or external reference already exists.',
        );
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async cancel(
    organizationId: string,
    id: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      const payment = await tx.payment.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          member: true,
          allocations: true,
          receipt: true,
          mpesaTransaction: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found.');
      }

      if (payment.status === PaymentStatus.CANCELLED) {
        return payment;
      }

      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException(
          'A refunded payment cannot be cancelled.',
        );
      }

      if (
        payment.status === PaymentStatus.COMPLETED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestException(
          'A completed or partially refunded payment cannot be cancelled. Use the refund or adjustment workflow instead.',
        );
      }

      if (payment.receipt?.status === 'ISSUED') {
        throw new BadRequestException(
          'A payment with an issued receipt cannot be cancelled. Void the receipt and use the refund or adjustment workflow instead.',
        );
      }

      if (payment.allocations.length > 0) {
        throw new BadRequestException(
          'A payment with allocations cannot be cancelled. Reverse the allocation through the appropriate financial workflow.',
        );
      }

      return tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          paidAt: null,
        },
        include: {
          member: true,
          allocations: true,
          receipt: true,
          mpesaTransaction: true,
        },
      });
    });
  }

  async markCompleted(
    organizationId: string,
    id: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      const payment = await tx.payment.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          member: true,
          allocations: true,
          receipt: true,
          mpesaTransaction: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found.');
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        return { payment, transitioned: false };
      }

      if (payment.method === PaymentMethod.MPESA) {
        throw new BadRequestException(
          'M-Pesa payments can only be completed through a verified provider callback.',
        );
      }

      if (
        payment.status === PaymentStatus.CANCELLED ||
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestException(
          'This payment cannot be marked as completed from its current status.',
        );
      }

      const completedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
        include: {
          member: true,
          allocations: true,
          receipt: true,
          mpesaTransaction: true,
        },
      });

      return { payment: completedPayment, transitioned: true };
    });

    if (result.transitioned && this.notificationsService) {
      try {
        await this.notificationsService.notifyMemberPaymentConfirmed(
          result.payment.memberId,
          result.payment.organizationId,
          result.payment.amount.toString(),
          result.payment.currency,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown notification error.';
        this.logger.error(
          `Payment confirmation notification failed for payment ${result.payment.id}: ${message}`,
        );
      }
    }

    return result.payment;
  }
}
