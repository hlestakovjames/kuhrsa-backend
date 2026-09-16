import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FinancialPeriodStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateFinancialPeriodDto } from './dto/create-financial-period.dto';
import { UpdateFinancialPeriodDto } from './dto/update-financial-period.dto';

@Injectable()
export class FinancialPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.financialPeriod.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        startsAt: 'desc',
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const period = await this.prisma.financialPeriod.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!period) {
      throw new NotFoundException(
        'Financial period not found.',
      );
    }

    return period;
  }

  async create(
    organizationId: string,
    dto: CreateFinancialPeriodDto,
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (startsAt >= endsAt) {
      throw new BadRequestException(
        'Financial period start date must be before the end date.',
      );
    }

    const existing = await this.prisma.financialPeriod.findFirst({
      where: {
        organizationId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A financial period with this code already exists.',
      );
    }

    const overlappingPeriod =
      await this.prisma.financialPeriod.findFirst({
        where: {
          organizationId,
          startsAt: {
            lt: endsAt,
          },
          endsAt: {
            gt: startsAt,
          },
        },
      });

    if (overlappingPeriod) {
      throw new ConflictException(
        'The financial period overlaps an existing financial period.',
      );
    }

    return this.prisma.financialPeriod.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        startsAt,
        endsAt,
        status: FinancialPeriodStatus.OPEN,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateFinancialPeriodDto,
  ) {
    const period = await this.findOne(
      organizationId,
      id,
    );

    if (
      period.status === FinancialPeriodStatus.CLOSED ||
      period.status === FinancialPeriodStatus.LOCKED
    ) {
      throw new BadRequestException(
        'Closed or locked financial periods cannot be modified.',
      );
    }

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : period.startsAt;

    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : period.endsAt;

    if (startsAt >= endsAt) {
      throw new BadRequestException(
        'Financial period start date must be before the end date.',
      );
    }

    const overlappingPeriod =
      await this.prisma.financialPeriod.findFirst({
        where: {
          organizationId,
          id: {
            not: period.id,
          },
          startsAt: {
            lt: endsAt,
          },
          endsAt: {
            gt: startsAt,
          },
        },
      });

    if (overlappingPeriod) {
      throw new ConflictException(
        'The financial period overlaps an existing financial period.',
      );
    }

    return this.prisma.financialPeriod.update({
      where: {
        id: period.id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),
        ...(dto.startsAt !== undefined && {
          startsAt,
        }),
        ...(dto.endsAt !== undefined && {
          endsAt,
        }),
      },
    });
  }

  async close(
    organizationId: string,
    id: string,
  ) {
    const period = await this.findOne(
      organizationId,
      id,
    );

    if (period.status !== FinancialPeriodStatus.OPEN) {
      throw new BadRequestException(
        'Only an open financial period can be closed.',
      );
    }

    return this.prisma.financialPeriod.update({
      where: {
        id: period.id,
      },
      data: {
        status: FinancialPeriodStatus.CLOSED,
      },
    });
  }

  async lock(
    organizationId: string,
    id: string,
  ) {
    const period = await this.findOne(
      organizationId,
      id,
    );

    if (period.status !== FinancialPeriodStatus.CLOSED) {
      throw new BadRequestException(
        'Only a closed financial period can be locked.',
      );
    }

    return this.prisma.financialPeriod.update({
      where: {
        id: period.id,
      },
      data: {
        status: FinancialPeriodStatus.LOCKED,
      },
    });
  }
}
