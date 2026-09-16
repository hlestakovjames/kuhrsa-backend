import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreateMemberChargeDto } from './dto/create-member-charge.dto';
import { UpdateMemberChargeDto } from './dto/update-member-charge.dto';
import { WaiveMemberChargeDto } from './dto/waive-member-charge.dto';
import { MemberChargesService } from './member-charges.service';

@Controller('finance/charges')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberChargesController {
  constructor(
    private readonly memberChargesService: MemberChargesService,
  ) {}

  @Get()
  @Permissions('finance.charges.view')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('memberId') memberId?: string,
  ) {
    return this.memberChargesService.findAll(
      req.user.organizationId,
      memberId,
    );
  }

  @Get(':id')
  @Permissions('finance.charges.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.memberChargesService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.charges.create')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateMemberChargeDto,
  ) {
    return this.memberChargesService.create(
      req.user.organizationId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.charges.update')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMemberChargeDto,
  ) {
    return this.memberChargesService.update(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Post(':id/waive')
  @Permissions('finance.charges.waive')
  waive(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: WaiveMemberChargeDto,
  ) {
    return this.memberChargesService.waive(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/cancel')
  @Permissions('finance.charges.cancel')
  cancel(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.memberChargesService.cancel(
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/recalculate')
  @Permissions('finance.charges.update')
  recalculate(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.memberChargesService.recalculate(
      req.user.organizationId,
      id,
    );
  }
}
