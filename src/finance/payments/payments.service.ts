import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentMethod,
  PaymentStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const status =
      dto.status ?? PaymentStatus.COMPLETED;

    const paidAt =
      status === PaymentStatus.COMPLETED
        ? new Date()
        : null;

    return this.prisma.payment.create({
      data: {
        organizationId,
        memberId: dto.memberId,
        amount: dto.amount,
        currency:
          dto.currency?.trim().toUpperCase() ||
          'KES',
        method: dto.method,
        status,
        reference: reference ?? null,
        externalReference:
          externalReference ?? null,
        description:
          dto.description?.trim() || null,
        paidAt,
      },
      include: {
        member: true,
      },
    });
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

    const status =
      dto.status ?? payment.status;

    let paidAt = payment.paidAt;

    if (
      status === PaymentStatus.COMPLETED &&
      payment.status !== PaymentStatus.COMPLETED
    ) {
      paidAt = new Date();
    }

    if (
      status !== PaymentStatus.COMPLETED &&
      status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      paidAt = null;
    }

    return this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        ...(dto.status !== undefined && {
          status,
          paidAt,
        }),
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
  }

  async cancel(
    organizationId: string,
    id: string,
  ) {
    const payment = await this.findOne(
      organizationId,
      id,
    );

    if (
      payment.status === PaymentStatus.CANCELLED
    ) {
      return payment;
    }

    if (
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'A refunded payment cannot be cancelled.',
      );
    }

    if (payment.allocations.length > 0) {
      throw new BadRequestException(
        'A payment with allocations cannot be cancelled. Reverse the allocation through the appropriate financial workflow.',
      );
    }

    return this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.CANCELLED,
        paidAt: null,
      },
    });
  }

  async markCompleted(
    organizationId: string,
    id: string,
  ) {
    const payment = await this.findOne(
      organizationId,
      id,
    );

    if (
      payment.status === PaymentStatus.COMPLETED
    ) {
      return payment;
    }

    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'This payment cannot be marked as completed from its current status.',
      );
    }

    return this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      },
    });
  }
}
