import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.isSystemOwner) {
      return true;
    }

    const userPermissions = new Set<string>();

    for (const userRole of user.userRoles ?? []) {
      for (const rolePermission of userRole.role.rolePermissions ?? []) {
        const permissionCode = rolePermission.permission?.code;

        if (permissionCode) {
          userPermissions.add(permissionCode);
        }
      }
    }

    const hasRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.has(permission),
    );

    if (!hasRequiredPermissions) {
      throw new ForbiddenException(
        'You do not have the required permissions to access this resource',
      );
    }

    return true;
  }
}
