import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberActivationStatus,
  MemberCategory,
  MemberSource,
  Prisma,
  UserStatus,
} from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberNumberService } from './member-number.service';

interface SafeMemberRecord {
  id: string;
  organizationId: string;
  category: MemberCategory;
  registrationNumber?: string | null;
  memberNumber: string;
  status: string;
  source: MemberSource;
  activationStatus: MemberActivationStatus;
  createdAt: Date;
  updatedAt: Date;

  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;

  user?: {
    id: string;
    email: string;
    status: string;
    isSystemOwner: boolean;
  } | null;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberNumberService: MemberNumberService,
  ) {}

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

    return members.map((member) => this.toSafeMember(member));
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
    sourceOverride?: MemberSource,
  ) {
    const category = dto.category;

    const registrationNumber = dto.registrationNumber?.trim() || undefined;

    const email = dto.email.toLowerCase().trim();

    const source = sourceOverride ?? dto.source ?? MemberSource.REGISTRATION;

    if (registrationNumber) {
      const existingRegistration = await this.prisma.member.findUnique({
        where: {
          registrationNumber,
        },
      });

      if (existingRegistration) {
        throw new ConflictException(
          'A member with this registration number already exists.',
        );
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        member: {
          select: {
            id: true,
          },
        },
      },
    });

    if (existingUser && existingUser.organizationId !== organizationId) {
      throw new ConflictException(
        'The supplied email belongs to a user in another organization.',
      );
    }

    if (existingUser?.member) {
      throw new ConflictException(
        'This user is already linked to a member record.',
      );
    }

    const createdMember = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const memberNumber = await this.memberNumberService.generate(
          category,
          tx,
        );

        let userId = existingUser?.id;

        if (!userId) {
          const temporaryPassword = randomBytes(32).toString('hex');

          const passwordHash = await bcrypt.hash(temporaryPassword, 12);

          const user = await tx.user.create({
            data: {
              organizationId,

              firstName: dto.firstName.trim(),

              lastName: dto.lastName.trim(),

              email,

              passwordHash,

              status:
                source === MemberSource.REGISTRATION
                  ? UserStatus.ACTIVE
                  : UserStatus.INACTIVE,
            },
          });

          userId = user.id;
        } else {
          await tx.user.update({
            where: {
              id: userId,
            },
            data: {
              firstName: dto.firstName.trim(),

              lastName: dto.lastName.trim(),
            },
          });
        }

        const member = await tx.member.create({
          data: {
            organizationId,
            category,
            registrationNumber,
            memberNumber,
            userId,
            source,

            activationStatus:
              source === MemberSource.REGISTRATION
                ? MemberActivationStatus.NOT_REQUIRED
                : MemberActivationStatus.PENDING,
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

        const memberRole = await tx.role.findUnique({
          where: {
            organizationId_code: {
              organizationId,
              code: 'MEMBER',
            },
          },
        });

        if (!memberRole) {
          throw new NotFoundException('Default MEMBER role is not configured.');
        }

        const existingUserRole = await tx.userRole.findUnique({
          where: {
            userId_roleId: {
              userId,
              roleId: memberRole.id,
            },
          },
        });

        if (!existingUserRole) {
          await tx.userRole.create({
            data: {
              userId,
              roleId: memberRole.id,
              assignedBy: actorUserId,
            },
          });
        }

        if (source !== MemberSource.REGISTRATION) {
          const token = randomBytes(32).toString('hex');

          const tokenHash = await bcrypt.hash(token, 12);

          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await tx.memberActivation.create({
            data: {
              memberId: member.id,
              tokenHash,
              expiresAt,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'CREATE',
            entityType: 'Member',
            entityId: member.id,

            newValue: {
              category: member.category,

              registrationNumber: member.registrationNumber,

              memberNumber: member.memberNumber,

              status: member.status,

              source: member.source,

              activationStatus: member.activationStatus,

              userId: member.userId,
            },
          },
        });

        return member;
      },
    );

    return this.toSafeMember(createdMember);
  }

  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateMemberDto,
  ) {
    const existingMember = await this.prisma.member.findFirst({
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

    let registrationNumber: string | undefined;

    if (dto.registrationNumber !== undefined) {
      registrationNumber = dto.registrationNumber.trim();

      if (registrationNumber !== existingMember.registrationNumber) {
        const duplicate = await this.prisma.member.findUnique({
          where: {
            registrationNumber,
          },
        });

        if (duplicate && duplicate.id !== id) {
          throw new ConflictException(
            'A member with this registration number already exists.',
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
        throw new NotFoundException('No user exists with the supplied email.');
      }

      if (user.member && user.member.id !== existingMember.id) {
        throw new ConflictException(
          'This user is already linked to another member record.',
        );
      }

      newUserId = user.id;
    }

    const oldValue = {
      category: existingMember.category,

      registrationNumber: existingMember.registrationNumber,

      memberNumber: existingMember.memberNumber,

      status: existingMember.status,

      userId: existingMember.userId,
    };

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const data: {
        registrationNumber?: string;
        userId?: string;
      } = {};

      if (registrationNumber !== undefined) {
        data.registrationNumber = registrationNumber;
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
            category: member.category,

            registrationNumber: member.registrationNumber,

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

  async activateByToken(token: string, password: string) {
    const now = new Date();

    const activations = await this.prisma.memberActivation.findMany({
      where: {
        usedAt: null,

        expiresAt: {
          gt: now,
        },
      },

      include: {
        member: {
          include: {
            user: true,
            organization: true,
          },
        },
      },
    });

    let matchedActivation: (typeof activations)[number] | null = null;

    for (const activation of activations) {
      const matches = await bcrypt.compare(token, activation.tokenHash);

      if (matches) {
        matchedActivation = activation;
        break;
      }
    }

    if (!matchedActivation) {
      throw new NotFoundException(
        'This activation link is invalid or has expired.',
      );
    }

    const member = matchedActivation.member;

    if (!member.user) {
      throw new ConflictException(
        'This member is not linked to a user account.',
      );
    }

    if (member.activationStatus === MemberActivationStatus.COMPLETED) {
      throw new ConflictException(
        'This membership has already been activated.',
      );
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new ConflictException(
        'This activation flow is only available for migrated members.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const activated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: member.user!.id,
        },

        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });

      const updatedMember = await tx.member.update({
        where: {
          id: member.id,
        },

        data: {
          activationStatus: MemberActivationStatus.COMPLETED,
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

      await tx.memberActivation.update({
        where: {
          id: matchedActivation.id,
        },

        data: {
          usedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: member.organizationId,

          actorUserId: member.user?.id,

          action: 'ACTIVATE',

          entityType: 'MemberActivation',

          entityId: member.id,

          newValue: {
            memberId: member.id,

            memberNumber: member.memberNumber,

            userId: user.id,

            activationStatus: MemberActivationStatus.COMPLETED,
          },
        },
      });

      return updatedMember;
    });

    return {
      message: 'Membership activation completed successfully.',

      member: this.toSafeMember(activated),
    };
  }

  async approve(id: string, organizationId: string, actorUserId: string) {
    return this.changeStatus(
      id,
      organizationId,
      actorUserId,
      'ACTIVE',
      'APPROVE',
    );
  }

  async activate(id: string, organizationId: string, actorUserId: string) {
    return this.changeStatus(
      id,
      organizationId,
      actorUserId,
      'ACTIVE',
      'ACTIVATE',
    );
  }

  async suspend(id: string, organizationId: string, actorUserId: string) {
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
    const existingMember = await this.prisma.member.findFirst({
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

    if (action === 'APPROVE' && oldStatus !== 'PENDING') {
      throw new ConflictException('Only pending members can be approved.');
    }

    const updatedMember = await this.prisma.$transaction(async (tx) => {
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
            category: member.category,

            memberNumber: member.memberNumber,

            status: oldStatus,
          },

          newValue: {
            category: member.category,

            memberNumber: member.memberNumber,

            status: member.status,
          },
        },
      });

      return member;
    });

    return this.toSafeMember(updatedMember);
  }

  private toSafeMember(member: SafeMemberRecord) {
    return {
      id: member.id,

      organizationId: member.organizationId,

      category: member.category,

      registrationNumber: member.registrationNumber ?? null,

      memberNumber: member.memberNumber,

      status: member.status,

      source: member.source,

      activationStatus: member.activationStatus,

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
