import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Portal } from '../auth/decorators/portal/portal.decorator';
import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('member')
  @Portal('member')
  getMemberDashboard(
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dashboardService.getMemberDashboard(
      req.user.organizationId,
      req.user.id,
      req.user.email,
    );
  }

  @Get('executive')
  @Portal('executive')
  getExecutiveDashboard(
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;

    return {
      portal: 'executive',
      message:
        'Welcome to the KUHRSA Executive Dashboard.',
      user: {
        id: user.id,
        email: user.email,
        roles:
          user.userRoles?.map(
            (userRole) => userRole.role.code,
          ) ?? [],
      },
    };
  }

  @Get('administration')
  @Portal('administration')
  getAdministrationDashboard(
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dashboardService.getAdministrationDashboardSummary(
      req.user.organizationId,
    );
  }

  @Get(
    'administration/membership-summary',
  )
  @Portal('administration')
  getAdministrationMembershipSummary(
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dashboardService.getAdministrationMembershipSummary(
      req.user.organizationId,
    );
  }
}
