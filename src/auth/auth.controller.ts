import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedRequest } from './types/authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const identifier: string = dto.identifier;

    const password: string = dto.password;

    return this.authService.login(identifier, password);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(
    @Request()
    req: AuthenticatedRequest,
  ) {
    const user = req.user;

    const roleCodes =
      user.userRoles?.map((userRole) => userRole.role.code) ?? [];

    const dashboards = this.getDashboards(user.isSystemOwner, roleCodes);

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      status: user.status,
      isSystemOwner: user.isSystemOwner,
      lastLoginAt: user.lastLoginAt,

      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            code: user.organization.code,
          }
        : null,

      member: user.member
        ? {
            id: user.member.id,
            registrationNumber: user.member.registrationNumber,
            memberNumber: user.member.memberNumber,
            status: user.member.status,
          }
        : null,

      roles:
        user.userRoles?.map((userRole) => ({
          id: userRole.role.id,
          name: userRole.role.name,
          code: userRole.role.code,
        })) ?? [],

      dashboards,
    };
  }

  private getDashboards(isSystemOwner: boolean, roles: string[]) {
    if (isSystemOwner) {
      return ['member', 'executive', 'administration'];
    }

    const dashboards = new Set<string>();

    if (roles.includes('MEMBER')) {
      dashboards.add('member');
    }

    if (roles.includes('EXECUTIVE')) {
      dashboards.add('executive');
    }

    if (
      roles.includes('ADMINISTRATOR') ||
      roles.includes('SUPER_ADMINISTRATOR')
    ) {
      dashboards.add('administration');
    }

    return Array.from(dashboards);
  }
}
