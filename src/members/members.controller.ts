import {
  Body,
  Controller,
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
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { CreateMemberDto } from './dto/create-member.dto';
import { LinkMemberAccountDto } from './dto/link-member-account.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@Controller('members')
@UseGuards(AuthGuard('jwt'))
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('members.view')
  async findAll(
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.findAll(req.user.organizationId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('members.view')
  async findOne(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.findOne(id, req.user.organizationId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async create(
    @Body() dto: CreateMemberDto,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.create(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.update(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Post(':id/link-account')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async linkAccount(
    @Param('id') id: string,
    @Body() dto: LinkMemberAccountDto,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.linkAccount(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Post(':id/approve')
  @UseGuards(PermissionsGuard)
  @Permissions('members.approve')
  async approve(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.approve(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Post(':id/activate')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async activate(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.activate(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }

  @Post(':id/suspend')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async suspend(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.membersService.suspend(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }
}
