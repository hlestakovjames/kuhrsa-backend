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

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreateFinancialPeriodDto } from './dto/create-financial-period.dto';
import { UpdateFinancialPeriodDto } from './dto/update-financial-period.dto';
import { FinancialPeriodsService } from './financial-periods.service';

@Controller('finance/periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancialPeriodsController {
  constructor(
    private readonly financialPeriodsService: FinancialPeriodsService,
  ) {}

  @Get()
  @Permissions('finance.periods.view')
  findAll(@Request() req: AuthenticatedRequest) {
    return this.financialPeriodsService.findAll(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @Permissions('finance.periods.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.financialPeriodsService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.periods.create')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateFinancialPeriodDto,
  ) {
    return this.financialPeriodsService.create(
      req.user.organizationId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.periods.update')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialPeriodDto,
  ) {
    return this.financialPeriodsService.update(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Post(':id/close')
  @Permissions('finance.periods.close')
  close(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.financialPeriodsService.close(
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/lock')
  @Permissions('finance.periods.lock')
  lock(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.financialPeriodsService.lock(
      req.user.organizationId,
      id,
    );
  }
}
