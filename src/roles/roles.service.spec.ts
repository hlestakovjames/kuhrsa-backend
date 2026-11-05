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
        update: jest.fn().mockResolvedValue({ id: 'user-role-id', userId, roleId }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        findFirst: jest.fn(({ where }: any) =>
          where.id === actorUserId
            ? { id: actorUserId, organizationId, status: 'ACTIVE', isSystemOwner: true, userRoles: [] }
            : user,
        ),
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

  it('rejects the reserved SYSTEM_OWNER role code', async () => {
    role.code = 'SYSTEM_OWNER';

    await expect(
      service.assignUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    'SYSTEM_OWNER',
    'SUPER_ADMINISTRATOR',
    'ADMINISTRATOR',
    'EXECUTIVE',
    'MEMBER',
  ])('rejects creation of the reserved %s role code', async (code) => {
    await expect(
      service.create(organizationId, actorUserId, {
        name: 'Reserved Role',
        code: code.toLowerCase(),
        description: 'Reserved built-in role code.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    'SUPER_ADMINISTRATOR',
    'ADMINISTRATOR',
    'EXECUTIVE',
    'MEMBER',
  ])('rejects assigning a custom role using reserved code %s', async (code) => {
    role.code = code;
    role.isSystemRole = false;

    await expect(
      service.assignUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    'SUPER_ADMINISTRATOR',
    'ADMINISTRATOR',
    'EXECUTIVE',
    'MEMBER',
  ])('rejects revoking a custom role using reserved code %s', async (code) => {
    role.code = code;
    role.isSystemRole = false;

    await expect(
      service.removeUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow revoking the reserved SYSTEM_OWNER role code', async () => {
    role.code = 'SYSTEM_OWNER';

    await expect(
      service.removeUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow ordinary role management to revoke the System Owner assignment', async () => {
    user.isSystemOwner = true;

    await expect(
      service.removeUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revokes an assignment conditionally and audits the change in the same transaction', async () => {
    const assignedAt = new Date('2026-10-01T00:00:00.000Z');
    const startsAt = new Date('2026-10-01T00:00:00.000Z');
    const endsAt = new Date('2026-12-01T00:00:00.000Z');
    tx.userRole.findUnique.mockResolvedValue({
      id: 'user-role-id',
      userId,
      roleId,
      assignedAt,
      startsAt,
      endsAt,
      revokedAt: null,
    });

    await expect(
      service.removeUser(roleId, userId, organizationId, actorUserId),
    ).resolves.toEqual(
      expect.objectContaining({
        message: 'Role revoked successfully.',
        userId,
        roleId,
        roleCode: role.code,
        revokedAt: expect.any(Date),
      }),
    );

    expect(tx.userRole.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-role-id',
        revokedAt: null,
        assignedAt,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not write an audit record when an assignment changes before revocation', async () => {
    const assignedAt = new Date('2026-10-01T00:00:00.000Z');
    tx.userRole.findUnique.mockResolvedValue({
      id: 'user-role-id',
      userId,
      roleId,
      assignedAt,
      startsAt: assignedAt,
      endsAt: null,
      revokedAt: null,
    });
    tx.userRole.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.removeUser(roleId, userId, organizationId, actorUserId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('serializes Executive appointments and reads the existing assignment inside the transaction', async () => {
    role.code = 'EXECUTIVE';
    role.name = 'Executive';

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
    ).resolves.toEqual(expect.objectContaining({ id: roleId }));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRole.findUnique).toHaveBeenCalledWith({
      where: { userId_roleId: { userId, roleId } },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userRole.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.userRole.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('serializes general role assignments and checks for overlapping assignments inside the transaction', async () => {
    role.code = 'REPORT_VIEWER';
    role.name = 'Report Viewer';

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
    ).resolves.toEqual(expect.objectContaining({ id: roleId }));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRole.findUnique).toHaveBeenCalledWith({
      where: { userId_roleId: { userId, roleId } },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userRole.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.userRole.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('allows reappointment when the previous Administrator term does not overlap', async () => {
    role.code = 'ADMINISTRATOR';
    role.name = 'Administrator';
    tx.userRole.findUnique.mockResolvedValue({
      id: 'previous-user-role-id',
      userId,
      roleId,
      startsAt: new Date(Date.now() - 10 * 86_400_000),
      endsAt: new Date(Date.now() - 86_400_000),
      revokedAt: null,
    });

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
    ).resolves.toEqual(expect.objectContaining({ id: roleId }));

    expect(tx.userRole.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'previous-user-role-id' },
      }),
    );
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });
});
