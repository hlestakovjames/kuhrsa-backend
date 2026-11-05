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

  it('filters administrative permissions from governance-derived roles', () => {
    const user = {
      id: 'user-id',
      userRoles: [],
      member: {
        positionAssignments: [
          {
            id: 'assignment-id',
            startsAt: new Date('2026-01-01T00:00:00.000Z'),
            endsAt: new Date('2027-01-01T00:00:00.000Z'),
            roles: [
              {
                assignedAt: new Date('2026-01-01T00:00:00.000Z'),
                assignedBy: 'actor-id',
                role: {
                  id: 'executive-role-id',
                  code: 'EXECUTIVE',
                  name: 'Executive',
                  rolePermissions: [
                    { permission: { code: 'governance.executive.view' } },
                    { permission: { code: 'finance.payments.view' } },
                    { permission: { code: 'users.roles.assign' } },
                    { permission: { code: 'system.settings.manage' } },
                    { permission: { code: 'governance.assignments.revoke' } },
                  ],
                },
              },
              {
                assignedAt: new Date('2026-01-01T00:00:00.000Z'),
                assignedBy: 'actor-id',
                role: {
                  id: 'admin-role-id',
                  code: 'ADMINISTRATOR',
                  name: 'Administrator',
                  rolePermissions: [
                    { permission: { code: 'membership.members.view' } },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const result = (service as any).withEffectiveRoles(user);

    expect(result.userRoles).toHaveLength(1);
    expect(result.userRoles[0].role.code).toBe('EXECUTIVE');
    expect(
      result.userRoles[0].role.rolePermissions.map(
        (item: any) => item.permission.code,
      ),
    ).toEqual([
      'governance.executive.view',
      'finance.payments.view',
    ]);
  });

  it('filters protected permissions from directly assigned custom roles but preserves system roles', () => {
    const user = {
      id: 'user-id',
      userRoles: [
        {
          id: 'custom-assignment-id',
          role: {
            id: 'custom-role-id',
            code: 'CUSTOM_FINANCE',
            isSystemRole: false,
            rolePermissions: [
              { permission: { code: 'finance.payments.view' } },
              { permission: { code: 'users.roles.assign' } },
              { permission: { code: 'system.settings.manage' } },
              { permission: { code: 'governance.assignments.revoke' } },
            ],
          },
        },
        {
          id: 'system-assignment-id',
          role: {
            id: 'administrator-role-id',
            code: 'ADMINISTRATOR',
            isSystemRole: true,
            rolePermissions: [
              { permission: { code: 'users.roles.assign' } },
              { permission: { code: 'system.settings.manage' } },
            ],
          },
        },
      ],
      member: {
        positionAssignments: [],
      },
    };

    const result = (service as any).withEffectiveRoles(user);

    expect(result.userRoles[0].role.rolePermissions.map(
      (item: any) => item.permission.code,
    )).toEqual(['finance.payments.view']);
    expect(result.userRoles[1].role.rolePermissions.map(
      (item: any) => item.permission.code,
    )).toEqual([
      'users.roles.assign',
      'system.settings.manage',
    ]);
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
