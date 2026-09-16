import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ConstitutionalMembershipCategory,
  FeeScheduleStatus,
  MemberCategory,
} from '../../../../generated/prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

import { CreateFeeScheduleDto } from './dto/create-fee-schedule.dto';
import { UpdateFeeScheduleDto } from './dto/update-fee-schedule.dto';

@Injectable()
export class FeeSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.feeSchedule.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
      include: {
        feeDefinition: true,
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const schedule = await this.prisma.feeSchedule.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        feeDefinition: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(
        'Fee schedule not found.',
      );
    }

    return schedule;
  }

  private validateDates(
    effectiveFrom: Date,
    effectiveTo?: Date,
  ) {
    if (
      effectiveTo !== undefined &&
      effectiveFrom >= effectiveTo
    ) {
      throw new BadRequestException(
        'Fee schedule effective start date must be before the end date.',
      );
    }
  }

  private async validateOverlap(
    organizationId: string,
    feeDefinitionId: string,
    effectiveFrom: Date,
    effectiveTo: Date | undefined,
    constitutionalCategory:
      | ConstitutionalMembershipCategory
      | undefined,
    memberCategory: MemberCategory | undefined,
    excludeId?: string,
  ) {
    const schedules =
      await this.prisma.feeSchedule.findMany({
        where: {
          organizationId,
          feeDefinitionId,
          id: excludeId
            ? {
                not: excludeId,
              }
            : undefined,
          status: {
            in: [
              FeeScheduleStatus.DRAFT,
              FeeScheduleStatus.ACTIVE,
            ],
          },
          constitutionalCategory:
            constitutionalCategory ?? null,
          memberCategory:
            memberCategory ?? null,
        },
      });

    const overlaps = schedules.some((schedule) => {
      const existingStart = schedule.effectiveFrom;
      const existingEnd =
        schedule.effectiveTo ?? new Date('9999-12-31T23:59:59.999Z');

      const newEnd =
        effectiveTo ?? new Date('9999-12-31T23:59:59.999Z');

      return (
        effectiveFrom < existingEnd &&
        newEnd > existingStart
      );
    });

    if (overlaps) {
      throw new ConflictException(
        'The fee schedule overlaps an existing schedule for the same fee applicability.',
      );
    }
  }

  async create(
    organizationId: string,
    feeDefinitionId: string,
    dto: CreateFeeScheduleDto,
  ) {
    const feeDefinition =
      await this.prisma.feeDefinition.findFirst({
        where: {
          id: feeDefinitionId,
          organizationId,
        },
      });

    if (!feeDefinition) {
      throw new NotFoundException(
        'Fee definition not found.',
      );
    }

    if (!feeDefinition.isActive) {
      throw new BadRequestException(
        'An inactive fee definition cannot receive a new schedule.',
      );
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo
      ? new Date(dto.effectiveTo)
      : undefined;

    this.validateDates(
      effectiveFrom,
      effectiveTo,
    );

    const validStatuses = Object.values(
      FeeScheduleStatus,
    );

    if (!validStatuses.includes(dto.status as FeeScheduleStatus)) {
      throw new BadRequestException(
        `Invalid fee schedule status. Allowed values: ${validStatuses.join(', ')}`,
      );
    }

    await this.validateOverlap(
      organizationId,
      feeDefinitionId,
      effectiveFrom,
      effectiveTo,
      dto.constitutionalCategory,
      dto.memberCategory,
    );

    return this.prisma.feeSchedule.create({
      data: {
        organizationId,
        feeDefinitionId,
        name: dto.name.trim(),
        amount: dto.amount,
        currency: dto.currency?.trim().toUpperCase() || 'KES',
        status: dto.status as FeeScheduleStatus,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
        constitutionalCategory:
          dto.constitutionalCategory ?? null,
        memberCategory:
          dto.memberCategory ?? null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        feeDefinition: true,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateFeeScheduleDto,
  ) {
    const schedule = await this.findOne(
      organizationId,
      id,
    );

    if (
      schedule.status === FeeScheduleStatus.CANCELLED ||
      schedule.status === FeeScheduleStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Cancelled or expired fee schedules cannot be modified.',
      );
    }

    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : schedule.effectiveFrom;

    const effectiveTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? new Date(dto.effectiveTo)
          : undefined
        : schedule.effectiveTo ?? undefined;

    this.validateDates(
      effectiveFrom,
      effectiveTo,
    );

    const constitutionalCategory =
      dto.constitutionalCategory !== undefined
        ? dto.constitutionalCategory
        : schedule.constitutionalCategory ?? undefined;

    const memberCategory =
      dto.memberCategory !== undefined
        ? dto.memberCategory
        : schedule.memberCategory ?? undefined;

    await this.validateOverlap(
      organizationId,
      schedule.feeDefinitionId,
      effectiveFrom,
      effectiveTo,
      constitutionalCategory,
      memberCategory,
      schedule.id,
    );

    return this.prisma.feeSchedule.update({
      where: {
        id: schedule.id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),
        ...(dto.amount !== undefined && {
          amount: dto.amount,
        }),
        ...(dto.currency !== undefined && {
          currency: dto.currency.trim().toUpperCase(),
        }),
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.effectiveFrom !== undefined && {
          effectiveFrom,
        }),
        ...(dto.effectiveTo !== undefined && {
          effectiveTo: effectiveTo ?? null,
        }),
        ...(dto.constitutionalCategory !== undefined && {
          constitutionalCategory,
        }),
        ...(dto.memberCategory !== undefined && {
          memberCategory,
        }),
        ...(dto.notes !== undefined && {
          notes: dto.notes.trim() || null,
        }),
      },
      include: {
        feeDefinition: true,
      },
    });
  }
}
