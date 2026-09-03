import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User, UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const GOVERNANCE_ROLE_CODES = {
  SUPER_ADMINISTRATOR: 'SUPER_ADMINISTRATOR',
  ADMINISTRATOR: 'ADMINISTRATOR',
  EXECUTIVE: 'EXECUTIVE',
  MEMBER: 'MEMBER',
} as const;

const ROLE_LIMITS = {
  SUPER_ADMINISTRATOR: 3,
  ADMINISTRATOR: 10,
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const now = new Date();

    const roles = await this.prisma.role.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        userRoles: {
          where: this.activeAssignmentWhere(now),
          select: {
            id: true,
          },
        },
        rolePermissions: {
          select: {
            id: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role.userRoles.length,
      permissionCount: role.rolePermissions.length,
    }));
  }

  async findOne(id: string, organizationId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                status: true,
                isSystemOwner: true,
              },
            },
          },
        },
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const now = new Date();

    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,

      users: role.userRoles.map((userRole) => ({
        id: userRole.user.id,
        email: userRole.user.email,
        status: userRole.user.status,
        isSystemOwner: userRole.user.isSystemOwner,
        assignedAt: userRole.assignedAt,
        assignedBy: userRole.assignedBy,
        startsAt: userRole.startsAt,
        endsAt: userRole.endsAt,
        revokedAt: userRole.revokedAt,
        isActive: this.isAssignmentActive(userRole, now),
      })),

      permissions: role.rolePermissions.map((rolePermission) => ({
        id: rolePermission.permission.id,
        name: rolePermission.permission.name,
        code: rolePermission.permission.code,
        description: rolePermission.permission.description,
      })),
    };
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateRoleDto,
  ) {
    const code = dto.code.trim().toUpperCase();

    const existingRole = await this.prisma.role.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existingRole) {
      throw new ConflictException('A role with this code already exists.');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          code,
          description: dto.description.trim(),
          isSystemRole: false,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'Role',
          entityId: createdRole.id,
          newValue: {
            name: createdRole.name,
            code: createdRole.code,
            description: createdRole.description,
            isSystemRole: false,
          },
        },
      });

      return createdRole;
    });

    return this.findOne(role.id, organizationId);
  }

  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateRoleDto,
  ) {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingRole) {
      throw new NotFoundException('Role not found.');
    }

    if (existingRole.isSystemRole) {
      throw new ForbiddenException(
        'System roles cannot be modified through role management.',
      );
    }

    const oldValue = {
      name: existingRole.name,
      description: existingRole.description,
    };

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: {
          id,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'Role',
          entityId: role.id,
          oldValue,
          newValue: {
            name: role.name,
            description: role.description,
          },
        },
      });

      return role;
    });

    return this.findOne(updatedRole.id, organizationId);
  }

  async assignUser(
    roleId: string,
    userId: string,
    organizationId: string,
    actorUserId: string,
    startsAtInput?: string,
    endsAtInput?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isSystemOwner) {
      throw new ForbiddenException(
        'The System Owner role assignments cannot be changed through ordinary role management.',
      );
    }

    if (role.code === GOVERNANCE_ROLE_CODES.SUPER_ADMINISTRATOR) {
      return this.assignSuperAdministrator(
        role,
        user,
        organizationId,
        actorUserId,
        startsAtInput,
      );
    }

    if (role.code === GOVERNANCE_ROLE_CODES.ADMINISTRATOR) {
      return this.assignAdministrator(
        role,
        user,
        organizationId,
        actorUserId,
        startsAtInput,
        endsAtInput,
      );
    }

    if (role.code === GOVERNANCE_ROLE_CODES.EXECUTIVE) {
      return this.assignExecutive(
        role,
        user,
        organizationId,
        actorUserId,
        startsAtInput,
        endsAtInput,
      );
    }

    return this.assignGeneralRole(
      role,
      user,
      organizationId,
      actorUserId,
      startsAtInput,
      endsAtInput,
    );
  }

  async removeUser(
    roleId: string,
    userId: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isSystemOwner) {
      throw new ForbiddenException(
        'The System Owner role assignments cannot be changed through ordinary role management.',
      );
    }

    if (role.code === GOVERNANCE_ROLE_CODES.MEMBER) {
      throw new ForbiddenException(
        'The MEMBER role cannot be removed through role management.',
      );
    }

    const assignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        'This user does not have the specified role.',
      );
    }

    if (assignment.revokedAt) {
      throw new ConflictException(
        'This role assignment has already been revoked.',
      );
    }

    const revokedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.update({
        where: {
          id: assignment.id,
        },
        data: {
          revokedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'ROLE_CHANGE',
          entityType: 'UserRole',
          entityId: assignment.id,
          oldValue: {
            userId,
            roleId,
            roleCode: role.code,
            startsAt: assignment.startsAt,
            endsAt: assignment.endsAt,
            revokedAt: assignment.revokedAt,
          },
          newValue: {
            userId,
            roleId,
            roleCode: role.code,
            startsAt: assignment.startsAt,
            endsAt: assignment.endsAt,
            revokedAt,
            action: 'REVOKE',
          },
        },
      });
    });

    return {
      message: 'Role revoked successfully.',
      userId,
      roleId,
      roleCode: role.code,
      revokedAt,
    };
  }

  private async assignSuperAdministrator(
    role: Role,
    user: User,
    organizationId: string,
    actorUserId: string,
    startsAtInput?: string,
  ) {
    const now = new Date();

    const startsAt = startsAtInput
      ? this.parseDate(startsAtInput, 'startsAt')
      : now;

    if (startsAt < now) {
      throw new ConflictException(
        'A Super Administrator appointment cannot start in the past.',
      );
    }

    const activeCount = await this.countActiveAssignments(
      role.id,
      organizationId,
      now,
    );

    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    if (existingAssignment && !existingAssignment.revokedAt) {
      throw new ConflictException(
        'This user already has an active Super Administrator appointment.',
      );
    }

    if (activeCount >= ROLE_LIMITS.SUPER_ADMINISTRATOR) {
      throw new ConflictException(
        `The organization can have a maximum of ${ROLE_LIMITS.SUPER_ADMINISTRATOR} active Super Administrators.`,
      );
    }

    await this.upsertAppointment(
      existingAssignment,
      role.id,
      user.id,
      organizationId,
      actorUserId,
      startsAt,
      null,
    );

    return this.findOne(role.id, organizationId);
  }

  private async assignAdministrator(
    role: Role,
    user: User,
    organizationId: string,
    actorUserId: string,
    startsAtInput?: string,
    endsAtInput?: string,
  ) {
    const now = new Date();

    if (!startsAtInput || !endsAtInput) {
      throw new ConflictException(
        'Administrator appointments require both startsAt and endsAt.',
      );
    }

    const startsAt = this.parseDate(startsAtInput, 'startsAt');

    const endsAt = this.parseDate(endsAtInput, 'endsAt');

    this.validateAppointmentWindow(startsAt, endsAt, now);

    const activeCount = await this.countActiveAssignments(
      role.id,
      organizationId,
      now,
    );

    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    if (existingAssignment && !existingAssignment.revokedAt) {
      throw new ConflictException(
        'This user already has an active Administrator appointment.',
      );
    }

    if (activeCount >= ROLE_LIMITS.ADMINISTRATOR) {
      throw new ConflictException(
        `The organization can have a maximum of ${ROLE_LIMITS.ADMINISTRATOR} active Administrators.`,
      );
    }

    await this.upsertAppointment(
      existingAssignment,
      role.id,
      user.id,
      organizationId,
      actorUserId,
      startsAt,
      endsAt,
    );

    return this.findOne(role.id, organizationId);
  }

  private async assignExecutive(
    role: Role,
    user: User,
    organizationId: string,
    actorUserId: string,
    startsAtInput?: string,
    endsAtInput?: string,
  ) {
    const now = new Date();

    if (!startsAtInput || !endsAtInput) {
      throw new ConflictException(
        'Executive appointments require both startsAt and endsAt.',
      );
    }

    const startsAt = this.parseDate(startsAtInput, 'startsAt');

    const endsAt = this.parseDate(endsAtInput, 'endsAt');

    this.validateAppointmentWindow(startsAt, endsAt, now);

    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    if (existingAssignment && !existingAssignment.revokedAt) {
      throw new ConflictException(
        'This user already has an active Executive appointment.',
      );
    }

    await this.upsertAppointment(
      existingAssignment,
      role.id,
      user.id,
      organizationId,
      actorUserId,
      startsAt,
      endsAt,
    );

    return this.findOne(role.id, organizationId);
  }

  private async assignGeneralRole(
    role: Role,
    user: User,
    organizationId: string,
    actorUserId: string,
    startsAtInput?: string,
    endsAtInput?: string,
  ) {
    const now = new Date();

    const startsAt = startsAtInput
      ? this.parseDate(startsAtInput, 'startsAt')
      : now;

    const endsAt = endsAtInput ? this.parseDate(endsAtInput, 'endsAt') : null;

    if (endsAt && endsAt <= startsAt) {
      throw new ConflictException('endsAt must be later than startsAt.');
    }

    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    if (existingAssignment && !existingAssignment.revokedAt) {
      throw new ConflictException('This user already has this role.');
    }

    await this.upsertAppointment(
      existingAssignment,
      role.id,
      user.id,
      organizationId,
      actorUserId,
      startsAt,
      endsAt,
    );

    return this.findOne(role.id, organizationId);
  }

  private async upsertAppointment(
    existingAssignment: UserRole | null,
    roleId: string,
    userId: string,
    organizationId: string,
    actorUserId: string,
    startsAt: Date,
    endsAt: Date | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      let assignment: UserRole;

      if (existingAssignment) {
        assignment = await tx.userRole.update({
          where: {
            id: existingAssignment.id,
          },
          data: {
            startsAt,
            endsAt,
            revokedAt: null,
            assignedAt: new Date(),
            assignedBy: actorUserId,
          },
        });
      } else {
        assignment = await tx.userRole.create({
          data: {
            userId,
            roleId,
            assignedBy: actorUserId,
            startsAt,
            endsAt,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'ROLE_CHANGE',
          entityType: 'UserRole',
          entityId: assignment.id,
          oldValue: existingAssignment
            ? {
                userId,
                roleId,
                startsAt: existingAssignment.startsAt,
                endsAt: existingAssignment.endsAt,
                revokedAt: existingAssignment.revokedAt,
                action: 'REAPPOINT',
              }
            : undefined,
          newValue: {
            userId,
            roleId,
            startsAt,
            endsAt,
            revokedAt: null,
            action: existingAssignment ? 'REAPPOINT' : 'ASSIGN',
          },
        },
      });
    });
  }

  private async countActiveAssignments(
    roleId: string,
    organizationId: string,
    now: Date,
  ) {
    return this.prisma.userRole.count({
      where: {
        roleId,
        user: {
          organizationId,
        },
        ...this.activeAssignmentWhere(now),
      },
    });
  }

  private activeAssignmentWhere(now: Date): Prisma.UserRoleWhereInput {
    return {
      revokedAt: null,
      startsAt: {
        lte: now,
      },
      OR: [
        {
          endsAt: {
            gt: now,
          },
        },
        {
          endsAt: null,
        },
      ],
    };
  }

  private isAssignmentActive(assignment: UserRole, now: Date) {
    if (assignment.revokedAt) {
      return false;
    }

    if (assignment.startsAt > now) {
      return false;
    }

    if (assignment.endsAt && assignment.endsAt <= now) {
      return false;
    }

    return true;
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new ConflictException(`${fieldName} must be a valid ISO date.`);
    }

    return parsed;
  }

  private validateAppointmentWindow(startsAt: Date, endsAt: Date, now: Date) {
    if (endsAt <= startsAt) {
      throw new ConflictException('endsAt must be later than startsAt.');
    }

    if (startsAt < now) {
      throw new ConflictException('startsAt cannot be in the past.');
    }
  }
}
