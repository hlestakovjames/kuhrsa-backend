import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';

import { CreateReceiptDto } from './dto/create-receipt.dto';
import { VoidReceiptDto } from './dto/void-receipt.dto';
import { ReceiptsService } from './receipts.service';

@Controller('finance/receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
  ) {}

  @Get()
  @Permissions('finance.receipts.view')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('memberId') memberId?: string,
  ) {
    return this.receiptsService.findAll(
      req.user.organizationId,
      memberId,
    );
  }

  @Get(':id')
  @Permissions('finance.receipts.view')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.receiptsService.findOne(
      req.user.organizationId,
      id,
    );
  }

  @Post()
  @Permissions('finance.receipts.issue')
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateReceiptDto,
  ) {
    return this.receiptsService.create(
      req.user.organizationId,
      dto,
    );
  }

  @Post(':id/void')
  @Permissions('finance.receipts.manage')
  void(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: VoidReceiptDto,
  ) {
    return this.receiptsService.void(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
    );
  }
}
