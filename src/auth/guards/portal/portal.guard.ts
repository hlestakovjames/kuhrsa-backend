import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PORTAL_KEY,
  PortalType,
} from '../../decorators/portal/portal.decorator';
import { AuthenticatedRequest } from '../../types/authenticated-request';

@Injectable()
export class PortalAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const portal = this.reflector.getAllAndOverride<PortalType>(PORTAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!portal) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated.');
    }

    if (user.isSystemOwner) {
      return true;
    }

    const roles = user.userRoles?.map((userRole) => userRole.role.code) ?? [];

    switch (portal) {
      case 'member':
        if (roles.includes('MEMBER')) {
          return true;
        }
        break;

      case 'executive':
        if (roles.includes('EXECUTIVE')) {
          return true;
        }
        break;

      case 'administration':
        if (
          roles.includes('ADMINISTRATOR') ||
          roles.includes('SUPER_ADMINISTRATOR')
        ) {
          return true;
        }
        break;
    }

    throw new ForbiddenException('You do not have access to this portal.');
  }
}
