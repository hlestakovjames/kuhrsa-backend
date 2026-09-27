import {
  Controller,
  Get,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('export/members')
  @Permissions('reports.membership.generate')
  async exportMembers(
    @Request() req: AuthenticatedRequest,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    await this.sendExport(
      res,
      await this.reportsService.exportMembers(
        req.user.organizationId,
        format,
      ),
    );
  }

  @Get('export/membership-periods')
  @Permissions('reports.membership.generate')
  async exportMembershipPeriods(
    @Request() req: AuthenticatedRequest,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    await this.sendExport(
      res,
      await this.reportsService.exportMembershipPeriods(
        req.user.organizationId,
        format,
      ),
    );
  }

  @Get('export/payments')
  @Permissions('reports.payments.generate')
  async exportPayments(
    @Request() req: AuthenticatedRequest,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    await this.sendExport(
      res,
      await this.reportsService.exportPayments(
        req.user.organizationId,
        format,
      ),
    );
  }

  @Get('export/charges')
  @Permissions('reports.finance.generate')
  async exportCharges(
    @Request() req: AuthenticatedRequest,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    await this.sendExport(
      res,
      await this.reportsService.exportCharges(
        req.user.organizationId,
        format,
      ),
    );
  }

  @Get('export/receipts')
  @Permissions('reports.finance.generate')
  async exportReceipts(
    @Request() req: AuthenticatedRequest,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    await this.sendExport(
      res,
      await this.reportsService.exportReceipts(
        req.user.organizationId,
        format,
      ),
    );
  }

  private async sendExport(
    res: Response,
    report: {
      fileName: string;
      contentType: string;
      buffer: Buffer;
    },
  ) {
    res.set({
      'Content-Type':
        report.contentType,
      'Content-Disposition':
        `attachment; filename="${report.fileName}"`,
      'Content-Length':
        report.buffer.length.toString(),
    });

    res.send(report.buffer);
  }
}
