import { Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('members/:memberId/migration-welcome')
  @Permissions('members.manage')
  async sendMigrationWelcome(
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result =
      await this.notificationsService.sendMigrationWelcome(memberId);

    return {
      message: 'Migration welcome notifications processed.',

      result,

      requestedBy: req.user.id,
    };
  }

  @Post('members/:memberId/migration-welcome-sms')
  @Permissions('members.manage')
  async sendMigrationWelcomeSms(
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result =
      await this.notificationsService.sendMigrationWelcomeSmsOnly(memberId);

    return {
      message: 'Migration welcome SMS processed.',

      notification: result,

      requestedBy: req.user.id,
    };
  }

  @Post(':id/retry')
  @Permissions('members.manage')
  async retry(
    @Param('id') notificationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.notificationsService.retry(notificationId);

    return {
      message: 'Notification retry processed.',

      notification: result,

      requestedBy: req.user.id,
    };
  }
}
