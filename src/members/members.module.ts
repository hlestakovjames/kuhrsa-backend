import { Module } from '@nestjs/common';
import { MemberActivationController } from './member-activation.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberNumberService } from './member-number.service';

@Module({
  controllers: [MembersController, MemberActivationController],

  providers: [MembersService, MemberNumberService],

  exports: [MembersService, MemberNumberService],
})
export class MembersModule {}
