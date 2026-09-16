import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { PaymentAllocationsService } from './payment-allocations.service';

@Controller('finance/allocations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentAllocationsController {
  constructor(
    private readonly paymentAllocationsService: PaymentAllocationsService,
  ) {}

  @Get()
  @Permissions('finance.payments.view')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('paymentId') paymentId?: string,
    @Query('chargeId') chargeId?: string,
  ) {
    return this.paymentAllocationsService.findAll(
      req.user.organizationId,
      paymentId,
      chargeId,
    );
  }

  @Get(':id')
  @Permissions('finance.payments.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentAllocationsService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.payments.manage')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentAllocationDto,
    @Query('paymentId') paymentId?: string,
  ) {
    if (!paymentId) {
      throw new Error(
        'paymentId query parameter is required.',
      );
    }

    return this.paymentAllocationsService.create(
      req.user.organizationId,
      paymentId,
      dto,
    );
  }
}
