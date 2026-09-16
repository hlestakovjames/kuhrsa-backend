import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';
import { CreatePaymentConfigurationDto } from './dto/create-payment-configuration.dto';
import { UpdatePaymentConfigurationDto } from './dto/update-payment-configuration.dto';
import { PaymentProvidersService } from './payment-providers.service';

@Controller('finance/providers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentProvidersController {
  constructor(
    private readonly paymentProvidersService: PaymentProvidersService,
  ) {}

  @Get()
  @Permissions('finance.providers.view')
  findAll(
    @Request() req: AuthenticatedRequest,
  ) {
    return this.paymentProvidersService.findAllProviders(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @Permissions('finance.providers.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentProvidersService.findProvider(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.providers.manage')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentProviderDto,
  ) {
    return this.paymentProvidersService.createProvider(
      req.user.organizationId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.providers.manage')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProviderDto,
  ) {
    return this.paymentProvidersService.updateProvider(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Get(':id/configuration')
  @Permissions('finance.providers.view')
  findConfiguration(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentProvidersService.findConfiguration(
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/configuration')
  @Permissions('finance.providers.manage')
  createConfiguration(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreatePaymentConfigurationDto,
  ) {
    return this.paymentProvidersService.createConfiguration(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Patch(':id/configuration')
  @Permissions('finance.providers.manage')
  updateConfiguration(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentConfigurationDto,
  ) {
    return this.paymentProvidersService.updateConfiguration(
      req.user.organizationId,
      id,
      dto,
    );
  }
}
