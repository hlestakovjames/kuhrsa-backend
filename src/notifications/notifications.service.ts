import { Injectable, Logger } from '@nestjs/common';
import { CreateEmailOptions, Resend } from 'resend';

import { PrismaService } from '../prisma/prisma.service';
import { buildMigrationWelcomeTemplate } from './templates/migration-welcome.template';

type NotificationType =
  | 'MIGRATION_WELCOME'
  | 'ACCOUNT_ACTIVATED'
  | 'MEMBERSHIP_RENEWAL'
  | 'PAYMENT_CONFIRMATION'
  | 'PASSWORD_RESET'
  | 'GENERAL_NOTICE';

type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP';

type NotificationMetadata = {
  emailHtml?: string;
  emailText?: string;
  memberNumber?: string;
  category?: string;
  [key: string]: string | undefined;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly resend: Resend | null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  private getApplicationUrl(): string {
    const configuredUrl = process.env.FRONTEND_URL?.trim();

    return configuredUrl?.replace(/\/+$/, '') || 'http://localhost:3000';
  }

  private getEmailFrom(): string {
    return process.env.EMAIL_FROM?.trim() || 'KUHRSA <onboarding@resend.dev>';
  }

  private getMetadata(metadata: unknown): NotificationMetadata {
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      Array.isArray(metadata)
    ) {
      return {};
    }

    const record = metadata as Record<string, unknown>;

    const result: NotificationMetadata = {};

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }

    return result;
  }

  async createNotification(params: {
    organizationId: string;
    memberId?: string;
    userId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    templateKey?: string;
    metadata?: NotificationMetadata;
  }) {
    return this.prisma.notification.create({
      data: {
        organizationId: params.organizationId,

        memberId: params.memberId,

        userId: params.userId,

        type: params.type,

        channel: params.channel,

        status: 'PENDING',

        recipient: params.recipient,

        subject: params.subject,

        templateKey: params.templateKey,

        metadata: params.metadata ? params.metadata : undefined,
      },
    });
  }

  async sendNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },

      include: {
        member: {
          include: {
            user: true,
          },
        },

        user: true,
      },
    });

    if (!notification) {
      throw new Error('Notification not found.');
    }

    if (notification.channel !== 'EMAIL') {
      throw new Error(
        `Channel ${notification.channel} is not yet supported by the email sender.`,
      );
    }

    if (notification.status === 'SENT' && notification.providerMessageId) {
      return notification;
    }

    if (!this.resend) {
      await this.markFailed(
        notification.id,
        'RESEND_API_KEY is not configured.',
      );

      return null;
    }

    const nextAttempts = notification.attempts + 1;

    await this.prisma.notification.update({
      where: {
        id: notification.id,
      },

      data: {
        attempts: nextAttempts,

        status: 'PENDING',

        errorMessage: null,

        failedAt: null,
      },
    });

    try {
      if (!notification.subject) {
        throw new Error('Notification subject is required.');
      }

      const metadata = this.getMetadata(notification.metadata);

      if (!metadata.emailHtml && !metadata.emailText) {
        throw new Error('Notification email content is missing.');
      }

      const emailPayload: CreateEmailOptions = {
        from: this.getEmailFrom(),

        to: [notification.recipient],

        subject: notification.subject,

        html: metadata.emailHtml ?? '',

        text: metadata.emailText ?? '',
      };

      const emailResult = await this.resend.emails.send(emailPayload);

      if (emailResult.error) {
        throw new Error(
          emailResult.error.message || 'Resend rejected the email.',
        );
      }

      const providerMessageId = emailResult.data?.id ?? null;

      return this.prisma.notification.update({
        where: {
          id: notification.id,
        },

        data: {
          status: 'SENT',

          sentAt: new Date(),

          providerMessageId,

          errorMessage: null,

          failedAt: null,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown email delivery error.';

      await this.markFailed(notification.id, message);

      this.logger.error(`Notification ${notification.id} failed: ${message}`);

      return null;
    }
  }

  private async markFailed(notificationId: string, message: string) {
    return this.prisma.notification.update({
      where: {
        id: notificationId,
      },

      data: {
        status: 'FAILED',

        failedAt: new Date(),

        errorMessage: message,
      },
    });
  }

  async sendMigrationWelcome(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },

      include: {
        user: true,
      },
    });

    if (!member) {
      throw new Error('Member not found.');
    }

    const recipient = member.email ?? member.user?.email ?? null;

    if (!recipient) {
      throw new Error(
        `Member ${member.memberNumber} does not have an email address.`,
      );
    }

    const firstName = member.user?.firstName?.trim() || 'KUHRSA Member';

    const lastName = member.user?.lastName?.trim() || '';

    const identifier =
      member.registrationNumber ??
      member.staffNumber ??
      member.admissionNumber ??
      'Membership record';

    const activationUrl = `${this.getApplicationUrl()}/activate-membership?member=${encodeURIComponent(
      member.memberNumber,
    )}`;

    const template = buildMigrationWelcomeTemplate({
      firstName,

      lastName,

      memberNumber: member.memberNumber,

      category: member.category,

      identifier,

      activationUrl,
    });

    const notification = await this.createNotification({
      organizationId: member.organizationId,

      memberId: member.id,

      userId: member.userId ?? undefined,

      type: 'MIGRATION_WELCOME',

      channel: 'EMAIL',

      recipient,

      subject: template.subject,

      templateKey: 'migration-welcome',

      metadata: {
        emailHtml: template.html,

        emailText: template.text,

        memberNumber: member.memberNumber,

        category: member.category,
      },
    });

    return this.sendNotification(notification.id);
  }

  async findById(notificationId: string) {
    return this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },

      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            category: true,
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
    });
  }

  async retry(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found.');
    }

    const status = notification.status;

    if (status !== 'FAILED' && status !== 'PENDING') {
      throw new Error('Only pending or failed notifications can be retried.');
    }

    return this.sendNotification(notification.id);
  }
}
