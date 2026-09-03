import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface SafeUserRecord {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  isSystemOwner: boolean;
  lastLoginAt?: Date | null;

  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;

  member?: {
    id: string;
    registrationNumber?: string | null;
    memberNumber: string;
    status: string;
  } | null;

  userRoles?: Array<{
    role: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    const now = new Date();

    return this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase().trim(),
      },
      include: {
        organization: true,
        member: true,
        userRoles: {
          where: this.activeUserRoleWhere(now),
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findByRegistrationNumber(registrationNumber: string) {
    const now = new Date();

    return this.prisma.user.findFirst({
      where: {
        member: {
          registrationNumber: registrationNumber.trim(),
        },
      },
      include: {
        organization: true,
        member: true,
        userRoles: {
          where: this.activeUserRoleWhere(now),
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string) {
    const now = new Date();

    return this.prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        organization: true,
        member: true,
        userRoles: {
          where: this.activeUserRoleWhere(now),
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: {
        id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async findAll(organizationId: string) {
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        organization: true,
        member: true,
        userRoles: {
          where: this.activeUserRoleWhere(now),
          include: {
            role: true,
          },
        },
      },
    });

    return users.map((user) => this.toSafeUser(user));
  }

  async findOne(id: string, organizationId: string) {
    const now = new Date();

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        organization: true,
        member: true,
        userRoles: {
          where: this.activeUserRoleWhere(now),
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toSafeUser(user);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateUserDto,
  ) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const memberRole = await this.prisma.role.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: 'MEMBER',
        },
      },
    });

    if (!memberRole) {
      throw new NotFoundException('Default MEMBER role is not configured.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          organizationId,
          email,
          passwordHash,
          status: 'ACTIVE',
        },
        include: {
          organization: true,
          member: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      await tx.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: memberRole.id,
          assignedBy: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'User',
          entityId: createdUser.id,
          newValue: {
            id: createdUser.id,
            email: createdUser.email,
            status: createdUser.status,
          },
        },
      });

      return createdUser;
    });

    return this.findOne(user.id, organizationId);
  }

  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateUserDto,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    if (existingUser.isSystemOwner) {
      throw new ForbiddenException(
        'The System Owner account cannot be modified through user management.',
      );
    }

    const email = dto.email?.toLowerCase().trim();

    if (email && email !== existingUser.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    const oldValue = {
      email: existingUser.email,
      status: existingUser.status,
    };

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id,
        },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(dto.status !== undefined
            ? {
                status: dto.status,
              }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'User',
          entityId: user.id,
          oldValue,
          newValue: {
            email: user.email,
            status: user.status,
          },
        },
      });

      return user;
    });

    return this.findOne(updatedUser.id, organizationId);
  }

  private activeUserRoleWhere(now: Date) {
    return {
      revokedAt: null,
      startsAt: {
        lte: now,
      },
      OR: [
        {
          endsAt: null,
        },
        {
          endsAt: {
            gt: now,
          },
        },
      ],
    } satisfies Prisma.UserRoleWhereInput;
  }

  private toSafeUser(user: SafeUserRecord) {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      status: user.status,
      isSystemOwner: user.isSystemOwner,
      lastLoginAt: user.lastLoginAt ?? null,

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
            registrationNumber: user.member.registrationNumber ?? null,
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
    };
  }
}
