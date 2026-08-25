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
import { Permissions } from './decorators/permissions/permissions.decorator';
import { Roles } from './decorators/roles/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions/permissions.guard';
import { RolesGuard } from './guards/roles/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req: any) {
    const user = req.user;

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
            memberNumber: user.member.memberNumber,
            status: user.member.status,
          }
        : null,

      roles:
        user.userRoles?.map((userRole: any) => ({
          id: userRole.role.id,
          name: userRole.role.name,
          code: userRole.role.code,
        })) ?? [],
    };
  }

  @Get('admin-test')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMINISTRATOR')
  async adminTest() {
    return {
      message: 'Super Administrator access confirmed.',
    };
  }

  @Get('permission-test')
  @UseGuards(
    AuthGuard('jwt'),
    PermissionsGuard,
  )
  @Permissions('users.view')
  async permissionTest() {
    return {
      message: 'users.view permission confirmed.',
    };
  }
}