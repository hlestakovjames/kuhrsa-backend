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

import { CreateFeeDefinitionDto } from './dto/create-fee-definition.dto';
import { UpdateFeeDefinitionDto } from './dto/update-fee-definition.dto';
import { FeeDefinitionsService } from './fee-definitions.service';

@Controller('finance/fees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeeDefinitionsController {
  constructor(
    private readonly feeDefinitionsService: FeeDefinitionsService,
  ) {}

  @Get()
  @Permissions('finance.fees.view')
  findAll(@Request() req: AuthenticatedRequest) {
    return this.feeDefinitionsService.findAll(
      req.user.organizationId,
    );
  }

  @Get(':id')
  @Permissions('finance.fees.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.feeDefinitionsService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.fees.manage')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateFeeDefinitionDto,
  ) {
    return this.feeDefinitionsService.create(
      req.user.organizationId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('finance.fees.manage')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFeeDefinitionDto,
  ) {
    return this.feeDefinitionsService.update(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @Post(':id/activate')
  @Permissions('finance.fees.manage')
  activate(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.feeDefinitionsService.activate(
      req.user.organizationId,
      id,
    );
  }

  @Post(':id/deactivate')
  @Permissions('finance.fees.manage')
  deactivate(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.feeDefinitionsService.deactivate(
      req.user.organizationId,
      id,
    );
  }
}
