import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  @Permissions('finance.payments.view')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('memberId') memberId?: string,
  ) {
    return this.paymentsService.findAll(
      req.user.organizationId,
      memberId,
    );
  }

  @Get(':id')
  @Permissions('finance.payments.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentsService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.payments.manage')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(
      req.user.organizationId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.payments.manage')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Post(':id/cancel')
  @Permissions('finance.payments.manage')
  cancel(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentsService.cancel(
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/complete')
  @Permissions('finance.payments.manage')
  markCompleted(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.paymentsService.markCompleted(
      req.user.organizationId,
      id,
    );
  }
}
