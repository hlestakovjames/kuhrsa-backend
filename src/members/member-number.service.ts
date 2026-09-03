import { BadRequestException, Injectable } from '@nestjs/common';
import { MemberCategory, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORY_PREFIX: Record<MemberCategory, string> = {
  STUDENT: 'STD',
  ALUMNI: 'ALU',
  LECTURER: 'LCT',
};

@Injectable()
export class MemberNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    category: MemberCategory,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = CATEGORY_PREFIX[category];

    if (!prefix) {
      throw new BadRequestException('Invalid member category.');
    }

    const client = tx ?? this.prisma;

    const sequence = await client.memberNumberSequence.update({
      where: {
        category,
      },
      data: {
        currentNumber: {
          increment: 1,
        },
      },
      select: {
        currentNumber: true,
      },
    });

    return `KUHRSA-${prefix}-${sequence.currentNumber
      .toString()
      .padStart(4, '0')}`;
  }
}
