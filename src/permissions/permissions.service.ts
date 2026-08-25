import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: {
        code: 'asc',
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
    });
  }

  async findRolePermissions(
    roleId: string,
    organizationId: string,
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

    const rolePermissions =
      await this.prisma.rolePermission.findMany({
        where: {
          roleId,
        },
        include: {
          permission: true,
        },
        orderBy: {
          permission: {
            code: 'asc',
          },
        },
      });

    return rolePermissions.map((item) => ({
      id: item.permission.id,
      name: item.permission.name,
      code: item.permission.code,
      description: item.permission.description,
      grantedAt: item.grantedAt,
    }));
  }

  async assignPermission(
    roleId: string,
    permissionId: string,
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

    if (role.isSystemRole) {
      throw new ForbiddenException(
        'System role permissions cannot be modified through ordinary permission management.',
      );
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        id: permissionId,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found.');
    }

    const existing =
      await this.prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
      });

    if (existing) {
      throw new ConflictException(
        'This permission is already assigned to the role.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const rolePermission =
        await tx.rolePermission.create({
          data: {
            roleId,
            permissionId,
          },
        });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'PERMISSION_CHANGE',
          entityType: 'RolePermission',
          entityId: rolePermission.id,
          newValue: {
            action: 'ASSIGN',
            roleId,
            permissionId,
            permissionCode: permission.code,
          },
        },
      });
    });

    return this.findRolePermissions(roleId, organizationId);
  }

  async removePermission(
    roleId: string,
    permissionId: string,
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

    if (role.isSystemRole) {
      throw new ForbiddenException(
        'System role permissions cannot be modified through ordinary permission management.',
      );
    }

    const permission =
      await this.prisma.permission.findUnique({
        where: {
          id: permissionId,
        },
      });

    if (!permission) {
      throw new NotFoundException('Permission not found.');
    }

    const assignment =
      await this.prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
      });

    if (!assignment) {
      throw new NotFoundException(
        'This permission is not assigned to the role.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.delete({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'PERMISSION_CHANGE',
          entityType: 'RolePermission',
          entityId: assignment.id,
          oldValue: {
            action: 'REMOVE',
            roleId,
            permissionId,
            permissionCode: permission.code,
          },
        },
      });
    });

    return {
      message: 'Permission removed successfully.',
      roleId,
      permissionId,
      permissionCode: permission.code,
    };
  }
}