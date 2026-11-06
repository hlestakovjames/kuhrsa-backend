import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { MemberActivationController } from './member-activation.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberDirectoryService } from './member-directory.service';
import { MemberNumberService } from './member-number.service';

@Module({
  imports: [NotificationsModule],

  controllers: [MembersController, MemberActivationController],

  providers: [MembersService, MemberNumberService, MemberDirectoryService],

  exports: [MembersService, MemberNumberService],
})
export class MembersModule {}
