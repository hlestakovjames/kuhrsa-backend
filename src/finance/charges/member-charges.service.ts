import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ChargeStatus,
  FeeScheduleStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateMemberChargeDto } from './dto/create-member-charge.dto';
import { UpdateMemberChargeDto } from './dto/update-member-charge.dto';
import { WaiveMemberChargeDto } from './dto/waive-member-charge.dto';

@Injectable()
export class MemberChargesService {
  constructor(private readonly prisma: PrismaService) {}

  private getChargeStatus(
    amountDue: number,
    amountPaid: number,
  ): ChargeStatus {
    if (amountDue === 0) {
      return ChargeStatus.PAID;
    }

    if (amountPaid >= amountDue) {
      return ChargeStatus.PAID;
    }

    if (amountPaid > 0) {
      return ChargeStatus.PARTIALLY_PAID;
    }

    return ChargeStatus.UNPAID;
  }

  async findAll(
    organizationId: string,
    memberId?: string,
  ) {
    return this.prisma.memberCharge.findMany({
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
        feeSchedule: {
          include: {
            feeDefinition: true,
          },
        },
        allocations: {
          include: {
            payment: true,
          },
        },
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const charge =
      await this.prisma.memberCharge.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          member: true,
          feeSchedule: {
            include: {
              feeDefinition: true,
            },
          },
          membershipPeriod: true,
          allocations: {
            include: {
              payment: true,
            },
          },
        },
      });

    if (!charge) {
      throw new NotFoundException(
        'Member charge not found.',
      );
    }

    return charge;
  }

  async create(
    organizationId: string,
    dto: CreateMemberChargeDto,
  ) {
    if (dto.amountDue < 0) {
      throw new BadRequestException(
        'Charge amount cannot be negative.',
      );
    }

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

    const feeSchedule =
      await this.prisma.feeSchedule.findFirst({
        where: {
          id: dto.feeScheduleId,
          organizationId,
        },
      });

    if (!feeSchedule) {
      throw new NotFoundException(
        'Fee schedule not found.',
      );
    }

    if (
      feeSchedule.status ===
        FeeScheduleStatus.CANCELLED ||
      feeSchedule.status ===
        FeeScheduleStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Cancelled or expired fee schedules cannot create member charges.',
      );
    }

    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : undefined;

    if (
      dueDate !== undefined &&
      Number.isNaN(dueDate.getTime())
    ) {
      throw new BadRequestException(
        'Invalid charge due date.',
      );
    }

    const existing =
      await this.prisma.memberCharge.findFirst({
        where: {
          organizationId,
          memberId: dto.memberId,
          feeScheduleId: dto.feeScheduleId,
          status: {
            not: ChargeStatus.CANCELLED,
          },
          ...(dto.description
            ? {
                description: dto.description.trim(),
              }
            : {}),
        },
      });

    if (existing) {
      throw new ConflictException(
        'A matching member charge already exists.',
      );
    }

    return this.prisma.memberCharge.create({
      data: {
        organizationId,
        memberId: dto.memberId,
        feeScheduleId: dto.feeScheduleId,
        description:
          dto.description?.trim() || null,
        amountDue: dto.amountDue,
        amountPaid: 0,
        balance: dto.amountDue,
        currency:
          dto.currency?.trim().toUpperCase() ||
          feeSchedule.currency ||
          'KES',
        status: this.getChargeStatus(
          dto.amountDue,
          0,
        ),
        dueDate: dueDate ?? null,
      },
      include: {
        feeSchedule: {
          include: {
            feeDefinition: true,
          },
        },
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateMemberChargeDto,
  ) {
    const charge = await this.findOne(
      organizationId,
      id,
    );

    if (
      charge.status === ChargeStatus.WAIVED ||
      charge.status === ChargeStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Waived or cancelled charges cannot be modified.',
      );
    }

    const currentAmountDue =
      Number(charge.amountDue);
    const currentAmountPaid =
      Number(charge.amountPaid);

    const amountDue =
      dto.amountDue !== undefined
        ? dto.amountDue
        : currentAmountDue;

    if (amountDue < currentAmountPaid) {
      throw new BadRequestException(
        'Charge amount cannot be less than the amount already paid.',
      );
    }

    const balance =
      amountDue - currentAmountPaid;

    const status = this.getChargeStatus(
      amountDue,
      currentAmountPaid,
    );

    const dueDate =
      dto.dueDate !== undefined
        ? dto.dueDate
          ? new Date(dto.dueDate)
          : null
        : charge.dueDate;

    if (
      dueDate instanceof Date &&
      Number.isNaN(dueDate.getTime())
    ) {
      throw new BadRequestException(
        'Invalid charge due date.',
      );
    }

    return this.prisma.memberCharge.update({
      where: {
        id: charge.id,
      },
      data: {
        ...(dto.description !== undefined && {
          description:
            dto.description.trim() || null,
        }),
        ...(dto.amountDue !== undefined && {
          amountDue,
          balance,
          status,
        }),
        ...(dto.dueDate !== undefined && {
          dueDate,
        }),
      },
      include: {
        feeSchedule: {
          include: {
            feeDefinition: true,
          },
        },
      },
    });
  }

  async waive(
    organizationId: string,
    id: string,
    dto: WaiveMemberChargeDto,
    waivedBy: string,
  ) {
    const charge = await this.findOne(
      organizationId,
      id,
    );

    if (
      charge.status === ChargeStatus.PAID
    ) {
      throw new BadRequestException(
        'A fully paid charge cannot be waived.',
      );
    }

    if (
      charge.status === ChargeStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'A cancelled charge cannot be waived.',
      );
    }

    if (
      charge.status === ChargeStatus.WAIVED
    ) {
      return charge;
    }

    const amountPaid =
      Number(charge.amountPaid);

    if (amountPaid > 0) {
      throw new BadRequestException(
        'A partially paid charge cannot be waived. Adjustments must be handled through the payment and adjustment workflow.',
      );
    }

    return this.prisma.memberCharge.update({
      where: {
        id: charge.id,
      },
      data: {
        amountPaid: 0,
        balance: 0,
        status: ChargeStatus.WAIVED,
        waivedAt: new Date(),
        waivedBy,
        waiverReason: dto.reason.trim(),
      },
    });
  }

  async cancel(
    organizationId: string,
    id: string,
  ) {
    const charge = await this.findOne(
      organizationId,
      id,
    );

    if (
      charge.status === ChargeStatus.PAID
    ) {
      throw new BadRequestException(
        'A fully paid charge cannot be cancelled.',
      );
    }

    if (
      charge.status === ChargeStatus.WAIVED
    ) {
      throw new BadRequestException(
        'A waived charge cannot be cancelled.',
      );
    }

    if (
      charge.status === ChargeStatus.CANCELLED
    ) {
      return charge;
    }

    if (Number(charge.amountPaid) > 0) {
      throw new BadRequestException(
        'A charge with payments cannot be cancelled. Use the adjustment or refund workflow instead.',
      );
    }

    return this.prisma.memberCharge.update({
      where: {
        id: charge.id,
      },
      data: {
        status: ChargeStatus.CANCELLED,
      },
    });
  }

  async recalculate(
    organizationId: string,
    id: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const charge =
          await tx.memberCharge.findFirst({
            where: {
              id,
              organizationId,
            },
          });

        if (!charge) {
          throw new NotFoundException(
            'Member charge not found.',
          );
        }

        if (
          charge.status ===
            ChargeStatus.WAIVED ||
          charge.status ===
            ChargeStatus.CANCELLED
        ) {
          throw new BadRequestException(
            'Waived or cancelled charges cannot be recalculated.',
          );
        }

        const allocations =
          await tx.paymentAllocation.findMany({
            where: {
              chargeId: charge.id,
              payment: {
                organizationId,
                status: {
                  in: [
                    'COMPLETED',
                    'PARTIALLY_REFUNDED',
                  ],
                },
              },
            },
          });

        const amountPaid =
          allocations.reduce(
            (total, allocation) =>
              total + Number(allocation.amount),
            0,
          );

        const amountDue =
          Number(charge.amountDue);

        if (amountPaid > amountDue) {
          throw new ConflictException(
            'Payment allocations exceed the charge amount.',
          );
        }

        const balance =
          amountDue - amountPaid;

        const status =
          this.getChargeStatus(
            amountDue,
            amountPaid,
          );

        return tx.memberCharge.update({
          where: {
            id: charge.id,
          },
          data: {
            amountPaid,
            balance,
            status,
          },
        });
      },
    );
  }
}
