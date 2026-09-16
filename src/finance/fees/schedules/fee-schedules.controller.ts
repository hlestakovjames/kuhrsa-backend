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

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../../auth/types/authenticated-request';

import { CreateFeeScheduleDto } from './dto/create-fee-schedule.dto';
import { UpdateFeeScheduleDto } from './dto/update-fee-schedule.dto';
import { FeeSchedulesService } from './fee-schedules.service';

@Controller('finance/fees/:feeDefinitionId/schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeeSchedulesController {
  constructor(
    private readonly feeSchedulesService: FeeSchedulesService,
  ) {}

  @Get()
  @Permissions('finance.fees.view')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Param('feeDefinitionId') feeDefinitionId: string,
  ) {
    return this.feeSchedulesService.findAll(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @Permissions('finance.fees.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.feeSchedulesService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.fees.manage')
  create(
    @Request() req: AuthenticatedRequest,
    @Param('feeDefinitionId') feeDefinitionId: string,
    @Body() dto: CreateFeeScheduleDto,
  ) {
    return this.feeSchedulesService.create(
      req.user.organizationId,
      feeDefinitionId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.fees.manage')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFeeScheduleDto,
  ) {
    return this.feeSchedulesService.update(
      req.user.organizationId,
      id,
      dto,
    );
  }
}
