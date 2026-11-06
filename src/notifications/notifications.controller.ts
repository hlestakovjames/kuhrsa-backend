import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me/unread-count')
  async getMyUnreadCount(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.getMyUnreadCount(
      req.user.id,
      req.user.organizationId,
      req.user.member?.id,
    );
  }

  @Get('me')
  async findMine(
    @Query() query: NotificationQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.findMine(
      req.user.id,
      req.user.organizationId,
      req.user.member?.id,
      query,
    );
  }

  @Patch('me/read-all')
  async markAllMineAsRead(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.markAllMineAsRead(
      req.user.id,
      req.user.organizationId,
      req.user.member?.id,
    );
  }

  @Patch('me/:id/read')
  async markMineAsRead(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markMineAsRead(
      id,
      req.user.id,
      req.user.organizationId,
      req.user.member?.id,
    );
  }

  @Get()
  @Permissions('communication.notifications.view')
  async findAll(
    @Query() query: NotificationQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.findAll(query, req.user.organizationId);
  }

  @Get('summary')
  @Permissions('communication.notifications.view')
  async getSummary(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.getSummary(req.user.organizationId);
  }

  @Get('member/:memberId')
  @Permissions('communication.notifications.view')
  async findByMember(
    @Param('memberId') memberId: string,
    @Query() query: NotificationQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.findByMember(
      memberId,
      req.user.organizationId,
      query,
    );
  }

  @Get(':id')
  @Permissions('communication.notifications.view')
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.findOne(id, req.user.organizationId);
  }

  @Post('members/:memberId/migration-welcome')
  @Permissions('communication.notifications.manage')
  async sendMigrationWelcome(
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.notificationsService.sendMigrationWelcome(
      memberId,
      req.user.organizationId,
    );

    return {
      message: 'Migration welcome notifications processed.',
      notifications: result,
      requestedBy: req.user.id,
    };
  }

  @Post('members/:memberId/migration-welcome-sms')
  @Permissions('communication.notifications.manage')
  async sendMigrationWelcomeSms(
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.notificationsService.sendMigrationWelcomeSmsOnly(
      memberId,
      req.user.organizationId,
    );

    return {
      message: 'Migration welcome SMS processed.',
      notification: result,
      requestedBy: req.user.id,
    };
  }

  @Post(':id/retry')
  @Permissions('communication.notifications.manage')
  async retry(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.notificationsService.retry(
      id,
      req.user.organizationId,
    );

    return {
      message: 'Notification retry processed.',
      notification: result,
      requestedBy: req.user.id,
    };
  }
}
