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
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface SafeUserRecord {
  id: string;
  organizationId: string;

  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;

  email: string;
  status: string;
  isSystemOwner: boolean;

  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

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

    let roleToAssign = memberRole;

    if (dto.roleId) {
      const requestedRole = await this.prisma.role.findFirst({
        where: {
          id: dto.roleId,
          organizationId,
        },
      });

      if (!requestedRole) {
        throw new NotFoundException('Selected role was not found.');
      }

      roleToAssign = requestedRole;
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          organizationId,

          firstName: dto.firstName.trim(),

          lastName: dto.lastName.trim(),

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
          roleId: roleToAssign.id,
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

            firstName: createdUser.firstName,

            lastName: createdUser.lastName,

            email: createdUser.email,

            status: createdUser.status,

            role: {
              id: roleToAssign.id,
              name: roleToAssign.name,
              code: roleToAssign.code,
            },
          },
        },
      });

      return createdUser;
    });

    return this.findOne(user.id, organizationId);
  }

  async updateMyProfile(
    userId: string,
    organizationId: string,
    dto: UpdateMyProfileDto,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!existingUser) {
      throw new NotFoundException('Authenticated user was not found.');
    }

    const oldValue = {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      phone: existingUser.phone,
    };

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: existingUser.id,
        },

        data: {
          ...(dto.firstName !== undefined
            ? {
                firstName: dto.firstName.trim(),
              }
            : {}),

          ...(dto.lastName !== undefined
            ? {
                lastName: dto.lastName.trim(),
              }
            : {}),

          ...(dto.phone !== undefined
            ? {
                phone: dto.phone.trim(),
              }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: existingUser.id,
          action: 'UPDATE',
          entityType: 'User',
          entityId: user.id,

          oldValue,

          newValue: {
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
          },
        },
      });

      return user;
    });

    return this.findOne(updatedUser.id, organizationId);
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
      firstName: existingUser.firstName,

      lastName: existingUser.lastName,

      email: existingUser.email,

      status: existingUser.status,
    };

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id,
        },

        data: {
          ...(dto.firstName !== undefined
            ? {
                firstName: dto.firstName.trim(),
              }
            : {}),

          ...(dto.lastName !== undefined
            ? {
                lastName: dto.lastName.trim(),
              }
            : {}),

          ...(email !== undefined
            ? {
                email,
              }
            : {}),

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
            firstName: user.firstName,

            lastName: user.lastName,

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

      firstName: user.firstName ?? null,

      lastName: user.lastName ?? null,

      phone: user.phone ?? null,

      email: user.email,

      status: user.status,

      isSystemOwner: user.isSystemOwner,

      lastLoginAt: user.lastLoginAt ?? null,

      createdAt: user.createdAt ?? null,

      updatedAt: user.updatedAt ?? null,

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
