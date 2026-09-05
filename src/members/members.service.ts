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
import { LinkMemberAccountDto } from './dto/link-member-account.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberNumberService } from './member-number.service';

interface SafeMemberRecord {
  id: string;
  organizationId: string;
  category: MemberCategory;

  registrationNumber?: string | null;
  admissionNumber?: string | null;
  memberNumber: string;

  yearOfStudy?: number | null;
  graduationYear?: number | null;
  nationalId?: string | null;
  staffNumber?: string | null;
  position?: string | null;

  programme?: string | null;
  faculty?: string | null;
  department?: string | null;

  email?: string | null;
  phone?: string | null;
  address?: string | null;
  county?: string | null;

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
    firstName: string | null;
    lastName: string | null;
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
            firstName: true,
            lastName: true,
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
            firstName: true,
            lastName: true,
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

    const nationalId = dto.nationalId?.trim() || undefined;

    const staffNumber = dto.staffNumber?.trim() || undefined;

    const email = dto.email?.toLowerCase().trim();

    const source = sourceOverride ?? dto.source ?? MemberSource.REGISTRATION;

    if (!email) {
      throw new ConflictException(
        'An email address is required when creating a member through this endpoint.',
      );
    }

    if (registrationNumber) {
      const existingRegistration = await this.prisma.member.findUnique({
        where: {
          registrationNumber,
        },
      });

      if (existingRegistration) {
        throw new ConflictException({
          code: 'MEMBER_IDENTIFIER_IN_USE',
          message:
            'A member with this registration/admission number already exists.',
        });
      }
    }

    if (nationalId) {
      const existingNationalId = await this.prisma.member.findUnique({
        where: {
          nationalId,
        },
      });

      if (existingNationalId) {
        throw new ConflictException({
          code: 'NATIONAL_ID_IN_USE',
          message: 'A member with this National ID already exists.',
        });
      }
    }

    if (staffNumber) {
      const existingStaffNumber = await this.prisma.member.findUnique({
        where: {
          staffNumber,
        },
      });

      if (existingStaffNumber) {
        throw new ConflictException({
          code: 'STAFF_NUMBER_IN_USE',
          message: 'A member with this staff/employee number already exists.',
        });
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

            yearOfStudy:
              category === MemberCategory.STUDENT ? dto.yearOfStudy : null,

            graduationYear:
              category === MemberCategory.ALUMNI ? dto.graduationYear : null,

            nationalId: category === MemberCategory.ALUMNI ? nationalId : null,

            staffNumber:
              category === MemberCategory.LECTURER ? staffNumber : null,

            position:
              category === MemberCategory.LECTURER
                ? dto.position?.trim() || null
                : null,

            programme:
              category === MemberCategory.STUDENT ||
              category === MemberCategory.ALUMNI
                ? dto.programme?.trim() || null
                : null,

            faculty: dto.faculty.trim(),

            department: dto.department.trim(),

            email,

            phone: dto.phone?.trim() || null,

            address: dto.address?.trim() || null,

            county: dto.county?.trim() || null,

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
                firstName: true,
                lastName: true,
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
              yearOfStudy: member.yearOfStudy,
              graduationYear: member.graduationYear,
              nationalId: member.nationalId ? '[PROTECTED]' : null,
              staffNumber: member.staffNumber,
              position: member.position,
              programme: member.programme,
              faculty: member.faculty,
              department: member.department,
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

    const updatedMember = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
                firstName: true,
                lastName: true,
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
      },
    );

    return this.toSafeMember(updatedMember);
  }

  async linkAccount(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: LinkMemberAccountDto,
  ) {
    const member = await this.prisma.member.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    if (member.userId) {
      throw new ConflictException({
        code: 'MEMBER_ACCOUNT_ALREADY_LINKED',
        message: 'This member is already linked to a user account.',
      });
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new ConflictException({
        code: 'INVALID_MEMBER_SOURCE',
        message:
          'Account linking through this endpoint is only available for migrated members.',
      });
    }

    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        member: true,
      },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_IN_USE',
        message: existingUser.member
          ? 'This email is already linked to another KUHRSA member.'
          : 'This email is already associated with a KUHRSA account.',
      });
    }

    const migrationRow = await this.prisma.migrationBatchRow.findFirst({
      where: {
        memberId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    const firstName = migrationRow?.firstName?.trim() || 'KUHRSA';

    const lastName = migrationRow?.lastName?.trim() || 'Member';

    const temporaryPassword = randomBytes(32).toString('hex');

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const activationToken = randomBytes(32).toString('hex');

    const tokenHash = await bcrypt.hash(activationToken, 12);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            organizationId,
            firstName,
            lastName,
            email,
            passwordHash,
            status: UserStatus.INACTIVE,
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

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: memberRole.id,
            assignedBy: actorUserId,
          },
        });

        const updatedMember = await tx.member.update({
          where: {
            id: member.id,
          },
          data: {
            userId: user.id,
            email,
            activationStatus: MemberActivationStatus.PENDING,
          },
          include: {
            organization: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                isSystemOwner: true,
              },
            },
          },
        });

        await tx.memberActivation.upsert({
          where: {
            memberId: member.id,
          },
          create: {
            memberId: member.id,
            tokenHash,
            expiresAt,
          },
          update: {
            tokenHash,
            expiresAt,
            usedAt: null,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'UPDATE',
            entityType: 'Member',
            entityId: member.id,
            oldValue: {
              memberNumber: member.memberNumber,
              userId: null,
              email: member.email,
              activationStatus: member.activationStatus,
            },
            newValue: {
              memberNumber: updatedMember.memberNumber,
              userId: user.id,
              email,
              activationStatus: updatedMember.activationStatus,
            },
          },
        });

        return {
          member: updatedMember,
          activationToken,
        };
      },
    );

    return {
      message: 'User account linked to the migrated member successfully.',
      member: this.toSafeMember(result.member),
      activationToken: result.activationToken,
      activationExpiresAt: expiresAt,
    };
  }

  async lookupActivationEligibility(
    identifier: string,
    email: string,
    phone: string,
  ) {
    const normalizedIdentifier = identifier.trim();

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedPhone = phone.trim();

    const member = await this.prisma.member.findFirst({
      where: {
        OR: [
          {
            memberNumber: normalizedIdentifier.toUpperCase(),
          },
          {
            registrationNumber: normalizedIdentifier,
          },
        ],
      },
      include: {
        user: true,
      },
    });

    if (!member || !member.user) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'No matching KUHRSA membership record was found.',
      });
    }

    const storedEmail = member.user.email.trim().toLowerCase();

    const storedPhone = member.phone?.trim() ?? '';

    if (storedEmail !== normalizedEmail || storedPhone !== normalizedPhone) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'No matching KUHRSA membership record was found.',
      });
    }

    if (
      member.activationStatus === MemberActivationStatus.COMPLETED ||
      member.user.status === UserStatus.ACTIVE
    ) {
      return {
        exists: true,
        eligible: false,
        code: 'ALREADY_ACTIVE',
        message: 'Your KUHRSA account is already active. Please log in.',
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          category: member.category,
          registrationNumber: member.registrationNumber,
          admissionNumber: member.admissionNumber,
          activationStatus: member.activationStatus,
        },
      };
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      return {
        exists: true,
        eligible: false,
        code: 'ACTIVATION_NOT_AVAILABLE',
        message:
          'This KUHRSA membership is not currently eligible for activation.',
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          category: member.category,
          registrationNumber: member.registrationNumber,
          admissionNumber: member.admissionNumber,
          activationStatus: member.activationStatus,
        },
      };
    }

    if (member.activationStatus !== MemberActivationStatus.PENDING) {
      return {
        exists: true,
        eligible: false,
        code: 'ACTIVATION_NOT_AVAILABLE',
        message:
          'This KUHRSA membership is not currently eligible for activation.',
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          category: member.category,
          registrationNumber: member.registrationNumber,
          admissionNumber: member.admissionNumber,
          activationStatus: member.activationStatus,
        },
      };
    }

    const activationToken = randomBytes(32).toString('hex');

    const tokenHash = await bcrypt.hash(activationToken, 12);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.memberActivation.upsert({
        where: {
          memberId: member.id,
        },
        create: {
          memberId: member.id,
          tokenHash,
          expiresAt,
        },
        update: {
          tokenHash,
          expiresAt,
          usedAt: null,
        },
      });

      await tx.member.update({
        where: {
          id: member.id,
        },
        data: {
          activationStatus: MemberActivationStatus.PENDING,
        },
      });
    });

    return {
      exists: true,
      eligible: true,
      code: 'ELIGIBLE',
      message: 'KUHRSA membership record found. You may continue.',
      activationToken,
      activationExpiresAt: expiresAt,
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        category: member.category,
        registrationNumber: member.registrationNumber,
        admissionNumber: member.admissionNumber,
        activationStatus: MemberActivationStatus.PENDING,
      },
    };
  }

  async resendActivation(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const member = await this.prisma.member.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new ConflictException({
        code: 'INVALID_MEMBER_SOURCE',
        message: 'Activation resend is only available for migrated members.',
      });
    }

    if (!member.user) {
      throw new ConflictException({
        code: 'MEMBER_ACCOUNT_NOT_LINKED',
        message:
          'This member does not have a linked user account. Link the account first.',
      });
    }

    if (
      member.activationStatus === MemberActivationStatus.COMPLETED ||
      member.user.status === UserStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVE',
        message:
          'This member account is already active. No activation resend is required.',
      });
    }

    const activationToken = randomBytes(32).toString('hex');

    const tokenHash = await bcrypt.hash(activationToken, 12);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const activation = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const activation = await tx.memberActivation.upsert({
          where: {
            memberId: member.id,
          },
          create: {
            memberId: member.id,
            tokenHash,
            expiresAt,
          },
          update: {
            tokenHash,
            expiresAt,
            usedAt: null,
          },
        });

        await tx.member.update({
          where: {
            id: member.id,
          },
          data: {
            activationStatus: MemberActivationStatus.PENDING,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'UPDATE',
            entityType: 'MemberActivation',
            entityId: member.id,
            oldValue: {
              memberNumber: member.memberNumber,
              activationStatus: member.activationStatus,
            },
            newValue: {
              memberNumber: member.memberNumber,
              activationStatus: MemberActivationStatus.PENDING,
              activationExpiresAt: expiresAt,
            },
          },
        });

        return activation;
      },
    );

    return {
      message: 'A new membership activation link has been generated.',
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        category: member.category,
        email: member.user.email,
        activationStatus: MemberActivationStatus.PENDING,
      },
      activationToken,
      activationExpiresAt: activation.expiresAt,
    };
  }

  async verifyActivation(
    token: string,
    memberNumber: string,
    firstName: string,
    lastName: string,
    email: string,
  ) {
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
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message:
          'We could not find a valid KUHRSA membership activation request.',
      });
    }

    const member = matchedActivation.member;

    if (!member.user) {
      throw new ConflictException({
        code: 'MEMBER_ACCOUNT_NOT_LINKED',
        message:
          'This KUHRSA membership has not yet been linked to a user account.',
      });
    }

    if (
      member.activationStatus === MemberActivationStatus.COMPLETED ||
      member.user.status === UserStatus.ACTIVE
    ) {
      return {
        verified: false,
        code: 'ALREADY_ACTIVE',
        message: 'Your KUHRSA account is already active. Please log in.',
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          category: member.category,
          activationStatus: member.activationStatus,
        },
      };
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new ConflictException({
        code: 'ACTIVATION_NOT_AVAILABLE',
        message: 'This activation flow is only available for migrated members.',
      });
    }

    if (member.activationStatus !== MemberActivationStatus.PENDING) {
      throw new ConflictException({
        code: 'ACTIVATION_NOT_AVAILABLE',
        message:
          'This KUHRSA membership is not currently eligible for activation.',
      });
    }

    const storedFirstName = member.user.firstName?.trim().toLowerCase() ?? '';

    const storedLastName = member.user.lastName?.trim().toLowerCase() ?? '';

    const suppliedFirstName = firstName.trim().toLowerCase();

    const suppliedLastName = lastName.trim().toLowerCase();

    const storedEmail = member.user.email?.trim().toLowerCase() ?? '';

    const suppliedEmail = email.trim().toLowerCase();

    const memberNumberMatches =
      member.memberNumber.trim().toLowerCase() ===
      memberNumber.trim().toLowerCase();

    const firstNameMatches = storedFirstName === suppliedFirstName;

    const lastNameMatches = storedLastName === suppliedLastName;

    const emailMatches =
      storedEmail.length > 0 && storedEmail === suppliedEmail;

    if (
      !memberNumberMatches ||
      !firstNameMatches ||
      !lastNameMatches ||
      !emailMatches
    ) {
      throw new ConflictException({
        code: 'VERIFICATION_FAILED',
        message:
          'The details provided do not match the KUHRSA membership record.',
      });
    }

    return {
      verified: true,
      code: 'VERIFIED',
      message:
        'Membership details verified successfully. You may now create your password.',
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        category: member.category,
        activationStatus: member.activationStatus,
      },
    };
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
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'This activation link is invalid or has expired.',
      });
    }

    const member = matchedActivation.member;

    if (!member.user) {
      throw new ConflictException({
        code: 'MEMBER_ACCOUNT_NOT_LINKED',
        message: 'This membership is not yet linked to a KUHRSA account.',
      });
    }

    if (
      member.activationStatus === MemberActivationStatus.COMPLETED ||
      member.user.status === UserStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVE',
        message: 'Your KUHRSA account is already active. Please log in.',
      });
    }

    if (
      member.source !== MemberSource.MIGRATION_IMPORT &&
      member.source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new ConflictException({
        code: 'ACTIVATION_NOT_AVAILABLE',
        message:
          'This KUHRSA membership is not currently eligible for activation.',
      });
    }

    if (member.activationStatus !== MemberActivationStatus.PENDING) {
      throw new ConflictException({
        code: 'ACTIVATION_NOT_AVAILABLE',
        message:
          'This KUHRSA membership is not currently eligible for activation.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const activated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
                firstName: true,
                lastName: true,
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
      },
    );

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

    const updatedMember = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
                firstName: true,
                lastName: true,
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
      },
    );

    return this.toSafeMember(updatedMember);
  }

  private toSafeMember(member: SafeMemberRecord) {
    return {
      id: member.id,

      organizationId: member.organizationId,

      category: member.category,

      registrationNumber: member.registrationNumber ?? null,

      admissionNumber: member.admissionNumber ?? null,

      memberNumber: member.memberNumber,

      yearOfStudy: member.yearOfStudy ?? null,

      graduationYear: member.graduationYear ?? null,

      nationalId: member.nationalId ?? null,

      staffNumber: member.staffNumber ?? null,

      position: member.position ?? null,

      programme: member.programme ?? null,

      faculty: member.faculty ?? null,

      department: member.department ?? null,

      email: member.email ?? null,

      phone: member.phone ?? null,

      address: member.address ?? null,

      county: member.county ?? null,

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

            firstName: member.user.firstName ?? null,

            lastName: member.user.lastName ?? null,

            email: member.user.email,

            status: member.user.status,

            isSystemOwner: member.user.isSystemOwner,
          }
        : null,
    };
  }
}
