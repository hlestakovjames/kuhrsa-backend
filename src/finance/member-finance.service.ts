import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemberFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyFinance(organizationId: string, userId: string) {
    const member = await this.prisma.member.findFirst({
      where: { organizationId, userId },
      select: {
        id: true,
        memberNumber: true,
        registrationNumber: true,
        category: true,
        status: true,
        financialStatus: true,
      },
    });

    if (!member) {
      throw new NotFoundException('No member record is linked to this account.');
    }

    const [membershipPeriods, charges, payments, receipts] = await Promise.all([
      this.prisma.membershipPeriod.findMany({
        where: { organizationId, memberId: member.id },
        orderBy: { startsAt: 'desc' },
        select: {
          id: true,
          membershipYear: true,
          startsAt: true,
          endsAt: true,
          status: true,
          activatedAt: true,
        },
      }),
      this.prisma.memberCharge.findMany({
        where: { organizationId, memberId: member.id },
        orderBy: { createdAt: 'desc' },
        include: {
          feeSchedule: {
            include: {
              feeDefinition: {
                select: { code: true, name: true, type: true },
              },
            },
          },
          membershipPeriod: {
            select: { id: true, membershipYear: true, startsAt: true, endsAt: true },
          },
          allocations: {
            include: {
              payment: {
                select: { id: true, method: true, status: true, reference: true, paidAt: true, createdAt: true },
              },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, memberId: member.id },
        orderBy: { createdAt: 'desc' },
        include: {
          allocations: {
            include: {
              charge: {
                select: { id: true, description: true, amountDue: true, currency: true },
              },
            },
          },
          receipt: {
            select: { id: true, receiptNumber: true, status: true, issuedAt: true },
          },
        },
      }),
      this.prisma.receipt.findMany({
        where: { organizationId, memberId: member.id },
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          amount: true,
          currency: true,
          issuedAt: true,
          voidedAt: true,
          voidReason: true,
          payment: {
            select: { id: true, reference: true, method: true, status: true, paidAt: true },
          },
        },
      }),
    ]);

    const eligibleCharges = charges.filter(
      (charge) => !['WAIVED', 'CANCELLED'].includes(charge.status),
    );
    const totalCharged = eligibleCharges.reduce(
      (total, charge) => total + Number(charge.amountDue),
      0,
    );
    const allocatedPaid = eligibleCharges.reduce(
      (total, charge) => total + Number(charge.amountPaid),
      0,
    );
    const outstandingBalance = eligibleCharges.reduce(
      (total, charge) => total + Number(charge.balance),
      0,
    );
    const completedPaymentsAmount = payments
      .filter((payment) => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status))
      .reduce((total, payment) => total + Number(payment.amount), 0);

    return {
      member,
      membershipPeriods,
      charges,
      payments,
      receipts,
      summary: {
        currency: 'KES',
        totalCharged,
        allocatedPaid,
        outstandingBalance,
        completedPaymentsAmount,
        unallocatedCompletedPayments: Math.max(0, completedPaymentsAmount - allocatedPaid),
      },
    };
  }
}
