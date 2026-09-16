import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @Permissions('finance.payments.view')
  getFinance(@Request() req: AuthenticatedRequest) {
    return {
      module: 'finance',
      organizationId: req.user.organizationId,
      message: 'KUHRSA Finance & Payments module.',
    };
  }
}
