import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentProviderType,
  Prisma,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';
import { CreatePaymentConfigurationDto } from './dto/create-payment-configuration.dto';
import { UpdatePaymentConfigurationDto } from './dto/update-payment-configuration.dto';

@Injectable()
export class PaymentProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllProviders(organizationId: string) {
    return this.prisma.paymentProvider.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      include: {
        configurations: true,
      },
    });
  }

  async findProvider(
    organizationId: string,
    id: string,
  ) {
    const provider =
      await this.prisma.paymentProvider.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          configurations: true,
        },
      });

    if (!provider) {
      throw new NotFoundException(
        'Payment provider not found.',
      );
    }

    return provider;
  }

  async createProvider(
    organizationId: string,
    dto: CreatePaymentProviderDto,
  ) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    const existing =
      await this.prisma.paymentProvider.findFirst({
        where: {
          organizationId,
          code,
        },
      });

    if (existing) {
      throw new ConflictException(
        'A payment provider with this code already exists.',
      );
    }

    if (
      dto.type === PaymentProviderType.MPESA &&
      dto.isDefault === false
    ) {
      const existingDefault =
        await this.prisma.paymentProvider.findFirst({
          where: {
            organizationId,
            type: PaymentProviderType.MPESA,
            isDefault: true,
          },
        });

      if (!existingDefault) {
        throw new BadRequestException(
          'The first M-Pesa provider must be the default provider.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.paymentProvider.updateMany({
          where: {
            organizationId,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.paymentProvider.create({
        data: {
          organizationId,
          name,
          code,
          type: dto.type,
          isActive: dto.isActive ?? true,
          isDefault: dto.isDefault ?? false,
        },
        include: {
          configurations: true,
        },
      });
    });
  }

  async updateProvider(
    organizationId: string,
    id: string,
    dto: UpdatePaymentProviderDto,
  ) {
    const provider = await this.findProvider(
      organizationId,
      id,
    );

    const name =
      dto.name !== undefined
        ? dto.name.trim()
        : provider.name;

    if (!name) {
      throw new BadRequestException(
        'Provider name cannot be empty.',
      );
    }

    if (
      dto.isDefault === false &&
      provider.isDefault
    ) {
      throw new BadRequestException(
        'A default payment provider cannot be unset directly. Set another provider as default first.',
      );
    }

    if (
      dto.isActive === false &&
      provider.isDefault
    ) {
      throw new BadRequestException(
        'The default payment provider cannot be disabled.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.paymentProvider.updateMany({
          where: {
            organizationId,
            id: {
              not: provider.id,
            },
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.paymentProvider.update({
        where: {
          id: provider.id,
        },
        data: {
          name,
          ...(dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
          ...(dto.isDefault !== undefined && {
            isDefault: dto.isDefault,
          }),
        },
        include: {
          configurations: true,
        },
      });
    });
  }

  async findConfiguration(
    organizationId: string,
    providerId: string,
  ) {
    const provider = await this.findProvider(
      organizationId,
      providerId,
    );

    const configuration =
      provider.configurations[0];

    if (!configuration) {
      throw new NotFoundException(
        'Payment provider configuration not found.',
      );
    }

    return this.sanitizeConfiguration(
      configuration,
    );
  }

  async createConfiguration(
    organizationId: string,
    providerId: string,
    dto: CreatePaymentConfigurationDto,
  ) {
    const provider = await this.findProvider(
      organizationId,
      providerId,
    );

    const existing =
      await this.prisma.paymentConfiguration.findUnique({
        where: {
          organizationId_providerId: {
            organizationId,
            providerId,
          },
        },
      });

    if (existing) {
      throw new ConflictException(
        'A configuration already exists for this payment provider.',
      );
    }

    this.validateConfigurationAmounts(
      dto.minimumAmount,
      dto.maximumAmount,
    );

    const configuration =
      await this.prisma.paymentConfiguration.create({
        data: {
          organizationId,
          providerId: provider.id,
          environment:
            dto.environment?.trim().toLowerCase() ||
            'sandbox',
          currency:
            dto.currency?.trim().toUpperCase() ||
            'KES',
          shortcode:
            dto.shortcode?.trim() || null,
          tillNumber:
            dto.tillNumber?.trim() || null,
          paybillNumber:
            dto.paybillNumber?.trim() || null,
          enabled: dto.enabled ?? true,
          minimumAmount:
            dto.minimumAmount ?? null,
          maximumAmount:
            dto.maximumAmount ?? null,
          callbackUrl:
            dto.callbackUrl?.trim() || null,
          settings:
            dto.settings !== undefined
              ? (dto.settings as Prisma.InputJsonValue)
              : undefined,
        },
      });

    return this.sanitizeConfiguration(
      configuration,
    );
  }

  async updateConfiguration(
    organizationId: string,
    providerId: string,
    dto: UpdatePaymentConfigurationDto,
  ) {
    const provider = await this.findProvider(
      organizationId,
      providerId,
    );

    const existing =
      await this.prisma.paymentConfiguration.findUnique({
        where: {
          organizationId_providerId: {
            organizationId,
            providerId: provider.id,
          },
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Payment provider configuration not found.',
      );
    }

    const minimumAmount =
      dto.minimumAmount !== undefined
        ? dto.minimumAmount
        : existing.minimumAmount !== null
          ? Number(existing.minimumAmount)
          : undefined;

    const maximumAmount =
      dto.maximumAmount !== undefined
        ? dto.maximumAmount
        : existing.maximumAmount !== null
          ? Number(existing.maximumAmount)
          : undefined;

    this.validateConfigurationAmounts(
      minimumAmount,
      maximumAmount,
    );

    const configuration =
      await this.prisma.paymentConfiguration.update({
        where: {
          id: existing.id,
        },
        data: {
          ...(dto.environment !== undefined && {
            environment:
              dto.environment.trim().toLowerCase(),
          }),
          ...(dto.currency !== undefined && {
            currency:
              dto.currency.trim().toUpperCase(),
          }),
          ...(dto.shortcode !== undefined && {
            shortcode:
              dto.shortcode.trim() || null,
          }),
          ...(dto.tillNumber !== undefined && {
            tillNumber:
              dto.tillNumber.trim() || null,
          }),
          ...(dto.paybillNumber !== undefined && {
            paybillNumber:
              dto.paybillNumber.trim() || null,
          }),
          ...(dto.enabled !== undefined && {
            enabled: dto.enabled,
          }),
          ...(dto.minimumAmount !== undefined && {
            minimumAmount: dto.minimumAmount,
          }),
          ...(dto.maximumAmount !== undefined && {
            maximumAmount: dto.maximumAmount,
          }),
          ...(dto.callbackUrl !== undefined && {
            callbackUrl:
              dto.callbackUrl.trim() || null,
          }),
          ...(dto.settings !== undefined && {
            settings:
              dto.settings as Prisma.InputJsonValue,
          }),
        },
      });

    return this.sanitizeConfiguration(
      configuration,
    );
  }

  private validateConfigurationAmounts(
    minimumAmount?: number,
    maximumAmount?: number,
  ) {
    if (
      minimumAmount !== undefined &&
      maximumAmount !== undefined &&
      minimumAmount > maximumAmount
    ) {
      throw new BadRequestException(
        'Minimum payment amount cannot exceed maximum payment amount.',
      );
    }
  }

  private sanitizeConfiguration<T extends {
    id: string;
    organizationId: string;
    providerId: string;
    environment: string;
    currency: string;
    shortcode: string | null;
    tillNumber: string | null;
    paybillNumber: string | null;
    enabled: boolean;
    minimumAmount: unknown;
    maximumAmount: unknown;
    callbackUrl: string | null;
    settings: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(configuration: T) {
    return {
      id: configuration.id,
      organizationId:
        configuration.organizationId,
      providerId: configuration.providerId,
      environment: configuration.environment,
      currency: configuration.currency,
      shortcode: configuration.shortcode,
      tillNumber: configuration.tillNumber,
      paybillNumber: configuration.paybillNumber,
      enabled: configuration.enabled,
      minimumAmount:
        configuration.minimumAmount !== null
          ? Number(configuration.minimumAmount)
          : null,
      maximumAmount:
        configuration.maximumAmount !== null
          ? Number(configuration.maximumAmount)
          : null,
      callbackUrl: configuration.callbackUrl,
      settings: configuration.settings,
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
    };
  }
}
