import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { MemberNumberService } from './member-number.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: MemberNumberService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
