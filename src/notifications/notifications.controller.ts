import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { Permissions } from '../auth/decorators/permissions/permissions.decorator';

import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('members.view')
  async findAll(@Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Get('summary')
  @Permissions('members.view')
  async getSummary() {
    return this.notificationsService.getSummary();
  }

  @Get('member/:memberId')
  @Permissions('members.view')
  async findByMember(
    @Param('memberId') memberId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findByMember(memberId, query);
  }

  @Get(':id')
  @Permissions('members.view')
  async findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

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
      notifications: result,
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
  async retry(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const result = await this.notificationsService.retry(id);

    return {
      message: 'Notification retry processed.',
      notification: result,
      requestedBy: req.user.id,
    };
  }
}
