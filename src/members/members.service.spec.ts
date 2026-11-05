import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { MemberNumberService } from './member-number.service';
import { NotificationsService } from '../notifications/notifications.service';
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
        {
          provide: NotificationsService,
          useValue: {
            sendMemberWelcome: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
