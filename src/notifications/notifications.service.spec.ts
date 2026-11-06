import { NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationType,
} from '../../generated/prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService member access', () => {
  const userId = 'user-a';
  const organizationId = 'organization-a';
  const memberId = 'member-a';

  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
    member: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      member: {
        findFirst: jest.fn(),
      },
    };

    service = new NotificationsService(prisma as any, {} as any);
  });

  it('lists only in-app notifications owned by the authenticated user or linked member', async () => {
    await service.findMine(userId, organizationId, memberId, {});

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          channel: NotificationChannel.IN_APP,
          OR: [{ userId }, { memberId }],
        },
        select: expect.objectContaining({
          id: true,
          type: true,
          channel: true,
          readAt: true,
        }),
      }),
    );

    const select = prisma.notification.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('recipient');
    expect(select).not.toHaveProperty('metadata');
    expect(select).not.toHaveProperty('errorMessage');
  });

  it('does not include another member or organization when listing notifications', async () => {
    await service.findMine(userId, organizationId, null, {});

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          channel: NotificationChannel.IN_APP,
          OR: [{ userId }],
        },
      }),
    );
  });

  it('counts only unread in-app notifications for the authenticated account', async () => {
    prisma.notification.count.mockResolvedValue(3);

    await expect(
      service.getMyUnreadCount(userId, organizationId, memberId),
    ).resolves.toEqual({ unreadCount: 3 });

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        organizationId,
        channel: NotificationChannel.IN_APP,
        OR: [{ userId }, { memberId }],
        readAt: null,
      },
    });
  });

  it('marks only an owned in-app notification as read', async () => {
    const readAt = new Date();
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue({ id: 'notification-a', readAt });

    const result = await service.markMineAsRead(
      'notification-a',
      userId,
      organizationId,
      memberId,
    );

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'notification-a',
        organizationId,
        channel: NotificationChannel.IN_APP,
        OR: [{ userId }, { memberId }],
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({
      id: 'notification-a',
      readAt,
      alreadyRead: false,
    });
  });

  it('does not reveal or modify another member notification', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markMineAsRead(
        'notification-b',
        userId,
        organizationId,
        memberId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'notification-b',
          organizationId,
          channel: NotificationChannel.IN_APP,
          OR: [{ userId }, { memberId }],
        }),
      }),
    );
  });

  it('marks all unread notifications only within the authenticated account scope', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markAllMineAsRead(
      userId,
      organizationId,
      memberId,
    );

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        channel: NotificationChannel.IN_APP,
        OR: [{ userId }, { memberId }],
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(result.updatedCount).toBe(2);
  });

  it('scopes administrative notification listings to the authenticated organization', async () => {
    await service.findAll({}, organizationId);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
      }),
    );
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { organizationId },
    });
  });

  it('scopes administrative member lookup to the authenticated organization', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.findByMember('member-from-another-org', organizationId, {}),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'member-from-another-org',
        organizationId,
      },
      select: { id: true },
    });
  });

  it('scopes notification detail lookup to the authenticated organization', async () => {
    await expect(
      service.findOne('notification-from-another-org', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'notification-from-another-org',
          organizationId,
        },
      }),
    );
  });

  it('scopes notification retries to the authenticated organization', async () => {
    await expect(
      service.retry('notification-from-another-org', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'notification-from-another-org',
        organizationId,
      },
    });
  });

  it('uses the IN_APP channel for member-facing notification queries', async () => {
    await service.findMine(userId, organizationId, memberId, {
      type: NotificationType.GENERAL_NOTICE,
    });

    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({
      organizationId,
      channel: NotificationChannel.IN_APP,
      OR: [{ userId }, { memberId }],
      type: NotificationType.GENERAL_NOTICE,
    });
  });
});
