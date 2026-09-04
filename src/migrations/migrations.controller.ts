import {
  Controller,
  Get,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { MigrationsService } from './migrations.service';

@Controller('migrations')
@UseGuards(AuthGuard('jwt'))
export class MigrationsController {
  constructor(private readonly migrationsService: MigrationsService) {}

  @Get('template')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async template(@Res() res: Response): Promise<void> {
    const buffer = await this.migrationsService.generateTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="KUHRSA_Member_Migration_Template.xlsx"',
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  }

  @Post('upload')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile()
    file: Express.Multer.File,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.migrationsService.upload(
      req.user.organizationId,
      req.user.id,
      file,
    );
  }

  @Get(':id/report')
  @UseGuards(PermissionsGuard)
  @Permissions('members.view')
  async report(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.migrationsService.generateReport(
      id,
      req.user.organizationId,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
      'Content-Length': report.buffer.length.toString(),
    });

    res.send(report.buffer);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('members.view')
  async getBatch(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.migrationsService.getBatch(id, req.user.organizationId);
  }

  @Post(':id/import')
  @UseGuards(PermissionsGuard)
  @Permissions('members.manage')
  async importBatch(
    @Param('id') id: string,
    @Request()
    req: AuthenticatedRequest,
  ) {
    return this.migrationsService.importBatch(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }
}
