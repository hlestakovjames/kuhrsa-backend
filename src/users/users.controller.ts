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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('users.view')
  async findAll(@Request() req: any) {
    return this.usersService.findAll(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.view')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.usersService.findOne(
      id,
      req.user.organizationId,
    );
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('users.create')
  async create(
    @Body() dto: CreateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.create(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(
      id,
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }
}