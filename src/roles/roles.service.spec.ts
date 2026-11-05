import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RolesService', () => {
  const organizationId = 'organization-id';
  const actorUserId = 'actor-user-id';
  const roleId = 'role-id';
  const userId = 'user-id';

  let service: RolesService;
  let prisma: any;
  let tx: any;
  let role: any;
  let user: any;

  beforeEach(() => {
    role = {
      id: roleId,
      organizationId,
      name: 'Super Administrator',
      code: 'SUPER_ADMINISTRATOR',
      description: 'Highest administrative role.',
      isSystemRole: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [],
      rolePermissions: [],
    };

    user = {
      id: userId,
      organizationId,
      isSystemOwner: false,
    };

    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: organizationId }]),
      userRole: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'user-role-id',
          userId,
          roleId,
        }),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
      },
    };

    prisma = {
      role: {
        findFirst: jest.fn().mockResolvedValue(role),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      $transaction: jest.fn(async (callback: (transaction: any) => unknown) =>
        callback(tx),
      ),
    };

    service = new RolesService(prisma as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('serializes Super Administrator assignments and counts future appointments against the limit', async () => {
    tx.userRole.count.mockResolvedValue(3);

    await expect(
      service.assignUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRole.count).toHaveBeenCalledWith({
      where: {
        roleId,
        user: { organizationId },
        revokedAt: null,
        OR: [
          { endsAt: null },
          { endsAt: { gt: expect.any(Date) } },
        ],
      },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userRole.count.mock.invocationCallOrder[0],
    );
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });

  it('serializes Administrator assignments and counts overlapping appointment windows', async () => {
    role.code = 'ADMINISTRATOR';
    role.name = 'Administrator';
    tx.userRole.count.mockResolvedValue(10);

    const startsAt = new Date(Date.now() + 60_000).toISOString();
    const endsAt = new Date(Date.now() + 86_400_000).toISOString();

    await expect(
      service.assignUser(
        roleId,
        userId,
        organizationId,
        actorUserId,
        startsAt,
        endsAt,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRole.count).toHaveBeenCalledWith({
      where: {
        roleId,
        user: { organizationId },
        revokedAt: null,
        startsAt: { lt: new Date(endsAt) },
        OR: [
          { endsAt: null },
          { endsAt: { gt: new Date(startsAt) } },
        ],
      },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userRole.count.mock.invocationCallOrder[0],
    );
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });

  it('does not allow ordinary role management to assign roles to the System Owner', async () => {
    user.isSystemOwner = true;

    await expect(
      service.assignUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
