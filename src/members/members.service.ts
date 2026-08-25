import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            isSystemOwner: true,
          },
        },
      },
    });

    return members.map((member) =>
      this.toSafeMember(member),
    );
  }

  async findOne(id: string, organizationId: string) {
    const member = await this.prisma.member.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            isSystemOwner: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    return this.toSafeMember(member);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateMemberDto,
  ) {
    const memberNumber = dto.memberNumber.trim();

    const existingMember =
      await this.prisma.member.findUnique({
        where: {
          memberNumber,
        },
      });

    if (existingMember) {
      throw new ConflictException(
        'A member with this member number already exists.',
      );
    }

    let linkedUserId: string | undefined;

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();

      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          member: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(
          'No user exists with the supplied email.',
        );
      }

      if (user.member) {
        throw new ConflictException(
          'This user is already linked to a member record.',
        );
      }

      linkedUserId = user.id;
    }

    const createdMember =
      await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: {
            organizationId,
            memberNumber,
            userId: linkedUserId,
          },
          include: {
            organization: true,
            user: {
              select: {
                id: true,
                email: true,
                status: true,
                isSystemOwner: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'CREATE',
            entityType: 'Member',
            entityId: member.id,
            newValue: {
              memberNumber: member.memberNumber,
              status: member.status,
              userId: member.userId,
            },
          },
        });

        return member;
      });

    return this.toSafeMember(createdMember);
  }

  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateMemberDto,
  ) {
    const existingMember =
      await this.prisma.member.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          user: true,
        },
      });

    if (!existingMember) {
      throw new NotFoundException('Member not found.');
    }

    if (existingMember.user?.isSystemOwner) {
      throw new ForbiddenException(
        'The System Owner membership cannot be modified through ordinary member management.',
      );
    }

    let memberNumber: string | undefined;

    if (dto.memberNumber !== undefined) {
      memberNumber = dto.memberNumber.trim();

      if (
        memberNumber !== existingMember.memberNumber
      ) {
        const duplicate =
          await this.prisma.member.findUnique({
            where: {
              memberNumber,
            },
          });

        if (duplicate && duplicate.id !== id) {
          throw new ConflictException(
            'A member with this member number already exists.',
          );
        }
      }
    }

    let newUserId: string | undefined;

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();

      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          member: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(
          'No user exists with the supplied email.',
        );
      }

      if (
        user.member &&
        user.member.id !== existingMember.id
      ) {
        throw new ConflictException(
          'This user is already linked to another member record.',
        );
      }

      newUserId = user.id;
    }

    const oldValue = {
      memberNumber: existingMember.memberNumber,
      status: existingMember.status,
      userId: existingMember.userId,
    };

    const updatedMember =
      await this.prisma.$transaction(async (tx) => {
        const data: {
          memberNumber?: string;
          userId?: string;
        } = {};

        if (memberNumber !== undefined) {
          data.memberNumber = memberNumber;
        }

        if (newUserId !== undefined) {
          data.userId = newUserId;
        }

        const member = await tx.member.update({
          where: {
            id,
          },
          data,
          include: {
            organization: true,
            user: {
              select: {
                id: true,
                email: true,
                status: true,
                isSystemOwner: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'UPDATE',
            entityType: 'Member',
            entityId: member.id,
            oldValue,
            newValue: {
              memberNumber: member.memberNumber,
              status: member.status,
              userId: member.userId,
            },
          },
        });

        return member;
      });

    return this.toSafeMember(updatedMember);
  }

  async approve(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    return this.changeStatus(
      id,
      organizationId,
      actorUserId,
      'ACTIVE',
      'APPROVE',
    );
  }

  async activate(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    return this.changeStatus(
      id,
      organizationId,
      actorUserId,
      'ACTIVE',
      'ACTIVATE',
    );
  }

  async suspend(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    return this.changeStatus(
      id,
      organizationId,
      actorUserId,
      'SUSPENDED',
      'SUSPEND',
    );
  }

  private async changeStatus(
    id: string,
    organizationId: string,
    actorUserId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    action: 'APPROVE' | 'ACTIVATE' | 'SUSPEND',
  ) {
    const existingMember =
      await this.prisma.member.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          user: true,
        },
      });

    if (!existingMember) {
      throw new NotFoundException('Member not found.');
    }

    if (existingMember.user?.isSystemOwner) {
      throw new ForbiddenException(
        'The System Owner membership status cannot be changed through ordinary member management.',
      );
    }

    const oldStatus = existingMember.status;

    if (
      action === 'APPROVE' &&
      oldStatus !== 'PENDING'
    ) {
      throw new ConflictException(
        'Only pending members can be approved.',
      );
    }

    const updatedMember =
      await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.update({
          where: {
            id,
          },
          data: {
            status,
          },
          include: {
            organization: true,
            user: {
              select: {
                id: true,
                email: true,
                status: true,
                isSystemOwner: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action,
            entityType: 'Member',
            entityId: member.id,
            oldValue: {
              status: oldStatus,
            },
            newValue: {
              status: member.status,
            },
          },
        });

        return member;
      });

    return this.toSafeMember(updatedMember);
  }

  private toSafeMember(member: any) {
    return {
      id: member.id,
      organizationId: member.organizationId,
      memberNumber: member.memberNumber,
      status: member.status,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,

      organization: member.organization
        ? {
            id: member.organization.id,
            name: member.organization.name,
            code: member.organization.code,
          }
        : null,

      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            status: member.user.status,
            isSystemOwner: member.user.isSystemOwner,
          }
        : null,
    };
  }
}