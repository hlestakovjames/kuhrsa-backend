import { Injectable, Logger } from '@nestjs/common';
import { CreateEmailOptions, Resend } from 'resend';

import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms/sms.service';
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
  smsText?: string;
  memberNumber?: string;
  category?: string;
  providerStatus?: string;
  providerCost?: string;
  [key: string]: string | undefined;
};

type NotificationSendResult = {
  notificationId: string;
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  recipient: string;
  errorMessage: string | null;
};

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
        `Channel ${notification.channel} is not supported by the email sender.`,
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

      this.logger.error(
        `Email notification ${notification.id} failed: ${message}`,
      );

      return null;
    }
  }

  async sendSmsNotification(
    notificationId: string,
  ): Promise<NotificationSendResult> {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found.');
    }

    if (notification.channel !== 'SMS') {
      throw new Error(
        `Channel ${notification.channel} is not supported by the SMS sender.`,
      );
    }

    if (notification.status === 'SENT' && notification.providerMessageId) {
      return {
        notificationId: notification.id,

        status: 'SENT',

        providerMessageId: notification.providerMessageId,

        recipient: notification.recipient,

        errorMessage: null,
      };
    }

    const metadata = this.getMetadata(notification.metadata);

    if (!metadata.smsText) {
      const message = 'Notification SMS content is missing.';

      await this.markFailed(notification.id, message);

      return {
        notificationId: notification.id,

        status: 'FAILED',

        providerMessageId: null,

        recipient: notification.recipient,

        errorMessage: message,
      };
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
      const result = await this.smsService.send(
        notification.recipient,
        metadata.smsText,
      );

      if (!result.success) {
        throw new Error(
          result.message || "Africa's Talking did not accept the SMS.",
        );
      }

      await this.prisma.notification.update({
        where: {
          id: notification.id,
        },

        data: {
          status: 'SENT',

          sentAt: new Date(),

          providerMessageId: result.messageId,

          errorMessage: null,

          failedAt: null,

          metadata: {
            ...metadata,

            providerStatus: result.status ?? '',

            providerCost: result.cost ?? '',
          },
        },
      });

      return {
        notificationId: notification.id,

        status: 'SENT',

        providerMessageId: result.messageId,

        recipient: notification.recipient,

        errorMessage: null,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown SMS delivery error.';

      await this.markFailed(notification.id, message);

      this.logger.error(
        `SMS notification ${notification.id} failed: ${message}`,
      );

      return {
        notificationId: notification.id,

        status: 'FAILED',

        providerMessageId: null,

        recipient: notification.recipient,

        errorMessage: message,
      };
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

    const results: {
      email: NotificationSendResult | null;

      sms: NotificationSendResult | null;
    } = {
      email: null,
      sms: null,
    };

    const emailRecipient = member.email ?? member.user?.email ?? null;

    if (emailRecipient) {
      const emailNotification = await this.createNotification({
        organizationId: member.organizationId,

        memberId: member.id,

        userId: member.userId ?? undefined,

        type: 'MIGRATION_WELCOME',

        channel: 'EMAIL',

        recipient: emailRecipient,

        subject: template.subject,

        templateKey: 'migration-welcome',

        metadata: {
          emailHtml: template.html,

          emailText: template.text,

          memberNumber: member.memberNumber,

          category: member.category,
        },
      });

      const emailResult = await this.sendNotification(emailNotification.id);

      results.email = emailResult
        ? {
            notificationId: emailResult.id,

            status: emailResult.status === 'SENT' ? 'SENT' : 'FAILED',

            providerMessageId: emailResult.providerMessageId,

            recipient: emailRecipient,

            errorMessage: emailResult.errorMessage ?? null,
          }
        : {
            notificationId: emailNotification.id,

            status: 'FAILED',

            providerMessageId: null,

            recipient: emailRecipient,

            errorMessage: 'Email delivery failed.',
          };
    }

    if (member.phone) {
      const smsText = `KUHRSA: Your membership has been migrated successfully. Member No: ${member.memberNumber}. Activate your account: ${activationUrl}`;

      const smsNotification = await this.createNotification({
        organizationId: member.organizationId,

        memberId: member.id,

        userId: member.userId ?? undefined,

        type: 'MIGRATION_WELCOME',

        channel: 'SMS',

        recipient: member.phone,

        subject: 'KUHRSA Membership Migration',

        templateKey: 'migration-welcome-sms',

        metadata: {
          smsText,

          memberNumber: member.memberNumber,

          category: member.category,
        },
      });

      results.sms = await this.sendSmsNotification(smsNotification.id);
    }

    return {
      memberId: member.id,

      memberNumber: member.memberNumber,

      email: results.email,

      sms: results.sms,
    };
  }

  async sendMigrationWelcomeSmsOnly(
    memberId: string,
  ): Promise<NotificationSendResult> {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
    });

    if (!member) {
      throw new Error('Member not found.');
    }

    if (!member.phone) {
      throw new Error(
        `Member ${member.memberNumber} does not have a phone number.`,
      );
    }

    const activationUrl = `${this.getApplicationUrl()}/activate-membership?member=${encodeURIComponent(
      member.memberNumber,
    )}`;

    const smsText = `KUHRSA: Your membership has been migrated successfully. Member No: ${member.memberNumber}. Activate your account: ${activationUrl}`;

    const notification = await this.createNotification({
      organizationId: member.organizationId,

      memberId: member.id,

      userId: member.userId ?? undefined,

      type: 'MIGRATION_WELCOME',

      channel: 'SMS',

      recipient: member.phone,

      subject: 'KUHRSA Membership Migration',

      templateKey: 'migration-welcome-sms',

      metadata: {
        smsText,

        memberNumber: member.memberNumber,

        category: member.category,
      },
    });

    return this.sendSmsNotification(notification.id);
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

    if (notification.channel === 'EMAIL') {
      const result = await this.sendNotification(notification.id);

      if (!result) {
        return null;
      }

      return result;
    }

    if (notification.channel === 'SMS') {
      return this.sendSmsNotification(notification.id);
    }

    throw new Error(
      `Notification channel ${notification.channel} is not supported for retry yet.`,
    );
  }
}
