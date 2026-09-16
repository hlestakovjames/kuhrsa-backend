import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentStatus,
  ReceiptStatus,
} from '../../../generated/prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateReceiptDto } from './dto/create-receipt.dto';
import { VoidReceiptDto } from './dto/void-receipt.dto';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    memberId?: string,
  ) {
    return this.prisma.receipt.findMany({
      where: {
        organizationId,
        ...(memberId !== undefined && {
          memberId,
        }),
      },
      orderBy: {
        issuedAt: 'desc',
      },
      include: {
        member: true,
        payment: {
          include: {
            allocations: {
              include: {
                charge: {
                  include: {
                    feeSchedule: {
                      include: {
                        feeDefinition: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ) {
    const receipt =
      await this.prisma.receipt.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          member: true,
          payment: {
            include: {
              allocations: {
                include: {
                  charge: {
                    include: {
                      feeSchedule: {
                        include: {
                          feeDefinition: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!receipt) {
      throw new NotFoundException(
        'Receipt not found.',
      );
    }

    return receipt;
  }

  async create(
    organizationId: string,
    dto: CreateReceiptDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment =
        await tx.payment.findFirst({
          where: {
            id: dto.paymentId,
            organizationId,
          },
          include: {
            receipt: true,
            allocations: {
              include: {
                charge: true,
              },
            },
            member: true,
          },
        });

      if (!payment) {
        throw new NotFoundException(
          'Payment not found.',
        );
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          'A receipt can only be issued for a completed payment.',
        );
      }

      if (Number(payment.amount) <= 0) {
        throw new BadRequestException(
          'A receipt cannot be issued for a zero-value payment.',
        );
      }

      if (payment.receipt) {
        throw new ConflictException(
          'A receipt has already been issued for this payment.',
        );
      }

      const receiptNumber =
        await this.generateReceiptNumber(
          tx,
          organizationId,
        );

      return tx.receipt.create({
        data: {
          organizationId,
          memberId: payment.memberId,
          paymentId: payment.id,
          receiptNumber,
          status: ReceiptStatus.ISSUED,
          amount: payment.amount,
          currency: payment.currency,
        },
        include: {
          member: true,
          payment: {
            include: {
              allocations: {
                include: {
                  charge: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async void(
    organizationId: string,
    id: string,
    dto: VoidReceiptDto,
    userId: string,
  ) {
    const receipt = await this.findOne(
      organizationId,
      id,
    );

    if (receipt.status === ReceiptStatus.VOIDED) {
      return receipt;
    }

    const reason = dto.reason.trim();

    if (!reason) {
      throw new BadRequestException(
        'A reason is required when voiding a receipt.',
      );
    }

    return this.prisma.receipt.update({
      where: {
        id: receipt.id,
      },
      data: {
        status: ReceiptStatus.VOIDED,
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      },
      include: {
        member: true,
        payment: true,
      },
    });
  }

  private async generateReceiptNumber(
    tx: Parameters<
      Parameters<PrismaService['$transaction']>[0]
    >[0],
    organizationId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 5; attempt++) {
      const random =
        Math.floor(
          100000 + Math.random() * 900000,
        );

      const receiptNumber =
        `KUHRSA-${year}-${random}`;

      const existing =
        await tx.receipt.findFirst({
          where: {
            organizationId,
            receiptNumber,
          },
          select: {
            id: true,
          },
        });

      if (!existing) {
        return receiptNumber;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique receipt number. Please try again.',
    );
  }
}
