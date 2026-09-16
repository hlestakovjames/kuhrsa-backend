import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../../auth/types/authenticated-request';
import { MpesaPaymentService } from './mpesa-payment.service';
import { MpesaService } from './mpesa.service';
import { InitiateStkDto } from './dto/initiate-stk.dto';
import { MpesaStkCallback } from './mpesa.types';

@Controller('finance/payments/mpesa')
export class MpesaController {
  constructor(
    private readonly mpesaPaymentService: MpesaPaymentService,
    private readonly mpesaService: MpesaService,
  ) {}

  @Post('stk')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('finance.payments.manage')
  async initiateStk(
    @Request() req: AuthenticatedRequest,
    @Body() dto: InitiateStkDto,
  ) {
    return this.mpesaPaymentService.initiateStk(
      req.user.organizationId,
      dto,
    );
  }

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('finance.payments.view')
  async getTransaction(
    @Request() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    return this.mpesaPaymentService.getTransaction(
      req.user.organizationId,
      paymentId,
    );
  }

  @Post('callback')
  async callback(
    @Body() payload: MpesaStkCallback,
  ) {
    return this.mpesaService.handleCallback(payload);
  }
}
