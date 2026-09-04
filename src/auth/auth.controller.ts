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
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedRequest } from './types/authenticated-request';

type DashboardCode = 'member' | 'executive' | 'administration';

interface AuthUserRoleResponse {
  id: string;
  name: string;
  code: string;
}

interface AuthMemberResponse {
  id: string;
  registrationNumber?: string | null;
  admissionNumber?: string | null;
  memberNumber: string;
  category: string;
  yearOfStudy?: number | null;
  graduationYear?: number | null;
  nationalId?: string | null;
  staffNumber?: string | null;
  position?: string | null;
  programme?: string | null;
  faculty?: string | null;
  department?: string | null;
  status: string;
  source: string;
  activationStatus: string;
}

interface AuthUserResponse {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email: string;
  status: string;
  isSystemOwner: boolean;
  lastLoginAt?: Date | null;

  organization: {
    id: string;
    name: string;
    code: string;
  };

  member: AuthMemberResponse | null;

  roles: AuthUserRoleResponse[];
  dashboards: DashboardCode[];
}

interface LoginResponse {
  accessToken: string;
  user: AuthUserResponse;
}

interface RegisterResponse {
  message: string;

  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    status: string;
  };

  member: {
    id: string;
    memberNumber: string;
    category: string;
    registrationNumber?: string | null;
    yearOfStudy?: number | null;
    graduationYear?: number | null;
    staffNumber?: string | null;
    position?: string | null;
    programme?: string | null;
    faculty?: string | null;
    department?: string | null;
    status: string;
    source: string;
    activationStatus: string;
  };

  membership: {
    membershipYear: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
  };

  payment: {
    required: boolean;
    registrationFee: number;
    annualMembershipFee: number;
    total: number;
    status: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    const result = await this.authService.login(dto.identifier, dto.password);

    const user = result.user;

    const roleCodes =
      user.userRoles?.map((userRole) => userRole.role.code) ?? [];

    return {
      accessToken: result.accessToken,
      user: this.mapUserResponse(user, roleCodes),
    };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Request() req: AuthenticatedRequest): AuthUserResponse {
    const user = req.user;

    const roleCodes =
      user.userRoles?.map((userRole) => userRole.role.code) ?? [];

    return this.mapUserResponse(user, roleCodes);
  }

  private mapUserResponse(
    user: AuthenticatedRequest['user'],
    roleCodes: string[],
  ): AuthUserResponse {
    const dashboards = this.getDashboards(user.isSystemOwner, roleCodes);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
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
        : {
            id: user.organizationId,
            name: '',
            code: '',
          },

      member: user.member
        ? {
            id: user.member.id,
            registrationNumber: user.member.registrationNumber,
            admissionNumber: user.member.admissionNumber,
            memberNumber: user.member.memberNumber,
            category: user.member.category,
            yearOfStudy: user.member.yearOfStudy,
            graduationYear: user.member.graduationYear,
            nationalId: user.member.nationalId,
            staffNumber: user.member.staffNumber,
            position: user.member.position,
            programme: user.member.programme,
            faculty: user.member.faculty,
            department: user.member.department,
            status: user.member.status,
            source: user.member.source,
            activationStatus: user.member.activationStatus,
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
