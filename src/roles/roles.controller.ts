import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(AuthGuard('jwt'))
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('roles.view')
  async findAll(@Request() req: any) {
    return this.rolesService.findAll(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.view')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.rolesService.findOne(
      id,
      req.user.organizationId,
    );
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async create(
    @Body() dto: CreateRoleDto,
    @Request() req: any,
  ) {
    return this.rolesService.create(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: any,
  ) {
    return this.rolesService.update(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Post(':id/users/:userId')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async assignUser(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.rolesService.assignUser(
      roleId,
      userId,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Delete(':id/users/:userId')
  @UseGuards(PermissionsGuard)
  @Permissions('roles.manage')
  async removeUser(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.rolesService.removeUser(
      roleId,
      userId,
      req.user.organizationId,
      req.user.id,
    );
  }
}