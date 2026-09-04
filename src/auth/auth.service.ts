import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { MemberCategory } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MemberNumberService } from '../members/member-number.service';
import { UsersService } from '../users/users.service';

import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly memberNumberService: MemberNumberService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is not active. Please contact an administrator.',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const refreshedUser = await this.usersService.findById(user.id);

    if (!refreshedUser) {
      throw new UnauthorizedException('Unable to load your account.');
    }

    const accessToken = this.jwtService.sign({
      sub: refreshedUser.id,
      organizationId: refreshedUser.organizationId,
      isSystemOwner: refreshedUser.isSystemOwner,
    });

    return {
      accessToken,
      user: refreshedUser,
    };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = this.normalizePhone(dto.phone);

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    /*
     * ------------------------------------------------------------
     * GLOBAL EMAIL CHECK
     * ------------------------------------------------------------
     */

    const existingUserByEmail = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUserByEmail) {
      throw new ConflictException({
        code: 'EMAIL_IN_USE',
        message:
          'This email address is already associated with a KUHRSA account.',
      });
    }

    const existingMemberByEmail = await this.prisma.member.findFirst({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingMemberByEmail) {
      throw new ConflictException({
        code: 'EMAIL_IN_USE',
        message:
          'This email address is already associated with a KUHRSA member.',
      });
    }

    /*
     * ------------------------------------------------------------
     * GLOBAL PHONE CHECK
     * ------------------------------------------------------------
     */

    const existingUserByPhone = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
      },
    });

    if (existingUserByPhone) {
      throw new ConflictException({
        code: 'PHONE_IN_USE',
        message:
          'This phone number is already associated with a KUHRSA account.',
      });
    }

    const existingMemberByPhone = await this.prisma.member.findFirst({
      where: {
        phone: normalizedPhone,
      },
    });

    if (existingMemberByPhone) {
      throw new ConflictException({
        code: 'PHONE_IN_USE',
        message:
          'This phone number is already associated with a KUHRSA member.',
      });
    }

    /*
     * ------------------------------------------------------------
     * CATEGORY-SPECIFIC VALUES
     * ------------------------------------------------------------
     */

    const registrationNumber = dto.registrationNumber?.trim() || null;
    const nationalId = dto.nationalId?.trim() || null;
    const staffNumber = dto.staffNumber?.trim() || null;

    /*
     * ------------------------------------------------------------
     * REGISTRATION / ADMISSION NUMBER CHECK
     * ------------------------------------------------------------
     *
     * Required for Student.
     * Optional for Alumni.
     * Not used for Lecturer.
     */

    if (
      dto.category === MemberCategory.STUDENT ||
      (dto.category === MemberCategory.ALUMNI && registrationNumber)
    ) {
      const existingRegistrationNumber = registrationNumber
        ? await this.prisma.member.findUnique({
            where: {
              registrationNumber,
            },
          })
        : null;

      if (existingRegistrationNumber) {
        throw new ConflictException({
          code: 'MEMBER_IDENTIFIER_IN_USE',
          message:
            'This university registration/admission number is already associated with a KUHRSA member.',
        });
      }
    }

    /*
     * ------------------------------------------------------------
     * NATIONAL ID CHECK
     * ------------------------------------------------------------
     *
     * Alumni only.
     */

    if (dto.category === MemberCategory.ALUMNI) {
      const existingNationalId = nationalId
        ? await this.prisma.member.findUnique({
            where: {
              nationalId,
            },
          })
        : null;

      if (existingNationalId) {
        throw new ConflictException({
          code: 'NATIONAL_ID_IN_USE',
          message:
            'This National ID is already associated with a KUHRSA member. Please use member activation or contact an administrator.',
        });
      }
    }

    /*
     * ------------------------------------------------------------
     * STAFF NUMBER CHECK
     * ------------------------------------------------------------
     *
     * Lecturer only.
     */

    if (dto.category === MemberCategory.LECTURER) {
      const existingStaffNumber = staffNumber
        ? await this.prisma.member.findUnique({
            where: {
              staffNumber,
            },
          })
        : null;

      if (existingStaffNumber) {
        throw new ConflictException({
          code: 'STAFF_NUMBER_IN_USE',
          message:
            'This staff/employee number is already associated with a KUHRSA member.',
        });
      }
    }

    /*
     * ------------------------------------------------------------
     * CATEGORY FIELD RULES
     * ------------------------------------------------------------
     */

    if (
      dto.category === MemberCategory.STUDENT &&
      (dto.yearOfStudy === undefined ||
        dto.yearOfStudy < 1 ||
        dto.yearOfStudy > 4)
    ) {
      throw new ConflictException({
        code: 'INVALID_YEAR_OF_STUDY',
        message: 'Student year of study must be between Year 1 and Year 4.',
      });
    }

    if (
      dto.category === MemberCategory.ALUMNI &&
      (dto.graduationYear === undefined ||
        dto.graduationYear < 1900 ||
        dto.graduationYear > new Date().getFullYear())
    ) {
      throw new ConflictException({
        code: 'INVALID_GRADUATION_YEAR',
        message: 'Please provide a valid graduation year.',
      });
    }

    /*
     * ------------------------------------------------------------
     * ORGANIZATION
     * ------------------------------------------------------------
     */

    const organization = await this.prisma.organization.findFirst();

    if (!organization) {
      throw new ConflictException(
        'KUHRSA organization has not been configured.',
      );
    }

    /*
     * ------------------------------------------------------------
     * MEMBER ROLE
     * ------------------------------------------------------------
     */

    const memberRole = await this.prisma.role.findFirst({
      where: {
        organizationId: organization.id,
        code: 'MEMBER',
      },
    });

    if (!memberRole) {
      throw new ConflictException(
        'KUHRSA member role has not been configured.',
      );
    }

    /*
     * ------------------------------------------------------------
     * MEMBERSHIP YEAR
     * SEPTEMBER -> AUGUST
     * ------------------------------------------------------------
     */

    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const membershipStartYear =
      currentMonth >= 8 ? currentYear : currentYear - 1;

    const membershipYear = `${membershipStartYear}/${membershipStartYear + 1}`;

    const startsAt = new Date(membershipStartYear, 8, 1, 0, 0, 0, 0);

    const endsAt = new Date(membershipStartYear + 1, 7, 31, 23, 59, 59, 999);

    /*
     * ------------------------------------------------------------
     * PASSWORD
     * ------------------------------------------------------------
     */

    const passwordHash = await bcrypt.hash(dto.password, 10);

    /*
     * ------------------------------------------------------------
     * REGISTRATION TRANSACTION
     * ------------------------------------------------------------
     *
     * Membership number generation happens INSIDE the transaction.
     * If registration fails, the sequence increment rolls back too.
     *
     * STUDENT  -> KUHRSA-STD-xxxx
     * ALUMNI   -> KUHRSA-ALU-xxxx
     * LECTURER -> KUHRSA-LCT-xxxx
     */

    const result = await this.prisma.$transaction(async (tx) => {
      const memberNumber = await this.memberNumberService.generate(
        dto.category,
        tx,
      );

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          firstName,
          lastName,
          phone: normalizedPhone,
          email: normalizedEmail,
          passwordHash,
          status: 'INACTIVE',
          isSystemOwner: false,
        },
      });

      const member = await tx.member.create({
        data: {
          organizationId: organization.id,
          userId: user.id,

          category: dto.category,

          registrationNumber,
          admissionNumber: null,
          memberNumber,

          yearOfStudy:
            dto.category === MemberCategory.STUDENT ? dto.yearOfStudy : null,

          graduationYear:
            dto.category === MemberCategory.ALUMNI ? dto.graduationYear : null,

          nationalId:
            dto.category === MemberCategory.ALUMNI ? nationalId : null,

          staffNumber:
            dto.category === MemberCategory.LECTURER ? staffNumber : null,

          position:
            dto.category === MemberCategory.LECTURER
              ? dto.position?.trim() || null
              : null,

          programme:
            dto.category === MemberCategory.STUDENT ||
            dto.category === MemberCategory.ALUMNI
              ? dto.programme?.trim() || null
              : null,

          faculty: dto.faculty.trim(),
          department: dto.department.trim(),

          email: normalizedEmail,
          phone: normalizedPhone,
          address: dto.address?.trim() || null,
          county: dto.county?.trim() || null,

          status: 'PENDING',
          source: 'REGISTRATION',
          activationStatus: 'NOT_REQUIRED',
        },
      });

      const membershipPeriod = await tx.membershipPeriod.create({
        data: {
          memberId: member.id,
          organizationId: organization.id,
          membershipYear,
          startsAt,
          endsAt,
          status: 'PENDING',
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: memberRole.id,
        },
      });

      return {
        user,
        member,
        membershipPeriod,
      };
    });

    /*
     * ------------------------------------------------------------
     * PAYMENT OBLIGATION
     * ------------------------------------------------------------
     *
     * Actual Finance / M-Pesa integration comes later.
     */

    return {
      message:
        'Registration submitted successfully. Your account is pending activation.',

      user: {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone,
        status: result.user.status,
      },

      member: {
        id: result.member.id,
        memberNumber: result.member.memberNumber,
        category: result.member.category,
        registrationNumber: result.member.registrationNumber,
        yearOfStudy: result.member.yearOfStudy,
        graduationYear: result.member.graduationYear,
        staffNumber: result.member.staffNumber,
        position: result.member.position,
        programme: result.member.programme,
        faculty: result.member.faculty,
        department: result.member.department,
        status: result.member.status,
        source: result.member.source,
        activationStatus: result.member.activationStatus,
      },

      membership: {
        membershipYear: result.membershipPeriod.membershipYear,
        startsAt: result.membershipPeriod.startsAt,
        endsAt: result.membershipPeriod.endsAt,
        status: result.membershipPeriod.status,
      },

      payment: {
        required: true,
        registrationFee: 250,
        annualMembershipFee: 200,
        total: 450,
        status: 'PENDING',
      },
    };
  }

  private normalizePhone(phone: string): string {
    const value = phone.trim().replace(/\s+/g, '');

    if (/^07\d{8}$/.test(value)) {
      return `+254${value.substring(1)}`;
    }

    if (/^01\d{8}$/.test(value)) {
      return `+254${value.substring(1)}`;
    }

    if (/^254\d{9}$/.test(value)) {
      return `+${value}`;
    }

    return value;
  }
}
