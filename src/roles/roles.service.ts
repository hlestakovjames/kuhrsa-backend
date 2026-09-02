import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true,
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
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
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

    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException('This user already has this role.');
    }

    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRole.create({
        data: {
          userId,
          roleId,
          assignedBy: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'ROLE_CHANGE',
          entityType: 'UserRole',
          entityId: assignment.id,
          newValue: {
            userId,
            roleId,
            roleCode: role.code,
            action: 'ASSIGN',
          },
        },
      });
    });

    return this.findOne(roleId, organizationId);
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

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
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
            action: 'REMOVE',
          },
        },
      });
    });

    return {
      message: 'Role removed successfully.',
      userId,
      roleId,
      roleCode: role.code,
    };
  }
}
