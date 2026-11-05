import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  const memberRole = {
    id: 'member-role-id',
    name: 'Member',
    code: 'MEMBER',
  };

  const createdUser = {
    id: 'created-user-id',
    organizationId: 'organization-id',
    firstName: 'Test',
    lastName: 'Member',
    phone: null,
    email: 'test.member@example.com',
    status: 'ACTIVE',
    isSystemOwner: false,
    lastLoginAt: null,
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    updatedAt: new Date('2026-11-05T10:00:00.000Z'),
    organization: null,
    member: null,
    userRoles: [
      {
        role: memberRole,
      },
    ],
  };

  beforeEach(async () => {
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue(createdUser),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(createdUser),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue(memberRole),
      },
      $transaction: jest.fn((work) => work(tx)),
      tx,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('always assigns the baseline MEMBER role during user creation', async () => {
    const result = await service.create(
      'organization-id',
      'actor-user-id',
      {
        firstName: 'Test',
        lastName: 'Member',
        email: ' Test.Member@Example.com ',
        password: 'StrongPassword123',
        // Simulate a legacy or untyped caller attempting to select a
        // privileged role. The service must ignore this at runtime.
        roleId: 'super-administrator-role-id',
      } as any,
    );

    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_code: {
          organizationId: 'organization-id',
          code: 'MEMBER',
        },
      },
    });

    expect(prisma.tx.userRole.create).toHaveBeenCalledWith({
      data: {
        userId: 'created-user-id',
        roleId: 'member-role-id',
        assignedBy: 'actor-user-id',
      },
    });

    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'User',
          entityId: 'created-user-id',
          newValue: expect.objectContaining({
            role: {
              id: 'member-role-id',
              name: 'Member',
              code: 'MEMBER',
            },
          }),
        }),
      }),
    );

    expect(result.roles).toEqual([
      {
        id: 'member-role-id',
        name: 'Member',
        code: 'MEMBER',
      },
    ]);
  });
});
