import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Portal } from '../auth/decorators/portal/portal.decorator';
import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class DashboardController {
  @Get('member')
  @Portal('member')
  getMemberDashboard(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    return {
      portal: 'member',
      message: 'Welcome to your KUHRSA Member Dashboard.',
      user: {
        id: user.id,
        email: user.email,
        member: user.member
          ? {
              id: user.member.id,
              registrationNumber: user.member.registrationNumber,
              memberNumber: user.member.memberNumber,
              status: user.member.status,
            }
          : null,
      },
    };
  }

  @Get('executive')
  @Portal('executive')
  getExecutiveDashboard(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    return {
      portal: 'executive',
      message: 'Welcome to the KUHRSA Executive Dashboard.',
      user: {
        id: user.id,
        email: user.email,
        roles: user.userRoles?.map((userRole) => userRole.role.code) ?? [],
      },
    };
  }

  @Get('administration')
  @Portal('administration')
  getAdministrationDashboard(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    return {
      portal: 'administration',
      message: 'Welcome to the KUHRSA Administration Dashboard.',
      user: {
        id: user.id,
        email: user.email,
        isSystemOwner: user.isSystemOwner,
        roles: user.userRoles?.map((userRole) => userRole.role.code) ?? [],
      },
    };
  }
}
