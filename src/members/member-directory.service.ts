import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemberDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const members = await this.prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        memberNumber: true,
        category: true,
        yearOfStudy: true,
        programme: true,
        faculty: true,
        department: true,
        position: true,
        email: true,
        status: true,
        activationStatus: true,
        user: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    return members;
  }
}
