import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Resend } from 'resend';

import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { NotificationQueryDto } from './dto/notification-query.dto';
import { SmsService } from './sms/sms.service';
import { buildMigrationWelcomeTemplate } from './templates/migration-welcome.template';

interface MigrationMember {
  id: string;
  memberNumber: string;
  category: string;
  email: string | null;
  phone: string | null;
  registrationNumber: string | null;
  nationalId: string | null;
  staffNumber: string | null;
  organizationId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  } | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly resend: Resend | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  private getApplicationUrl(): string {
    return process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  }

  private getEmailFrom(): string {
    return process.env.EMAIL_FROM?.trim() || 'KUHRSA <onboarding@resend.dev>';
  }

  private async getMigrationMember(memberId: string): Promise<MigrationMember> {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
      select: {
        id: true,
        memberNumber: true,
        category: true,
        email: true,
        phone: true,
        registrationNumber: true,
        nationalId: true,
        staffNumber: true,
        organizationId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    return member;
  }

  private async createNotification(data: {
    organizationId: string;
    memberId?: string;
    userId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    templateKey?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        organizationId: data.organizationId,
        memberId: data.memberId,
        userId: data.userId,
        type: data.type,
        channel: data.channel,
        status: NotificationStatus.PENDING,
        recipient: data.recipient,
        subject: data.subject,
        templateKey: data.templateKey,
        metadata: data.metadata,
      },
    });
  }

  async sendNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.channel !== NotificationChannel.EMAIL) {
      throw new Error('This notification is not an email notification.');
    }

    if (!this.resend) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    await this.prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    try {
      const metadata =
        notification.metadata &&
        typeof notification.metadata === 'object' &&
        !Array.isArray(notification.metadata)
          ? notification.metadata
          : {};

      const html =
        typeof metadata.html === 'string'
          ? metadata.html
          : '<p>This is a KUHRSA notification.</p>';

      const text =
        typeof metadata.text === 'string'
          ? metadata.text
          : 'This is a KUHRSA notification.';

      const subject = notification.subject || 'KUHRSA Notification';

      const result = await this.resend.emails.send({
        from: this.getEmailFrom(),
        to: notification.recipient,
        subject,
        html,
        text,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await this.prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          errorMessage: null,
          providerMessageId: result.data?.id || null,
        },
      });

      return {
        notificationId: notification.id,
        status: NotificationStatus.SENT,
        providerMessageId: result.data?.id || null,
        recipient: notification.recipient,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown email delivery error.';

      await this.prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage,
        },
      });

      this.logger.error(
        `Email notification ${notification.id} failed: ${errorMessage}`,
      );

      return {
        notificationId: notification.id,
        status: NotificationStatus.FAILED,
        providerMessageId: null,
        recipient: notification.recipient,
        errorMessage,
      };
    }
  }

  async sendSmsNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.channel !== NotificationChannel.SMS) {
      throw new Error('This notification is not an SMS notification.');
    }

    const metadata =
      notification.metadata &&
      typeof notification.metadata === 'object' &&
      !Array.isArray(notification.metadata)
        ? notification.metadata
        : {};

    const smsText =
      typeof metadata.smsText === 'string' ? metadata.smsText : '';

    if (!smsText) {
      throw new Error('SMS notification message is missing.');
    }

    await this.prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    try {
      const result = await this.smsService.send(
        notification.recipient,
        smsText,
      );

      const updatedMetadata = {
        ...metadata,
        smsProviderStatus: result.status,
        smsProviderNumber: result.number,
        smsProviderCost: result.cost,
        smsProviderMessage: result.message,
      };

      if (!result.success) {
        const errorMessage =
          result.message || "Africa's Talking rejected the SMS request.";

        await this.prisma.notification.update({
          where: {
            id: notification.id,
          },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            errorMessage,
            providerMessageId: result.messageId,
            metadata: updatedMetadata,
          },
        });

        return {
          notificationId: notification.id,
          status: NotificationStatus.FAILED,
          providerMessageId: result.messageId,
          recipient: notification.recipient,
          errorMessage,
        };
      }

      await this.prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          errorMessage: null,
          providerMessageId: result.messageId,
          metadata: updatedMetadata,
        },
      });

      return {
        notificationId: notification.id,
        status: NotificationStatus.SENT,
        providerMessageId: result.messageId,
        recipient: notification.recipient,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown SMS delivery error.';

      await this.prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage,
        },
      });

      this.logger.error(
        `SMS notification ${notification.id} failed: ${errorMessage}`,
      );

      return {
        notificationId: notification.id,
        status: NotificationStatus.FAILED,
        providerMessageId: null,
        recipient: notification.recipient,
        errorMessage,
      };
    }
  }

  async sendMigrationWelcome(memberId: string) {
    const member = await this.getMigrationMember(memberId);

    const firstName = member.user?.firstName?.trim() || 'Member';

    const lastName = member.user?.lastName?.trim() || '';

    const activationUrl = `${this.getApplicationUrl()}/activate-membership?member=${encodeURIComponent(
      member.memberNumber,
    )}`;

    const identifier =
      member.registrationNumber ||
      member.staffNumber ||
      member.nationalId ||
      member.memberNumber;

    const template = buildMigrationWelcomeTemplate({
      firstName,
      lastName,
      memberNumber: member.memberNumber,
      category: member.category,
      identifier,
      activationUrl,
    });

    const results: Array<unknown> = [];

    if (member.email) {
      const notification = await this.createNotification({
        organizationId: member.organizationId,
        memberId: member.id,
        userId: undefined,
        type: NotificationType.MIGRATION_WELCOME,
        channel: NotificationChannel.EMAIL,
        recipient: member.email,
        subject: template.subject,
        templateKey: 'migration-welcome',
        metadata: {
          html: template.html,
          text: template.text,
        },
      });

      results.push(await this.sendNotification(notification.id));
    }

    if (member.phone) {
      const smsText =
        `KUHRSA: Membership migrated. ` +
        `Member No: ${member.memberNumber}. ` +
        `Activate: ${activationUrl}`;

      const notification = await this.createNotification({
        organizationId: member.organizationId,
        memberId: member.id,
        type: NotificationType.MIGRATION_WELCOME,
        channel: NotificationChannel.SMS,
        recipient: member.phone,
        templateKey: 'migration-welcome-sms',
        metadata: {
          smsText,
        },
      });

      results.push(await this.sendSmsNotification(notification.id));
    }

    return results;
  }

  async sendMigrationWelcomeSmsOnly(memberId: string) {
    const member = await this.getMigrationMember(memberId);

    if (!member.phone) {
      throw new Error('Member does not have a phone number.');
    }

    const activationUrl = `${this.getApplicationUrl()}/activate-membership?member=${encodeURIComponent(
      member.memberNumber,
    )}`;

    const smsText =
      `KUHRSA: Membership migrated. ` +
      `Member No: ${member.memberNumber}. ` +
      `Activate: ${activationUrl}`;

    const notification = await this.createNotification({
      organizationId: member.organizationId,
      memberId: member.id,
      type: NotificationType.MIGRATION_WELCOME,
      channel: NotificationChannel.SMS,
      recipient: member.phone,
      templateKey: 'migration-welcome-sms',
      metadata: {
        smsText,
      },
    });

    return this.sendSmsNotification(notification.id);
  }

  async findAll(query: NotificationQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);

    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);

    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        {
          recipient: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          subject: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          errorMessage: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};

      if (query.from) {
        const from = new Date(query.from);

        if (!Number.isNaN(from.getTime())) {
          createdAt.gte = from;
        }
      }

      if (query.to) {
        const to = new Date(query.to);

        if (!Number.isNaN(to.getTime())) {
          createdAt.lte = to;
        }
      }

      where.createdAt = createdAt;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),

      this.prisma.notification.count({
        where,
      }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            email: true,
            phone: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return notification;
  }

  async findByMember(memberId: string, query: NotificationQueryDto) {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    return this.findAll({
      ...query,
      memberId,
    });
  }

  async getSummary() {
    const [total, sent, failed, pending, cancelled, email, sms, inApp] =
      await Promise.all([
        this.prisma.notification.count(),

        this.prisma.notification.count({
          where: {
            status: NotificationStatus.SENT,
          },
        }),

        this.prisma.notification.count({
          where: {
            status: NotificationStatus.FAILED,
          },
        }),

        this.prisma.notification.count({
          where: {
            status: NotificationStatus.PENDING,
          },
        }),

        this.prisma.notification.count({
          where: {
            status: NotificationStatus.CANCELLED,
          },
        }),

        this.prisma.notification.count({
          where: {
            channel: NotificationChannel.EMAIL,
          },
        }),

        this.prisma.notification.count({
          where: {
            channel: NotificationChannel.SMS,
          },
        }),

        this.prisma.notification.count({
          where: {
            channel: NotificationChannel.IN_APP,
          },
        }),
      ]);

    return {
      total,
      statuses: {
        sent,
        failed,
        pending,
        cancelled,
      },
      channels: {
        email,
        sms,
        inApp,
      },
    };
  }

  async retry(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (
      notification.status !== NotificationStatus.FAILED &&
      notification.status !== NotificationStatus.PENDING
    ) {
      throw new Error('Only failed or pending notifications can be retried.');
    }

    if (notification.channel === NotificationChannel.EMAIL) {
      return this.sendNotification(notification.id);
    }

    if (notification.channel === NotificationChannel.SMS) {
      return this.sendSmsNotification(notification.id);
    }

    throw new Error(
      `Retry is not currently supported for ${notification.channel} notifications.`,
    );
  }
}
