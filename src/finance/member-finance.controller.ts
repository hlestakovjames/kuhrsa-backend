import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Portal } from '../auth/decorators/portal/portal.decorator';
import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { MemberFinanceService } from './member-finance.service';

@Controller('finance/member')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
@Portal('member')
export class MemberFinanceController {
  constructor(private readonly memberFinanceService: MemberFinanceService) {}

  @Get('me')
  getMyFinance(@Request() req: AuthenticatedRequest) {
    return this.memberFinanceService.getMyFinance(
      req.user.organizationId,
      req.user.id,
    );
  }
}
