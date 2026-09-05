import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from '../auth/decorators/permissions/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { ActivateMemberDto } from './dto/activate-member.dto';
import { LookupMemberActivationDto } from './dto/lookup-member-activation.dto';
import { VerifyMemberActivationDto } from './dto/verify-member-activation.dto';
import { MembersService } from './members.service';

@Controller('membership-activation')
export class MemberActivationController {
  constructor(private readonly membersService: MembersService) {}

  @Post('lookup')
  async lookup(@Body() dto: LookupMemberActivationDto) {
    return this.membersService.lookupActivationEligibility(
      dto.identifier,
      dto.email,
      dto.phone,
    );
  }

  @Post('verify')
  async verify(@Body() dto: VerifyMemberActivationDto) {
    return this.membersService.verifyActivation(
      dto.token,
      dto.memberNumber,
      dto.firstName,
      dto.lastName,
      dto.email,
    );
  }

  @Post()
  async activate(@Body() dto: ActivateMemberDto) {
    return this.membersService.activateByToken(dto.token, dto.password);
  }

  @Post(':id/resend')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('members.manage')
  async resend(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.membersService.resendActivation(
      id,
      req.user.organizationId,
      req.user.id,
    );
  }
}
