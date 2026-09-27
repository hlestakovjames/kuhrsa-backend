import { Injectable } from '@nestjs/common';
import {
  ChargeStatus,
  MemberActivationStatus,
  MemberCategory,
  MemberStatus,
  NotificationStatus,
  PaymentStatus,
  PositionAssignmentStatus,
  PositionStatus,
  TermStatus,
  UserStatus,
} from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberDashboard(
    organizationId: string,
    userId: string,
    email: string,
  ) {
    const member = await this.prisma.member.findFirst({
      where: {
        organizationId,
        userId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        membershipPeriods: {
          orderBy: {
            startsAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            membershipYear: true,
            startsAt: true,
            endsAt: true,
            status: true,
            activatedAt: true,
          },
        },
      },
    });

    return {
      portal: 'member',
      user: {
        id: userId,
        email,
      },
      member: member
        ? {
            id: member.id,
            memberNumber: member.memberNumber,
            category: member.category,
            constitutionalCategory:
              member.constitutionalCategory,
            status: member.status,
            activationStatus:
              member.activationStatus,
            goodStandingStatus:
              member.goodStandingStatus,
            financialStatus:
              member.financialStatus,
            disciplinaryStatus:
              member.disciplinaryStatus,
            registrationNumber:
              member.registrationNumber,
            admissionNumber:
              member.admissionNumber,
            nationalId:
              member.nationalId,
            staffNumber:
              member.staffNumber,
            position:
              member.position,
            yearOfStudy:
              member.yearOfStudy,
            graduationYear:
              member.graduationYear,
            programme:
              member.programme,
            faculty:
              member.faculty,
            department:
              member.department,
            email:
              member.email,
            phone:
              member.phone,
            address:
              member.address,
            county:
              member.county,
            source:
              member.source,
            organization:
              member.organization,
            membershipPeriod:
              member.membershipPeriods[0]
                ? {
                    id:
                      member.membershipPeriods[0].id,
                    membershipYear:
                      member.membershipPeriods[0]
                        .membershipYear,
                    startsAt:
                      member.membershipPeriods[0]
                        .startsAt,
                    endsAt:
                      member.membershipPeriods[0]
                        .endsAt,
                    status:
                      member.membershipPeriods[0]
                        .status,
                    activatedAt:
                      member.membershipPeriods[0]
                        .activatedAt,
                  }
                : null,
          }
        : null,
    };
  }

  async getAdministrationDashboardSummary(
    organizationId: string,
  ) {
    const [
      membershipSummary,
      usersSummary,
      governanceSummary,
      financeSummary,
      notificationSummary,
      recentAuditLogs,
    ] = await Promise.all([
      this.getAdministrationMembershipSummary(
        organizationId,
      ),

      this.getAdministrationUsersSummary(
        organizationId,
      ),

      this.getAdministrationGovernanceSummary(
        organizationId,
      ),

      this.getAdministrationFinanceSummary(
        organizationId,
      ),

      this.getAdministrationNotificationSummary(
        organizationId,
      ),

      this.prisma.auditLog.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          reason: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const alerts = [
      ...(membershipSummary.pendingMembers > 0
        ? [
            {
              level: 'Review',
              key: 'pending-members',
              title: 'Pending membership records',
              detail: `${membershipSummary.pendingMembers} member record${
                membershipSummary.pendingMembers === 1
                  ? ''
                  : 's'
              } require review.`,
              count:
                membershipSummary.pendingMembers,
            },
          ]
        : []),

      ...(membershipSummary.activationPending > 0
        ? [
            {
              level: 'Attention',
              key: 'activation-pending',
              title: 'Membership activation pending',
              detail: `${membershipSummary.activationPending} member activation${
                membershipSummary.activationPending === 1
                  ? ''
                  : 's'
              } are pending.`,
              count:
                membershipSummary.activationPending,
            },
          ]
        : []),

      ...(financeSummary.overdueCharges > 0
        ? [
            {
              level: 'Attention',
              key: 'overdue-charges',
              title: 'Overdue member charges',
              detail: `${financeSummary.overdueCharges} charge${
                financeSummary.overdueCharges === 1
                  ? ''
                  : 's'
              } are overdue.`,
              count:
                financeSummary.overdueCharges,
            },
          ]
        : []),

      ...(financeSummary.pendingPayments > 0
        ? [
            {
              level: 'Review',
              key: 'pending-payments',
              title: 'Pending payments',
              detail: `${financeSummary.pendingPayments} payment${
                financeSummary.pendingPayments === 1
                  ? ''
                  : 's'
              } are awaiting completion.`,
              count:
                financeSummary.pendingPayments,
            },
          ]
        : []),

      ...(notificationSummary.failed > 0
        ? [
            {
              level: 'Attention',
              key: 'failed-notifications',
              title: 'Failed notifications',
              detail: `${notificationSummary.failed} notification${
                notificationSummary.failed === 1
                  ? ''
                  : 's'
              } failed to send.`,
              count:
                notificationSummary.failed,
            },
          ]
        : []),
    ];

    return {
      portal: 'administration',

      membership: membershipSummary,

      users: usersSummary,

      governance: governanceSummary,

      finance: financeSummary,

      notifications: notificationSummary,

      audit: {
        recent: recentAuditLogs,
      },

      alerts,

      availability: {
        events: false,
        activities: false,
        requests: false,
        analytics: false,
      },
    };
  }

  async getAdministrationUsersSummary(
    organizationId: string,
  ) {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      lockedUsers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.ACTIVE,
        },
      }),

      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.INACTIVE,
        },
      }),

      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.SUSPENDED,
        },
      }),

      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.LOCKED,
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      lockedUsers,
    };
  }

  async getAdministrationGovernanceSummary(
    organizationId: string,
  ) {
    const [
      totalPositions,
      activePositions,
      totalAssignments,
      activeAssignments,
      pendingAssignments,
      activeTerms,
    ] = await Promise.all([
      this.prisma.position.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.position.count({
        where: {
          organizationId,
          status: PositionStatus.ACTIVE,
        },
      }),

      this.prisma.positionAssignment.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.positionAssignment.count({
        where: {
          organizationId,
          status:
            PositionAssignmentStatus.ACTIVE,
        },
      }),

      this.prisma.positionAssignment.count({
        where: {
          organizationId,
          status:
            PositionAssignmentStatus.PENDING,
        },
      }),

      this.prisma.term.count({
        where: {
          organizationId,
          status: TermStatus.ACTIVE,
        },
      }),
    ]);

    return {
      totalPositions,
      activePositions,
      totalAssignments,
      activeAssignments,
      pendingAssignments,
      activeTerms,
    };
  }

  async getAdministrationFinanceSummary(
    organizationId: string,
  ) {
    const [
      outstandingCharges,
      overdueCharges,
      completedPayments,
      pendingPayments,
      failedPayments,
      cancelledPayments,
    ] = await Promise.all([
      this.prisma.memberCharge.aggregate({
        where: {
          organizationId,
          status: {
            in: [
              ChargeStatus.UNPAID,
              ChargeStatus.PARTIALLY_PAID,
              ChargeStatus.OVERDUE,
            ],
          },
        },
        _sum: {
          balance: true,
        },
      }),

      this.prisma.memberCharge.count({
        where: {
          organizationId,
          status: ChargeStatus.OVERDUE,
        },
      }),

      this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.payment.count({
        where: {
          organizationId,
          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
            ],
          },
        },
      }),

      this.prisma.payment.count({
        where: {
          organizationId,
          status: PaymentStatus.FAILED,
        },
      }),

      this.prisma.payment.count({
        where: {
          organizationId,
          status: PaymentStatus.CANCELLED,
        },
      }),
    ]);

    return {
      outstandingBalance:
        outstandingCharges._sum.balance?.toString() ??
        '0.00',

      completedPaymentsAmount:
        completedPayments._sum.amount?.toString() ??
        '0.00',

      overdueCharges,

      pendingPayments,

      failedPayments,

      cancelledPayments,
    };
  }

  async getAdministrationNotificationSummary(
    organizationId: string,
  ) {
    const [
      total,
      pending,
      sent,
      failed,
      cancelled,
    ] = await Promise.all([
      this.prisma.notification.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.notification.count({
        where: {
          organizationId,
          status:
            NotificationStatus.PENDING,
        },
      }),

      this.prisma.notification.count({
        where: {
          organizationId,
          status:
            NotificationStatus.SENT,
        },
      }),

      this.prisma.notification.count({
        where: {
          organizationId,
          status:
            NotificationStatus.FAILED,
        },
      }),

      this.prisma.notification.count({
        where: {
          organizationId,
          status:
            NotificationStatus.CANCELLED,
        },
      }),
    ]);

    return {
      total,
      pending,
      sent,
      failed,
      cancelled,
    };
  }

  async getAdministrationMembershipSummary(
    organizationId: string,
  ) {
    const [
      totalMembers,
      activeMembers,
      pendingMembers,
      inactiveMembers,
      suspendedMembers,
      archivedMembers,
      students,
      alumni,
      lecturers,
      activationPending,
      activationCompleted,
      activationExpired,
    ] = await Promise.all([
      this.prisma.member.count({
        where: {
          organizationId,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          status: MemberStatus.ACTIVE,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          status: MemberStatus.PENDING,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          status: MemberStatus.INACTIVE,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          status: MemberStatus.SUSPENDED,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          status: MemberStatus.ARCHIVED,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          category: MemberCategory.STUDENT,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          category: MemberCategory.ALUMNI,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          category: MemberCategory.LECTURER,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          activationStatus:
            MemberActivationStatus.PENDING,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          activationStatus:
            MemberActivationStatus.COMPLETED,
        },
      }),

      this.prisma.member.count({
        where: {
          organizationId,
          activationStatus:
            MemberActivationStatus.EXPIRED,
        },
      }),
    ]);

    return {
      totalMembers,
      activeMembers,
      pendingMembers,
      inactiveMembers,
      suspendedMembers,
      archivedMembers,
      students,
      alumni,
      lecturers,
      activationPending,
      activationCompleted,
      activationExpired,
    };
  }
}
