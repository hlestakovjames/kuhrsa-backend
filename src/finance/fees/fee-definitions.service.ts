import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FeeType,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateFeeDefinitionDto } from './dto/create-fee-definition.dto';
import { UpdateFeeDefinitionDto } from './dto/update-fee-definition.dto';

@Injectable()
export class FeeDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.feeDefinition.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        schedules: {
          orderBy: {
            effectiveFrom: 'desc',
          },
        },
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const fee = await this.prisma.feeDefinition.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        schedules: {
          orderBy: {
            effectiveFrom: 'desc',
          },
        },
      },
    });

    if (!fee) {
      throw new NotFoundException(
        'Fee definition not found.',
      );
    }

    return fee;
  }

  async create(
    organizationId: string,
    dto: CreateFeeDefinitionDto,
  ) {
    const code = dto.code.trim().toUpperCase();

    const validFeeTypes = Object.values(FeeType);

    if (!validFeeTypes.includes(dto.type as FeeType)) {
      throw new BadRequestException(
        `Invalid fee type. Allowed values: ${validFeeTypes.join(', ')}`,
      );
    }

    const existing = await this.prisma.feeDefinition.findFirst({
      where: {
        organizationId,
        code,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A fee definition with this code already exists.',
      );
    }

    return this.prisma.feeDefinition.create({
      data: {
        organizationId,
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type as FeeType,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateFeeDefinitionDto,
  ) {
    const fee = await this.findOne(
      organizationId,
      id,
    );

    if (
      dto.name !== undefined &&
      dto.name.trim().length === 0
    ) {
      throw new BadRequestException(
        'Fee definition name cannot be empty.',
      );
    }

    return this.prisma.feeDefinition.update({
      where: {
        id: fee.id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.isActive !== undefined && {
          isActive: dto.isActive,
        }),
      },
    });
  }

  async activate(
    organizationId: string,
    id: string,
  ) {
    const fee = await this.findOne(
      organizationId,
      id,
    );

    if (fee.isActive) {
      return fee;
    }

    return this.prisma.feeDefinition.update({
      where: {
        id: fee.id,
      },
      data: {
        isActive: true,
      },
    });
  }

  async deactivate(
    organizationId: string,
    id: string,
  ) {
    const fee = await this.findOne(
      organizationId,
      id,
    );

    if (!fee.isActive) {
      return fee;
    }

    return this.prisma.feeDefinition.update({
      where: {
        id: fee.id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
