import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      role: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'custom-role-id',
          organizationId: 'organization-id',
          isSystemRole: false,
        }),
      },
      permission: {
        findUnique: jest.fn(),
      },
      rolePermission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'role-permission-id' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (work) =>
        work({
          rolePermission: {
            create: jest.fn().mockResolvedValue({ id: 'role-permission-id' }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    'users.roles.assign',
    'users.permissions.manage',
    'system.settings.manage',
    'governance.assignments.revoke',
    'governance.positions.manage',
    'governance.terms.manage',
  ])('rejects protected permission %s on a custom role', async (code) => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'permission-id',
      code,
    });

    await expect(
      service.assignPermission(
        'custom-role-id',
        'permission-id',
        'organization-id',
        'actor-user-id',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows an ordinary module permission on a custom role', async () => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'permission-id',
      code: 'finance.payments.view',
      name: 'View Payments',
      description: 'View payment transactions.',
    });

    await expect(
      service.assignPermission(
        'custom-role-id',
        'permission-id',
        'organization-id',
        'actor-user-id',
      ),
    ).resolves.toEqual([]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
