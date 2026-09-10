import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PositionAssignmentStatus,
  PositionStatus,
  Prisma,
  TermStatus,
} from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreatePositionAssignmentDto } from './dto/create-position-assignment.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdatePositionAssignmentDto } from './dto/update-position-assignment.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateTermDto } from './dto/update-term.dto';

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyGovernance(userId: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
        member: {
          select: {
            id: true,
            memberNumber: true,
            registrationNumber: true,
            admissionNumber: true,
            category: true,
            yearOfStudy: true,
            graduationYear: true,
            programme: true,
            faculty: true,
            department: true,
            status: true,
          },
        },
        userRoles: {
          where: {
            revokedAt: null,
            startsAt: {
              lte: new Date(),
            },
            OR: [
              {
                endsAt: null,
              },
              {
                endsAt: {
                  gt: new Date(),
                },
              },
            ],
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
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

    if (!user) {
      throw new NotFoundException('Authenticated user was not found.');
    }

    const now = new Date();

    const assignments = user.member
      ? await this.prisma.positionAssignment.findMany({
          where: {
            organizationId,
            memberId: user.member.id,
            status: 'ACTIVE',
            startsAt: {
              lte: now,
            },
            endsAt: {
              gt: now,
            },
          },
          orderBy: [
            {
              startsAt: 'desc',
            },
            {
              createdAt: 'desc',
            },
          ],
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            assignedAt: true,
            endedAt: true,
            revokedAt: true,
            notes: true,
            position: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                status: true,
                isExecutive: true,
              },
            },
            term: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
                startsAt: true,
                endsAt: true,
              },
            },
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const effectiveRoles = user.userRoles.map((userRole) => ({
      id: userRole.role.id,
      code: userRole.role.code,
      name: userRole.role.name,
      startsAt: userRole.startsAt,
      endsAt: userRole.endsAt,
    }));

    const effectivePermissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions
            .map((rolePermission) => rolePermission.permission?.code)
            .filter((code): code is string => Boolean(code)),
        ),
      ),
    ).sort();

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      member: user.member
        ? {
            id: user.member.id,
            memberNumber: user.member.memberNumber,
            registrationNumber: user.member.registrationNumber,
            admissionNumber: user.member.admissionNumber,
            category: user.member.category,
            yearOfStudy: user.member.yearOfStudy,
            graduationYear: user.member.graduationYear,
            programme: user.member.programme,
            faculty: user.member.faculty,
            department: user.member.department,
            status: user.member.status,
          }
        : null,
      governance: {
        hasActiveAssignment: assignments.length > 0,
        assignments: assignments.map((assignment) => ({
          id: assignment.id,
          status: assignment.status,
          startsAt: assignment.startsAt,
          endsAt: assignment.endsAt,
          assignedAt: assignment.assignedAt,
          endedAt: assignment.endedAt,
          revokedAt: assignment.revokedAt,
          notes: assignment.notes,
          position: assignment.position,
          term: assignment.term,
          roles: assignment.roles.map(({ role }) => role),
        })),
      },
      access: {
        roles: effectiveRoles,
        permissions: effectivePermissions,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // POSITIONS
  // ---------------------------------------------------------------------------

  async findAllPositions(organizationId: string) {
    return this.prisma.position.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          isExecutive: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async findOnePosition(id: string, organizationId: string) {
    const position = await this.prisma.position.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        assignments: {
          orderBy: {
            startsAt: 'desc',
          },
          select: {
            id: true,
            memberId: true,
            termId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            assignedAt: true,
            endedAt: true,
            revokedAt: true,
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundException('Governance position not found.');
    }

    return position;
  }

  async createPosition(
    organizationId: string,
    actorUserId: string,
    dto: CreatePositionDto,
  ) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const description = dto.description?.trim() || null;
    const isExecutive = dto.isExecutive ?? true;

    const existingPosition = await this.prisma.position.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existingPosition) {
      throw new ConflictException({
        code: 'POSITION_CODE_IN_USE',
        message:
          'A governance position with this code already exists in this organization.',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const position = await tx.position.create({
        data: {
          organizationId,
          name,
          code,
          description,
          isExecutive,
          status: PositionStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'Position',
          entityId: position.id,
          newValue: {
            name: position.name,
            code: position.code,
            description: position.description,
            isExecutive: position.isExecutive,
            status: position.status,
          },
        },
      });

      return position;
    });
  }

  async updatePosition(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdatePositionDto,
  ) {
    const existingPosition = await this.prisma.position.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingPosition) {
      throw new NotFoundException('Governance position not found.');
    }

    const data: Prisma.PositionUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();

      if (code !== existingPosition.code) {
        const duplicate = await this.prisma.position.findUnique({
          where: {
            organizationId_code: {
              organizationId,
              code,
            },
          },
        });

        if (duplicate && duplicate.id !== id) {
          throw new ConflictException({
            code: 'POSITION_CODE_IN_USE',
            message:
              'A governance position with this code already exists in this organization.',
          });
        }
      }

      data.code = code;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.isExecutive !== undefined) {
      data.isExecutive = dto.isExecutive;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return existingPosition;
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedPosition = await tx.position.update({
        where: {
          id,
        },
        data,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'Position',
          entityId: updatedPosition.id,
          oldValue: {
            name: existingPosition.name,
            code: existingPosition.code,
            description: existingPosition.description,
            isExecutive: existingPosition.isExecutive,
            status: existingPosition.status,
          },
          newValue: {
            name: updatedPosition.name,
            code: updatedPosition.code,
            description: updatedPosition.description,
            isExecutive: updatedPosition.isExecutive,
            status: updatedPosition.status,
          },
        },
      });

      return updatedPosition;
    });
  }

  // ---------------------------------------------------------------------------
  // TERMS
  // ---------------------------------------------------------------------------

  async findAllTerms(organizationId: string) {
    return this.prisma.term.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          startsAt: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async findOneTerm(id: string, organizationId: string) {
    const term = await this.prisma.term.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        assignments: {
          orderBy: {
            startsAt: 'desc',
          },
          select: {
            id: true,
            memberId: true,
            positionId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            assignedAt: true,
            endedAt: true,
            revokedAt: true,
          },
        },
      },
    });

    if (!term) {
      throw new NotFoundException('Leadership term not found.');
    }

    return term;
  }

  async createTerm(
    organizationId: string,
    actorUserId: string,
    dto: CreateTermDto,
  ) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new ConflictException({
        code: 'INVALID_TERM_RANGE',
        message: 'Term end date must be after the term start date.',
      });
    }

    const existingTerm = await this.prisma.term.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existingTerm) {
      throw new ConflictException({
        code: 'TERM_CODE_IN_USE',
        message:
          'A leadership term with this code already exists in this organization.',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const term = await tx.term.create({
        data: {
          organizationId,
          name,
          code,
          startsAt,
          endsAt,
          status: TermStatus.DRAFT,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'Term',
          entityId: term.id,
          newValue: {
            name: term.name,
            code: term.code,
            startsAt: term.startsAt.toISOString(),
            endsAt: term.endsAt.toISOString(),
            status: term.status,
          },
        },
      });

      return term;
    });
  }

  async updateTerm(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateTermDto,
  ) {
    const existingTerm = await this.prisma.term.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingTerm) {
      throw new NotFoundException('Leadership term not found.');
    }

    const data: Prisma.TermUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();

      if (code !== existingTerm.code) {
        const duplicate = await this.prisma.term.findUnique({
          where: {
            organizationId_code: {
              organizationId,
              code,
            },
          },
        });

        if (duplicate && duplicate.id !== id) {
          throw new ConflictException({
            code: 'TERM_CODE_IN_USE',
            message:
              'A leadership term with this code already exists in this organization.',
          });
        }
      }

      data.code = code;
    }

    const nextStartsAt =
      dto.startsAt !== undefined
        ? new Date(dto.startsAt)
        : existingTerm.startsAt;

    const nextEndsAt =
      dto.endsAt !== undefined ? new Date(dto.endsAt) : existingTerm.endsAt;

    if (dto.startsAt !== undefined || dto.endsAt !== undefined) {
      if (nextEndsAt <= nextStartsAt) {
        throw new ConflictException({
          code: 'INVALID_TERM_RANGE',
          message: 'Term end date must be after the term start date.',
        });
      }

      if (dto.startsAt !== undefined) {
        data.startsAt = nextStartsAt;
      }

      if (dto.endsAt !== undefined) {
        data.endsAt = nextEndsAt;
      }
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (Object.keys(data).length === 0) {
      return existingTerm;
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedTerm = await tx.term.update({
        where: {
          id,
        },
        data,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'Term',
          entityId: updatedTerm.id,
          oldValue: {
            name: existingTerm.name,
            code: existingTerm.code,
            startsAt: existingTerm.startsAt.toISOString(),
            endsAt: existingTerm.endsAt.toISOString(),
            status: existingTerm.status,
          },
          newValue: {
            name: updatedTerm.name,
            code: updatedTerm.code,
            startsAt: updatedTerm.startsAt.toISOString(),
            endsAt: updatedTerm.endsAt.toISOString(),
            status: updatedTerm.status,
          },
        },
      });

      return updatedTerm;
    });
  }

  // ---------------------------------------------------------------------------
  // POSITION ASSIGNMENTS
  // ---------------------------------------------------------------------------

  async findAllAssignments(organizationId: string) {
    return this.prisma.positionAssignment.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          startsAt: 'desc',
        },
        {
          assignedAt: 'desc',
        },
      ],
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            email: true,
            phone: true,
          },
        },
        position: {
          select: {
            id: true,
            name: true,
            code: true,
            isExecutive: true,
            status: true,
          },
        },
        term: {
          select: {
            id: true,
            name: true,
            code: true,
            startsAt: true,
            endsAt: true,
            status: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });
  }

  async findOneAssignment(id: string, organizationId: string) {
    const assignment = await this.prisma.positionAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            email: true,
            phone: true,
          },
        },
        position: true,
        term: true,
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Position assignment not found.');
    }

    return assignment;
  }

  async createPositionAssignment(
    organizationId: string,
    actorUserId: string,
    dto: CreatePositionAssignmentDto,
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new ConflictException({
        code: 'INVALID_ASSIGNMENT_RANGE',
        message: 'Assignment end date must be after the assignment start date.',
      });
    }

    const [member, position, term] = await Promise.all([
      this.prisma.member.findFirst({
        where: {
          id: dto.memberId,
          organizationId,
        },
        select: {
          id: true,
          memberNumber: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.position.findFirst({
        where: {
          id: dto.positionId,
          organizationId,
        },
      }),
      this.prisma.term.findFirst({
        where: {
          id: dto.termId,
          organizationId,
        },
      }),
    ]);

    if (!member) {
      throw new NotFoundException('KUHRSA member not found.');
    }

    if (!position) {
      throw new NotFoundException('Governance position not found.');
    }

    if (!term) {
      throw new NotFoundException('Leadership term not found.');
    }

    if (position.status !== PositionStatus.ACTIVE) {
      throw new ConflictException({
        code: 'POSITION_NOT_ACTIVE',
        message: 'Only an active governance position can receive assignments.',
      });
    }

    if (
      term.status === TermStatus.COMPLETED ||
      term.status === TermStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: 'TERM_NOT_ASSIGNABLE',
        message:
          'A completed or cancelled leadership term cannot receive new assignments.',
      });
    }

    if (startsAt < term.startsAt || endsAt > term.endsAt) {
      throw new ConflictException({
        code: 'ASSIGNMENT_OUTSIDE_TERM',
        message: 'The assignment dates must fall within the leadership term.',
      });
    }

    const roleIds = [...new Set(dto.roleIds ?? [])];

    if (roleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: {
          organizationId,
          id: {
            in: roleIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (roles.length !== roleIds.length) {
        throw new NotFoundException(
          'One or more management roles were not found in this organization.',
        );
      }
    }

    const conflictingPositionAssignment =
      await this.prisma.positionAssignment.findFirst({
        where: {
          organizationId,
          positionId: dto.positionId,
          termId: dto.termId,
          status: {
            in: [
              PositionAssignmentStatus.PENDING,
              PositionAssignmentStatus.ACTIVE,
            ],
          },
          startsAt: {
            lt: endsAt,
          },
          endsAt: {
            gt: startsAt,
          },
        },
      });

    if (conflictingPositionAssignment) {
      throw new ConflictException({
        code: 'POSITION_ALREADY_ASSIGNED',
        message:
          'This position already has a pending or active assignment during the selected period.',
      });
    }

    if (position.isExecutive) {
      const conflictingMemberAssignment =
        await this.prisma.positionAssignment.findFirst({
          where: {
            organizationId,
            memberId: dto.memberId,
            termId: dto.termId,
            status: {
              in: [
                PositionAssignmentStatus.PENDING,
                PositionAssignmentStatus.ACTIVE,
              ],
            },
            position: {
              isExecutive: true,
            },
            startsAt: {
              lt: endsAt,
            },
            endsAt: {
              gt: startsAt,
            },
          },
        });

      if (conflictingMemberAssignment) {
        throw new ConflictException({
          code: 'MEMBER_ALREADY_ASSIGNED',
          message:
            'This member already has a pending or active executive position during the selected period.',
        });
      }
    }

    const notes = dto.notes?.trim() || null;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const assignment = await tx.positionAssignment.create({
        data: {
          organizationId,
          memberId: dto.memberId,
          positionId: dto.positionId,
          termId: dto.termId,
          status: PositionAssignmentStatus.PENDING,
          startsAt,
          endsAt,
          assignedBy: actorUserId,
          notes,
          roles:
            roleIds.length > 0
              ? {
                  create: roleIds.map((roleId) => ({
                    roleId,
                    assignedBy: actorUserId,
                  })),
                }
              : undefined,
        },
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          position: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          term: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'PositionAssignment',
          entityId: assignment.id,
          newValue: {
            memberId: assignment.memberId,
            positionId: assignment.positionId,
            termId: assignment.termId,
            status: assignment.status,
            startsAt: assignment.startsAt.toISOString(),
            endsAt: assignment.endsAt.toISOString(),
            roleIds,
            notes: assignment.notes,
          },
        },
      });

      return assignment;
    });
  }

  async updatePositionAssignment(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdatePositionAssignmentDto,
  ) {
    const existingAssignment = await this.prisma.positionAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        position: true,
        term: true,
      },
    });

    if (!existingAssignment) {
      throw new NotFoundException('Position assignment not found.');
    }

    if (existingAssignment.status !== PositionAssignmentStatus.PENDING) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_EDITABLE',
        message:
          'Only pending position assignments can be edited. End or revoke an active assignment instead.',
      });
    }

    const startsAt =
      dto.startsAt !== undefined
        ? new Date(dto.startsAt)
        : existingAssignment.startsAt;

    const endsAt =
      dto.endsAt !== undefined
        ? new Date(dto.endsAt)
        : existingAssignment.endsAt;

    if (endsAt <= startsAt) {
      throw new ConflictException({
        code: 'INVALID_ASSIGNMENT_RANGE',
        message: 'Assignment end date must be after the assignment start date.',
      });
    }

    if (
      startsAt < existingAssignment.term.startsAt ||
      endsAt > existingAssignment.term.endsAt
    ) {
      throw new ConflictException({
        code: 'ASSIGNMENT_OUTSIDE_TERM',
        message: 'The assignment dates must fall within the leadership term.',
      });
    }

    const data: Prisma.PositionAssignmentUpdateInput = {};

    if (dto.startsAt !== undefined) {
      data.startsAt = startsAt;
    }

    if (dto.endsAt !== undefined) {
      data.endsAt = endsAt;
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes.trim() || null;
    }

    if (dto.roleIds !== undefined) {
      const roleIds = [...new Set(dto.roleIds)];

      const roles = await this.prisma.role.findMany({
        where: {
          organizationId,
          id: {
            in: roleIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (roles.length !== roleIds.length) {
        throw new NotFoundException(
          'One or more management roles were not found in this organization.',
        );
      }

      data.roles = {
        deleteMany: {},
        create: roleIds.map((roleId) => ({
          roleId,
          assignedBy: actorUserId,
        })),
      };
    }

    const overlappingAssignment =
      await this.prisma.positionAssignment.findFirst({
        where: {
          organizationId,
          id: {
            not: id,
          },
          positionId: existingAssignment.positionId,
          termId: existingAssignment.termId,
          status: {
            in: [
              PositionAssignmentStatus.PENDING,
              PositionAssignmentStatus.ACTIVE,
            ],
          },
          startsAt: {
            lt: endsAt,
          },
          endsAt: {
            gt: startsAt,
          },
        },
      });

    if (overlappingAssignment) {
      throw new ConflictException({
        code: 'POSITION_ALREADY_ASSIGNED',
        message:
          'This position already has another pending or active assignment during the selected period.',
      });
    }

    if (Object.keys(data).length === 0) {
      return this.findOneAssignment(id, organizationId);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedAssignment = await tx.positionAssignment.update({
        where: {
          id,
        },
        data,
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          position: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          term: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'PositionAssignment',
          entityId: updatedAssignment.id,
          oldValue: {
            startsAt: existingAssignment.startsAt.toISOString(),
            endsAt: existingAssignment.endsAt.toISOString(),
            notes: existingAssignment.notes,
            status: existingAssignment.status,
          },
          newValue: {
            startsAt: updatedAssignment.startsAt.toISOString(),
            endsAt: updatedAssignment.endsAt.toISOString(),
            notes: updatedAssignment.notes,
            status: updatedAssignment.status,
            roleIds: updatedAssignment.roles.map(
              (assignmentRole) => assignmentRole.roleId,
            ),
          },
        },
      });

      return updatedAssignment;
    });
  }

  async activatePositionAssignment(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const assignment = await this.prisma.positionAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        position: true,
        term: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Position assignment not found.');
    }

    if (assignment.status !== PositionAssignmentStatus.PENDING) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_PENDING',
        message: 'Only a pending position assignment can be activated.',
      });
    }

    if (assignment.position.status !== PositionStatus.ACTIVE) {
      throw new ConflictException({
        code: 'POSITION_NOT_ACTIVE',
        message: 'The assigned governance position is not active.',
      });
    }

    if (assignment.term.status !== TermStatus.ACTIVE) {
      throw new ConflictException({
        code: 'TERM_NOT_ACTIVE',
        message:
          'The leadership term must be ACTIVE before an assignment can be activated.',
      });
    }

    const now = new Date();

    if (now < assignment.startsAt) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_STARTED',
        message:
          'This assignment cannot be activated before its scheduled start date.',
      });
    }

    if (now >= assignment.endsAt) {
      throw new ConflictException({
        code: 'ASSIGNMENT_EXPIRED',
        message: 'This assignment has already passed its end date.',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedAssignment = await tx.positionAssignment.update({
        where: {
          id,
        },
        data: {
          status: PositionAssignmentStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'PositionAssignment',
          entityId: updatedAssignment.id,
          oldValue: {
            status: PositionAssignmentStatus.PENDING,
          },
          newValue: {
            status: PositionAssignmentStatus.ACTIVE,
          },
        },
      });

      return updatedAssignment;
    });
  }

  async endPositionAssignment(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const assignment = await this.prisma.positionAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Position assignment not found.');
    }

    if (assignment.status !== PositionAssignmentStatus.ACTIVE) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: 'Only an active position assignment can be ended.',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedAssignment = await tx.positionAssignment.update({
        where: {
          id,
        },
        data: {
          status: PositionAssignmentStatus.ENDED,
          endedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'PositionAssignment',
          entityId: updatedAssignment.id,
          oldValue: {
            status: PositionAssignmentStatus.ACTIVE,
          },
          newValue: {
            status: PositionAssignmentStatus.ENDED,
            endedAt: updatedAssignment.endedAt?.toISOString(),
          },
        },
      });

      return updatedAssignment;
    });
  }

  async revokePositionAssignment(
    id: string,
    organizationId: string,
    actorUserId: string,
  ) {
    const assignment = await this.prisma.positionAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Position assignment not found.');
    }

    if (
      assignment.status !== PositionAssignmentStatus.PENDING &&
      assignment.status !== PositionAssignmentStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_REVOCABLE',
        message: 'Only pending or active position assignments can be revoked.',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedAssignment = await tx.positionAssignment.update({
        where: {
          id,
        },
        data: {
          status: PositionAssignmentStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'PositionAssignment',
          entityId: updatedAssignment.id,
          oldValue: {
            status: assignment.status,
          },
          newValue: {
            status: PositionAssignmentStatus.REVOKED,
            revokedAt: updatedAssignment.revokedAt?.toISOString(),
          },
        },
      });

      return updatedAssignment;
    });
  }
}
