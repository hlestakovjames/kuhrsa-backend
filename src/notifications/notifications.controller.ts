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
    const notification =
      await this.notificationsService.sendMigrationWelcome(memberId);

    return {
      message: notification
        ? 'Migration welcome notification processed successfully.'
        : 'Migration welcome notification was created but could not be delivered.',
      notification,
      requestedBy: req.user.id,
    };
  }
}
