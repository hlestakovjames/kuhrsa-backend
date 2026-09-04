import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberActivationStatus,
  MemberCategory,
  MemberSource,
  MemberStatus,
  MembershipPeriodStatus,
  MigrationBatchStatus,
  MigrationRowStatus,
  Prisma,
  UserStatus,
} from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import ExcelJS from 'exceljs';

import { MemberNumberService } from '../members/member-number.service';
import { PrismaService } from '../prisma/prisma.service';
import { CsvParser } from './parsers/csv.parser';
import { ExcelParser, MigrationParsedRow } from './parsers/excel.parser';

interface MigrationValidationResult {
  status: MigrationRowStatus;
  category: MemberCategory | null;

  firstName: string | null;
  lastName: string | null;

  registrationNumber: string | null;
  nationalId: string | null;
  staffNumber: string | null;

  yearOfStudy: number | null;
  graduationYear: number | null;

  programme: string | null;
  faculty: string | null;
  department: string | null;
  position: string | null;

  email: string | null;
  phone: string | null;
  address: string | null;
  county: string | null;

  errorCode: string | null;
  errorMessage: string | null;
}

interface DuplicateTracker {
  registrationNumbers: Map<string, number>;
  nationalIds: Map<string, number>;
  staffNumbers: Map<string, number>;
  emails: Map<string, number>;
  phones: Map<string, number>;
}

@Injectable()
export class MigrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelParser: ExcelParser,
    private readonly csvParser: CsvParser,
    private readonly memberNumberService: MemberNumberService,
  ) {}

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'KUHRSA';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Members');

    worksheet.columns = [
      {
        header: 'First Name',
        key: 'first_name',
        width: 20,
      },
      {
        header: 'Last Name',
        key: 'last_name',
        width: 20,
      },
      {
        header: 'Category',
        key: 'category',
        width: 16,
      },
      {
        header: 'Registration / Admission Number',
        key: 'registration_number',
        width: 32,
      },
      {
        header: 'National ID',
        key: 'national_id',
        width: 20,
      },
      {
        header: 'Staff Number',
        key: 'staff_number',
        width: 20,
      },
      {
        header: 'Year of Study',
        key: 'year_of_study',
        width: 16,
      },
      {
        header: 'Graduation Year',
        key: 'graduation_year',
        width: 18,
      },
      {
        header: 'Programme',
        key: 'programme',
        width: 30,
      },
      {
        header: 'Faculty / School',
        key: 'faculty',
        width: 30,
      },
      {
        header: 'Department',
        key: 'department',
        width: 30,
      },
      {
        header: 'Position',
        key: 'position',
        width: 24,
      },
      {
        header: 'Email',
        key: 'email',
        width: 32,
      },
      {
        header: 'Phone',
        key: 'phone',
        width: 20,
      },
      {
        header: 'Address',
        key: 'address',
        width: 32,
      },
      {
        header: 'County',
        key: 'county',
        width: 20,
      },
    ];

    worksheet.addRow([
      'Example',
      'Student',
      'STUDENT',
      'KSU/XXX/0001',
      '',
      '',
      2,
      '',
      'BSc ICT',
      'School of Computing',
      'Information Technology',
      '',
      'student@example.com',
      '0712000000',
      'Kisii',
      'Kisii',
    ]);

    worksheet.addRow([
      'Example',
      'Alumni',
      'ALUMNI',
      '',
      '12345678',
      '',
      '',
      2024,
      'BSc ICT',
      'School of Computing',
      'Information Technology',
      '',
      'alumni@example.com',
      '0712000001',
      'Kisii',
      'Kisii',
    ]);

    worksheet.addRow([
      'Example',
      'Lecturer',
      'LECTURER',
      '',
      '',
      'STAFF-0001',
      '',
      '',
      '',
      'School of Business',
      'Human Resource Management',
      'Lecturer',
      'lecturer@example.com',
      '0712000002',
      'Kisii',
      'Kisii',
    ]);

    worksheet.getRow(1).font = {
      bold: true,
    };

    worksheet.autoFilter = {
      from: 'A1',
      to: 'P1',
    };

    const workbookBuffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(workbookBuffer);
  }

  async upload(
    organizationId: string,
    actorUserId: string,
    file: Express.Multer.File,
    source: MemberSource = MemberSource.MIGRATION_IMPORT,
  ) {
    this.validateFile(file);

    if (
      source !== MemberSource.MIGRATION_IMPORT &&
      source !== MemberSource.MIGRATION_MANUAL
    ) {
      throw new BadRequestException(
        'Migration uploads must use MIGRATION_IMPORT or MIGRATION_MANUAL.',
      );
    }

    const rows = await this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException(
        'The uploaded file does not contain any member rows.',
      );
    }

    if (rows.length > 10000) {
      throw new BadRequestException(
        'A single migration file cannot contain more than 10,000 rows.',
      );
    }

    const batch = await this.prisma.migrationBatch.create({
      data: {
        organizationId,
        fileName: file.originalname,
        source,
        status: MigrationBatchStatus.VALIDATING,
        totalRows: rows.length,
        createdBy: actorUserId,
      },
    });

    const validationResults: MigrationValidationResult[] = [];

    const duplicateTracker: DuplicateTracker = {
      registrationNumbers: new Map<string, number>(),
      nationalIds: new Map<string, number>(),
      staffNumbers: new Map<string, number>(),
      emails: new Map<string, number>(),
      phones: new Map<string, number>(),
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      const result = await this.validateRow(
        row,
        index + 2,
        organizationId,
        duplicateTracker,
      );

      validationResults.push(result);

      await this.prisma.migrationBatchRow.create({
        data: {
          migrationBatchId: batch.id,

          rowNumber: index + 2,

          status: result.status,

          category: result.category,

          firstName: result.firstName,

          lastName: result.lastName,

          registrationNumber: result.registrationNumber,

          nationalId: result.nationalId,

          staffNumber: result.staffNumber,

          yearOfStudy: result.yearOfStudy,

          graduationYear: result.graduationYear,

          programme: result.programme,

          faculty: result.faculty,

          department: result.department,

          position: result.position,

          email: result.email,

          phone: result.phone,

          address: result.address,

          county: result.county,

          errorCode: result.errorCode,

          errorMessage: result.errorMessage,
        },
      });
    }

    const validRows = validationResults.filter(
      (row) => row.status === MigrationRowStatus.VALID,
    ).length;

    const invalidRows = validationResults.filter(
      (row) => row.status === MigrationRowStatus.INVALID,
    ).length;

    const updatedStatus =
      invalidRows === 0
        ? MigrationBatchStatus.VALIDATED
        : MigrationBatchStatus.UPLOADED;

    const updatedBatch = await this.prisma.migrationBatch.update({
      where: {
        id: batch.id,
      },

      data: {
        status: updatedStatus,

        validRows,

        invalidRows,
      },
    });

    return {
      message:
        invalidRows === 0
          ? 'Migration file validated successfully.'
          : 'Migration file uploaded with validation errors.',

      batch: {
        id: updatedBatch.id,

        fileName: updatedBatch.fileName,

        source: updatedBatch.source,

        status: updatedBatch.status,

        totalRows: updatedBatch.totalRows,

        validRows: updatedBatch.validRows,

        invalidRows: updatedBatch.invalidRows,
      },
    };
  }

  async getBatch(id: string, organizationId: string) {
    const batch = await this.prisma.migrationBatch.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        rows: {
          orderBy: {
            rowNumber: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Migration batch not found.');
    }

    return batch;
  }

  async generateReport(
    id: string,
    organizationId: string,
  ): Promise<{
    fileName: string;
    buffer: Buffer;
  }> {
    const batch = await this.prisma.migrationBatch.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        rows: {
          orderBy: {
            rowNumber: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Migration batch not found.');
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'KUHRSA';
    workbook.created = new Date();
    workbook.modified = new Date();

    const summary = workbook.addWorksheet('Summary');

    summary.columns = [
      {
        header: 'Field',
        key: 'field',
        width: 30,
      },
      {
        header: 'Value',
        key: 'value',
        width: 40,
      },
    ];

    summary.addRows([
      {
        field: 'Migration Batch ID',
        value: batch.id,
      },
      {
        field: 'File Name',
        value: batch.fileName,
      },
      {
        field: 'Source',
        value: batch.source,
      },
      {
        field: 'Status',
        value: batch.status,
      },
      {
        field: 'Total Rows',
        value: batch.totalRows,
      },
      {
        field: 'Valid Rows',
        value: batch.validRows,
      },
      {
        field: 'Invalid Rows',
        value: batch.invalidRows,
      },
      {
        field: 'Imported Rows',
        value: batch.importedRows,
      },
      {
        field: 'Failed Rows',
        value: batch.failedRows,
      },
      {
        field: 'Skipped Rows',
        value: batch.skippedRows,
      },
      {
        field: 'Created By',
        value: batch.createdBy,
      },
      {
        field: 'Started At',
        value: batch.startedAt ? batch.startedAt.toISOString() : null,
      },
      {
        field: 'Completed At',
        value: batch.completedAt ? batch.completedAt.toISOString() : null,
      },
      {
        field: 'Created At',
        value: batch.createdAt.toISOString(),
      },
      {
        field: 'Updated At',
        value: batch.updatedAt.toISOString(),
      },
    ]);

    summary.getRow(1).font = {
      bold: true,
    };

    const rowsSheet = workbook.addWorksheet('Migration Rows');

    rowsSheet.columns = [
      {
        header: 'Row Number',
        key: 'rowNumber',
        width: 14,
      },
      {
        header: 'Status',
        key: 'status',
        width: 18,
      },
      {
        header: 'Category',
        key: 'category',
        width: 16,
      },
      {
        header: 'First Name',
        key: 'firstName',
        width: 20,
      },
      {
        header: 'Last Name',
        key: 'lastName',
        width: 20,
      },
      {
        header: 'Registration / Admission Number',
        key: 'registrationNumber',
        width: 32,
      },
      {
        header: 'National ID',
        key: 'nationalId',
        width: 20,
      },
      {
        header: 'Staff Number',
        key: 'staffNumber',
        width: 20,
      },
      {
        header: 'Year of Study',
        key: 'yearOfStudy',
        width: 16,
      },
      {
        header: 'Graduation Year',
        key: 'graduationYear',
        width: 18,
      },
      {
        header: 'Programme',
        key: 'programme',
        width: 30,
      },
      {
        header: 'Faculty / School',
        key: 'faculty',
        width: 30,
      },
      {
        header: 'Department',
        key: 'department',
        width: 30,
      },
      {
        header: 'Position',
        key: 'position',
        width: 24,
      },
      {
        header: 'Email',
        key: 'email',
        width: 32,
      },
      {
        header: 'Phone',
        key: 'phone',
        width: 20,
      },
      {
        header: 'Address',
        key: 'address',
        width: 30,
      },
      {
        header: 'County',
        key: 'county',
        width: 20,
      },
      {
        header: 'Member ID',
        key: 'memberId',
        width: 38,
      },
      {
        header: 'Member Number',
        key: 'memberNumber',
        width: 24,
      },
      {
        header: 'Error Code',
        key: 'errorCode',
        width: 24,
      },
      {
        header: 'Error Message',
        key: 'errorMessage',
        width: 50,
      },
    ];

    for (const row of batch.rows) {
      rowsSheet.addRow({
        rowNumber: row.rowNumber,

        status: row.status,

        category: row.category,

        firstName: row.firstName,

        lastName: row.lastName,

        registrationNumber: row.registrationNumber,

        nationalId: row.nationalId ? '[PROTECTED]' : null,

        staffNumber: row.staffNumber,

        yearOfStudy: row.yearOfStudy,

        graduationYear: row.graduationYear,

        programme: row.programme,

        faculty: row.faculty,

        department: row.department,

        position: row.position,

        email: row.email,

        phone: row.phone,

        address: row.address,

        county: row.county,

        memberId: row.memberId,

        memberNumber: row.memberNumber,

        errorCode: row.errorCode,

        errorMessage: row.errorMessage,
      });
    }

    rowsSheet.getRow(1).font = {
      bold: true,
    };

    rowsSheet.autoFilter = {
      from: 'A1',
      to: 'V1',
    };

    const workbookBuffer = await workbook.xlsx.writeBuffer();

    return {
      fileName: `KUHRSA_Migration_Report_${batch.id}.xlsx`,

      buffer: Buffer.from(workbookBuffer),
    };
  }

  async importBatch(id: string, organizationId: string, actorUserId: string) {
    const batch = await this.prisma.migrationBatch.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!batch) {
      throw new NotFoundException('Migration batch not found.');
    }

    if (batch.status !== MigrationBatchStatus.VALIDATED) {
      throw new ConflictException({
        code: 'MIGRATION_NOT_READY',

        message: 'Only a fully validated migration batch can be imported.',
      });
    }

    if (batch.validRows === 0) {
      throw new ConflictException({
        code: 'NO_VALID_ROWS',

        message:
          'The migration batch does not contain any valid rows to import.',
      });
    }

    const claimResult = await this.prisma.migrationBatch.updateMany({
      where: {
        id,
        organizationId,
        status: MigrationBatchStatus.VALIDATED,
      },

      data: {
        status: MigrationBatchStatus.IMPORTING,

        startedAt: new Date(),

        completedAt: null,

        importedRows: 0,

        failedRows: 0,

        skippedRows: 0,
      },
    });

    if (claimResult.count !== 1) {
      throw new ConflictException({
        code: 'MIGRATION_ALREADY_PROCESSING',

        message:
          'This migration batch is already being processed or has already been imported.',
      });
    }

    const rows = await this.prisma.migrationBatchRow.findMany({
      where: {
        migrationBatchId: batch.id,

        status: MigrationRowStatus.VALID,
      },

      orderBy: {
        rowNumber: 'asc',
      },
    });

    let importedRows = 0;
    let failedRows = 0;

    for (const row of rows) {
      try {
        await this.importRow(
          batch.id,
          row.id,
          organizationId,
          actorUserId,
          batch.source,
        );

        importedRows += 1;
      } catch (error) {
        failedRows += 1;

        const errorMessage =
          error instanceof Error
            ? error.message
            : 'The migration row could not be imported.';

        await this.prisma.migrationBatchRow.update({
          where: {
            id: row.id,
          },

          data: {
            status: MigrationRowStatus.FAILED,

            errorCode: 'IMPORT_FAILED',

            errorMessage,
          },
        });
      }

      await this.prisma.migrationBatch.update({
        where: {
          id: batch.id,
        },

        data: {
          importedRows,
          failedRows,
        },
      });
    }

    const finalStatus =
      failedRows === 0
        ? MigrationBatchStatus.COMPLETED
        : importedRows > 0
          ? MigrationBatchStatus.COMPLETED_WITH_ERRORS
          : MigrationBatchStatus.FAILED;

    const completedBatch = await this.prisma.migrationBatch.update({
      where: {
        id: batch.id,
      },

      data: {
        status: finalStatus,

        importedRows,

        failedRows,

        completedAt: new Date(),
      },
    });

    return {
      message:
        finalStatus === MigrationBatchStatus.COMPLETED
          ? 'Migration batch imported successfully.'
          : finalStatus === MigrationBatchStatus.COMPLETED_WITH_ERRORS
            ? 'Migration batch completed with some import errors.'
            : 'Migration batch import failed.',

      batch: {
        id: completedBatch.id,

        fileName: completedBatch.fileName,

        source: completedBatch.source,

        status: completedBatch.status,

        totalRows: completedBatch.totalRows,

        validRows: completedBatch.validRows,

        invalidRows: completedBatch.invalidRows,

        importedRows: completedBatch.importedRows,

        failedRows: completedBatch.failedRows,

        skippedRows: completedBatch.skippedRows,
      },
    };
  }

  private async importRow(
    migrationBatchId: string,
    migrationRowId: string,
    organizationId: string,
    actorUserId: string,
    source: MemberSource,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.migrationBatchRow.findUnique({
        where: {
          id: migrationRowId,
        },
      });

      if (!row) {
        throw new NotFoundException(
          `Migration row ${migrationRowId} was not found.`,
        );
      }

      if (row.status === MigrationRowStatus.IMPORTED) {
        return;
      }

      if (row.status !== MigrationRowStatus.VALID) {
        throw new ConflictException(
          `Migration row ${row.rowNumber} is not valid for import.`,
        );
      }

      if (!row.category) {
        throw new ConflictException(
          `Migration row ${row.rowNumber} has no category.`,
        );
      }

      const memberNumber = await this.memberNumberService.generate(
        row.category,
        tx,
      );

      let userId: string | null = null;

      if (row.email) {
        const existingUser = await tx.user.findUnique({
          where: {
            email: row.email,
          },

          select: {
            id: true,
          },
        });

        if (existingUser) {
          throw new ConflictException(
            'Email is already associated with a KUHRSA account.',
          );
        }

        const temporaryPassword = randomBytes(32).toString('hex');

        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        const user = await tx.user.create({
          data: {
            organizationId,

            firstName: row.firstName ?? '',

            lastName: row.lastName ?? '',

            email: row.email,

            passwordHash,

            status: UserStatus.INACTIVE,
          },
        });

        userId = user.id;

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
      }

      const member = await tx.member.create({
        data: {
          organizationId,

          userId,

          category: row.category,

          registrationNumber: row.registrationNumber ?? null,

          memberNumber,

          yearOfStudy:
            row.category === MemberCategory.STUDENT ? row.yearOfStudy : null,

          graduationYear:
            row.category === MemberCategory.ALUMNI ? row.graduationYear : null,

          nationalId:
            row.category === MemberCategory.ALUMNI ? row.nationalId : null,

          staffNumber:
            row.category === MemberCategory.LECTURER ? row.staffNumber : null,

          position:
            row.category === MemberCategory.LECTURER ? row.position : null,

          programme:
            row.category === MemberCategory.STUDENT ||
            row.category === MemberCategory.ALUMNI
              ? row.programme
              : null,

          faculty: row.faculty,

          department: row.department,

          email: row.email,

          phone: row.phone,

          address: row.address,

          county: row.county,

          status: MemberStatus.PENDING,

          source,

          activationStatus: MemberActivationStatus.PENDING,
        },
      });

      const membership = this.getMembershipDates();

      await tx.membershipPeriod.create({
        data: {
          memberId: member.id,

          organizationId,

          membershipYear: membership.membershipYear,

          startsAt: membership.startsAt,

          endsAt: membership.endsAt,

          status: MembershipPeriodStatus.PENDING,
        },
      });

      /*
       * Create activation only when an actual User account exists.
       *
       * Legacy members without email are still imported as members
       * and can later have an account linked by an administrator.
       */

      if (userId) {
        const activationToken = randomBytes(32).toString('hex');

        const tokenHash = await bcrypt.hash(activationToken, 12);

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
            migrationBatchId,

            migrationRowId,

            category: member.category,

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

      await tx.migrationBatchRow.update({
        where: {
          id: migrationRowId,
        },

        data: {
          status: MigrationRowStatus.IMPORTED,

          memberId: member.id,

          memberNumber: member.memberNumber,

          errorCode: null,

          errorMessage: null,
        },
      });
    });
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A migration file is required.');
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('The uploaded migration file is empty.');
    }

    const extension = file.originalname.toLowerCase().split('.').pop();

    if (extension !== 'xlsx' && extension !== 'csv') {
      throw new BadRequestException(
        'Only .xlsx and .csv migration files are supported.',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Migration files cannot exceed 10 MB.');
    }
  }

  private async parseFile(
    file: Express.Multer.File,
  ): Promise<MigrationParsedRow[]> {
    const extension = file.originalname.toLowerCase().split('.').pop();

    if (extension === 'xlsx') {
      return this.excelParser.parse(file.buffer);
    }

    return this.csvParser.parse(file.buffer);
  }

  private async validateRow(
    row: MigrationParsedRow,
    rowNumber: number,
    organizationId: string,
    duplicateTracker: DuplicateTracker,
  ): Promise<MigrationValidationResult> {
    const category = this.parseCategory(row.category);

    const firstName = this.toStringValue(row.first_name);

    const lastName = this.toStringValue(row.last_name);

    const registrationNumber = this.toStringValue(row.registration_number);

    const nationalId = this.toStringValue(row.national_id);

    const staffNumber = this.toStringValue(row.staff_number);

    const yearOfStudy = this.toInteger(row.year_of_study);

    const graduationYear = this.toInteger(row.graduation_year);

    const programme = this.toStringValue(row.programme);

    const faculty = this.toStringValue(row.faculty);

    const department = this.toStringValue(row.department);

    const position = this.toStringValue(row.position);

    const email = this.toEmail(row.email);

    const phone = this.normalizePhone(this.toStringValue(row.phone));

    const address = this.toStringValue(row.address);

    const county = this.toStringValue(row.county);

    const failure = (
      errorCode: string,
      errorMessage: string,
    ): MigrationValidationResult => ({
      status: MigrationRowStatus.INVALID,

      category,

      firstName,
      lastName,

      registrationNumber,
      nationalId,
      staffNumber,

      yearOfStudy,
      graduationYear,

      programme,
      faculty,
      department,
      position,

      email,
      phone,
      address,
      county,

      errorCode,
      errorMessage,
    });

    if (!category) {
      return failure(
        'INVALID_CATEGORY',
        'Category must be STUDENT, ALUMNI, or LECTURER.',
      );
    }

    if (!firstName || !lastName) {
      return failure('NAME_REQUIRED', 'First name and last name are required.');
    }

    if (category === MemberCategory.STUDENT) {
      if (!registrationNumber) {
        return failure(
          'REGISTRATION_NUMBER_REQUIRED',
          'Student registration/admission number is required.',
        );
      }

      if (yearOfStudy === null || yearOfStudy < 1 || yearOfStudy > 4) {
        return failure(
          'INVALID_YEAR_OF_STUDY',
          'Student year of study must be between 1 and 4.',
        );
      }

      if (!programme) {
        return failure(
          'PROGRAMME_REQUIRED',
          'Programme is required for students.',
        );
      }
    }

    if (category === MemberCategory.ALUMNI) {
      if (!nationalId) {
        return failure(
          'NATIONAL_ID_REQUIRED',
          'National ID is required for alumni.',
        );
      }

      if (
        graduationYear === null ||
        graduationYear < 1900 ||
        graduationYear > new Date().getFullYear()
      ) {
        return failure(
          'INVALID_GRADUATION_YEAR',
          'Graduation year is invalid.',
        );
      }

      if (!programme) {
        return failure(
          'PROGRAMME_REQUIRED',
          'Programme is required for alumni.',
        );
      }
    }

    if (category === MemberCategory.LECTURER) {
      if (!staffNumber) {
        return failure(
          'STAFF_NUMBER_REQUIRED',
          'Staff/employee number is required for lecturers.',
        );
      }

      if (!position) {
        return failure(
          'POSITION_REQUIRED',
          'Position is required for lecturers.',
        );
      }
    }

    if (!faculty || !department) {
      return failure(
        'ACADEMIC_DETAILS_REQUIRED',
        'Faculty/School and Department are required.',
      );
    }

    if (
      registrationNumber &&
      duplicateTracker.registrationNumbers.has(registrationNumber)
    ) {
      const previousRow =
        duplicateTracker.registrationNumbers.get(registrationNumber);

      return failure(
        'DUPLICATE_IN_FILE',
        `Registration/admission number duplicates row ${previousRow} in the uploaded file.`,
      );
    }

    if (nationalId && duplicateTracker.nationalIds.has(nationalId)) {
      const previousRow = duplicateTracker.nationalIds.get(nationalId);

      return failure(
        'DUPLICATE_IN_FILE',
        `National ID duplicates row ${previousRow} in the uploaded file.`,
      );
    }

    if (staffNumber && duplicateTracker.staffNumbers.has(staffNumber)) {
      const previousRow = duplicateTracker.staffNumbers.get(staffNumber);

      return failure(
        'DUPLICATE_IN_FILE',
        `Staff/employee number duplicates row ${previousRow} in the uploaded file.`,
      );
    }

    if (email && duplicateTracker.emails.has(email)) {
      const previousRow = duplicateTracker.emails.get(email);

      return failure(
        'DUPLICATE_IN_FILE',
        `Email duplicates row ${previousRow} in the uploaded file.`,
      );
    }

    if (phone && duplicateTracker.phones.has(phone)) {
      const previousRow = duplicateTracker.phones.get(phone);

      return failure(
        'DUPLICATE_IN_FILE',
        `Phone number duplicates row ${previousRow} in the uploaded file.`,
      );
    }

    if (registrationNumber) {
      duplicateTracker.registrationNumbers.set(registrationNumber, rowNumber);
    }

    if (nationalId) {
      duplicateTracker.nationalIds.set(nationalId, rowNumber);
    }

    if (staffNumber) {
      duplicateTracker.staffNumbers.set(staffNumber, rowNumber);
    }

    if (email) {
      duplicateTracker.emails.set(email, rowNumber);
    }

    if (phone) {
      duplicateTracker.phones.set(phone, rowNumber);
    }

    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        return failure(
          'EMAIL_IN_USE',
          'Email is already associated with a KUHRSA account.',
        );
      }

      const existingMember = await this.prisma.member.findFirst({
        where: {
          organizationId,
          email,
        },
      });

      if (existingMember) {
        return failure(
          'EMAIL_IN_USE',
          'Email is already associated with a KUHRSA member.',
        );
      }
    }

    if (phone) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          phone,
        },
      });

      if (existingUser) {
        return failure(
          'PHONE_IN_USE',
          'Phone number is already associated with a KUHRSA account.',
        );
      }

      const existingMember = await this.prisma.member.findFirst({
        where: {
          organizationId,
          phone,
        },
      });

      if (existingMember) {
        return failure(
          'PHONE_IN_USE',
          'Phone number is already associated with a KUHRSA member.',
        );
      }
    }

    if (registrationNumber) {
      const existingRegistration = await this.prisma.member.findUnique({
        where: {
          registrationNumber,
        },
      });

      if (existingRegistration) {
        return failure(
          'MEMBER_IDENTIFIER_IN_USE',
          'Registration/admission number is already associated with a KUHRSA member.',
        );
      }
    }

    if (nationalId) {
      const existingNationalId = await this.prisma.member.findUnique({
        where: {
          nationalId,
        },
      });

      if (existingNationalId) {
        return failure(
          'NATIONAL_ID_IN_USE',
          'National ID is already associated with a KUHRSA member.',
        );
      }
    }

    if (staffNumber) {
      const existingStaffNumber = await this.prisma.member.findUnique({
        where: {
          staffNumber,
        },
      });

      if (existingStaffNumber) {
        return failure(
          'STAFF_NUMBER_IN_USE',
          'Staff/employee number is already associated with a KUHRSA member.',
        );
      }
    }

    return {
      status: MigrationRowStatus.VALID,

      category,

      firstName,
      lastName,

      registrationNumber,
      nationalId,
      staffNumber,

      yearOfStudy,
      graduationYear,

      programme,
      faculty,
      department,
      position,

      email,
      phone,
      address,
      county,

      errorCode: null,
      errorMessage: null,
    };
  }

  private parseCategory(
    value: string | number | null | undefined,
  ): MemberCategory | null {
    const category = this.toStringValue(value)?.toUpperCase();

    if (
      category === MemberCategory.STUDENT ||
      category === MemberCategory.ALUMNI ||
      category === MemberCategory.LECTURER
    ) {
      return category;
    }

    return null;
  }

  private toStringValue(
    value: string | number | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const result = typeof value === 'number' ? value.toString() : value.trim();

    return result === '' ? null : result;
  }

  private toInteger(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const number = typeof value === 'number' ? value : Number(value.trim());

    if (!Number.isInteger(number)) {
      return null;
    }

    return number;
  }

  private toEmail(value: string | number | null | undefined): string | null {
    const email = this.toStringValue(value)?.toLowerCase();

    if (!email) {
      return null;
    }

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    return valid ? email : null;
  }

  private normalizePhone(
    value: string | number | null | undefined,
  ): string | null {
    const normalized = this.toStringValue(value);

    if (!normalized) {
      return null;
    }

    const phone = normalized.replace(/\s+/g, '');

    if (/^07\d{8}$/.test(phone)) {
      return `+254${phone.substring(1)}`;
    }

    if (/^01\d{8}$/.test(phone)) {
      return `+254${phone.substring(1)}`;
    }

    if (/^254\d{9}$/.test(phone)) {
      return `+${phone}`;
    }

    if (/^\+254\d{9}$/.test(phone)) {
      return phone;
    }

    return phone;
  }

  private getMembershipDates(): {
    membershipYear: string;
    startsAt: Date;
    endsAt: Date;
  } {
    const now = new Date();

    const startYear =
      now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

    const startsAt = new Date(startYear, 8, 1, 0, 0, 0, 0);

    const endsAt = new Date(startYear + 1, 7, 31, 23, 59, 59, 999);

    return {
      membershipYear: `${startYear}/${startYear + 1}`,

      startsAt,

      endsAt,
    };
  }
}
