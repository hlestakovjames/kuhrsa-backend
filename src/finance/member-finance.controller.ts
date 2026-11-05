import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Portal } from '../auth/decorators/portal/portal.decorator';
import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { MemberFinanceService } from './member-finance.service';
import { MpesaPaymentService } from './providers/mpesa/mpesa-payment.service';
import { InitiateMemberStkDto } from './providers/mpesa/dto/initiate-member-stk.dto';

@Controller('finance/member')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
@Portal('member')
export class MemberFinanceController {
  constructor(
    private readonly memberFinanceService: MemberFinanceService,
    private readonly mpesaPaymentService: MpesaPaymentService,
  ) {}

  @Post('me/mpesa/stk')
  initiateMyMpesaPayment(
    @Request() req: AuthenticatedRequest,
    @Body() dto: InitiateMemberStkDto,
  ) {
    return this.mpesaPaymentService.initiateMemberStk(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Get('me')
  getMyFinance(@Request() req: AuthenticatedRequest) {
    return this.memberFinanceService.getMyFinance(
      req.user.organizationId,
      req.user.id,
    );
  }
}
