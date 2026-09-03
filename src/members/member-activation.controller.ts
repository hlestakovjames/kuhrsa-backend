import { Body, Controller, Post } from '@nestjs/common';
import { ActivateMemberDto } from './dto/activate-member.dto';
import { MembersService } from './members.service';

@Controller('membership-activation')
export class MemberActivationController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  async activate(@Body() dto: ActivateMemberDto) {
    return this.membersService.activateByToken(dto.token, dto.password);
  }
}
