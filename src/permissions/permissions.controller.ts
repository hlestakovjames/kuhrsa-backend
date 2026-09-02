import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'))
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('roles.view')
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get('role/:roleId')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.view')
  async findRolePermissions(
    @Param('roleId') roleId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.permissionsService.findRolePermissions(
      roleId,
      req.user.organizationId,
    );
  }

  @Post('role/:roleId/:permissionId')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async assignPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.permissionsService.assignPermission(
      roleId,
      permissionId,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Delete('role/:roleId/:permissionId')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.permissionsService.removePermission(
      roleId,
      permissionId,
      req.user.organizationId,
      req.user.id,
    );
  }
}
