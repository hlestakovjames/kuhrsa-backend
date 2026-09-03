import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberNumberService } from './member-number.service';

@Module({
  controllers: [MembersController],
  providers: [MembersService, MemberNumberService],
  exports: [MembersService, MemberNumberService],
})
export class MembersModule {}
