import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

type DashboardCode = 'member' | 'executive' | 'administration';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is not active. Please contact an administrator.',
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.usersService.updateLastLogin(user.id);

    const roles = user.userRoles.map((userRole) => userRole.role.code);

    const dashboards = this.getDashboards(user.isSystemOwner, roles);

    const payload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSystemOwner: user.isSystemOwner,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        isSystemOwner: user.isSystemOwner,

        organization: {
          id: user.organization.id,
          name: user.organization.name,
          code: user.organization.code,
        },

        member: user.member
          ? {
              id: user.member.id,
              memberNumber: user.member.memberNumber,
              status: user.member.status,
            }
          : null,

        roles,
        dashboards,
      },
    };
  }

  private getDashboards(
    isSystemOwner: boolean,
    roles: string[],
  ): DashboardCode[] {
    if (isSystemOwner) {
      return ['member', 'executive', 'administration'];
    }

    const dashboards = new Set<DashboardCode>();

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
