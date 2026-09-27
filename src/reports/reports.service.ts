import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import ExcelJS from 'exceljs';

import { PrismaService } from '../prisma/prisma.service';

type ExportFormat = 'xlsx' | 'csv';

type ExportResult = {
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

type DatasetConfig = {
  table: string;
  title: string;
  permission: string;
  protectedFields?: string[];
};

@Injectable()
export class ReportsService {
  private readonly datasets: Record<string, DatasetConfig> = {
    members: {
      table: 'Member',
      title: 'KUHRSA Members',
      permission: 'reports.membership.generate',
      protectedFields: ['nationalId'],
    },

    membershipPeriods: {
      table: 'MembershipPeriod',
      title: 'KUHRSA Membership Periods',
      permission: 'reports.membership.generate',
    },

    payments: {
      table: 'Payment',
      title: 'KUHRSA Payments',
      permission: 'reports.payments.generate',
    },

    charges: {
      table: 'MemberCharge',
      title: 'KUHRSA Member Charges',
      permission: 'reports.finance.generate',
    },

    receipts: {
      table: 'Receipt',
      title: 'KUHRSA Receipts',
      permission: 'reports.finance.generate',
    },
  };

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async exportMembers(
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.exportDataset(
      'members',
      organizationId,
      format,
    );
  }

  async exportMembershipPeriods(
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.exportDataset(
      'membershipPeriods',
      organizationId,
      format,
    );
  }

  async exportPayments(
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.exportDataset(
      'payments',
      organizationId,
      format,
    );
  }

  async exportCharges(
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.exportDataset(
      'charges',
      organizationId,
      format,
    );
  }

  async exportReceipts(
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    return this.exportDataset(
      'receipts',
      organizationId,
      format,
    );
  }

  private async exportDataset(
    datasetKey: string,
    organizationId: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    const dataset = this.datasets[datasetKey];

    if (!dataset) {
      throw new BadRequestException(
        'Unsupported export dataset.',
      );
    }

    const normalizedFormat =
      format === 'csv' ? 'csv' : 'xlsx';

    const rows =
      await this.loadOrganizationRecords(
        dataset.table,
        organizationId,
      );

    const sanitizedRows = rows.map((row) =>
      this.sanitizeRow(
        row,
        dataset.protectedFields ?? [],
      ),
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'KUHRSA';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(
      'Records',
    );

    const columns = this.buildColumns(
      sanitizedRows,
    );

    worksheet.columns = columns;

    for (const row of sanitizedRows) {
      worksheet.addRow(
        this.normalizeRowForExcel(row),
      );
    }

    if (worksheet.rowCount > 0) {
      worksheet.getRow(1).font = {
        bold: true,
      };

      worksheet.getRow(1).alignment = {
        vertical: 'middle',
        wrapText: true,
      };

      worksheet.views = [
        {
          state: 'frozen',
          ySplit: 1,
        },
      ];

      worksheet.autoFilter = {
        from: 'A1',
        to: `${this.columnLetter(
          worksheet.columnCount,
        )}1`,
      };
    }

    this.applyColumnWidths(worksheet);

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    if (normalizedFormat === 'csv') {
      const csvBuffer =
        await workbook.csv.writeBuffer();

      return {
        fileName:
          `KUHRSA_${datasetKey}_${timestamp}.csv`,
        contentType:
          'text/csv; charset=utf-8',
        buffer: Buffer.from(csvBuffer),
      };
    }

    const xlsxBuffer =
      await workbook.xlsx.writeBuffer();

    return {
      fileName:
        `KUHRSA_${datasetKey}_${timestamp}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(xlsxBuffer),
    };
  }

  private async loadOrganizationRecords(
    table: string,
    organizationId: string,
  ): Promise<Record<string, unknown>[]> {
    const allowedTables = new Set([
      'Member',
      'MembershipPeriod',
      'Payment',
      'MemberCharge',
      'Receipt',
    ]);

    if (!allowedTables.has(table)) {
      throw new BadRequestException(
        'Invalid export dataset.',
      );
    }

    const rows =
      await this.prisma.$queryRawUnsafe<
        Record<string, unknown>[]
      >(
        `SELECT *
         FROM "${table}"
         WHERE "organizationId" = $1
         ORDER BY "createdAt" DESC`,
        organizationId,
      );

    return rows;
  }

  private sanitizeRow(
    row: Record<string, unknown>,
    protectedFields: string[],
  ): Record<string, unknown> {
    const result = {
      ...row,
    };

    for (const field of protectedFields) {
      if (field in result) {
        result[field] =
          result[field] ? '[PROTECTED]' : null;
      }
    }

    return result;
  }

  private normalizeRowForExcel(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<
      string,
      unknown
    > = {};

    for (const [key, value] of Object.entries(
      row,
    )) {
      if (
        value === null ||
        value === undefined
      ) {
        normalized[key] = '';
        continue;
      }

      if (typeof value === 'bigint') {
        normalized[key] =
          value.toString();
        continue;
      }

      if (
        value instanceof Date
      ) {
        normalized[key] = value;
        continue;
      }

      if (
        typeof value === 'object'
      ) {
        normalized[key] =
          JSON.stringify(value);
        continue;
      }

      normalized[key] = value;
    }

    return normalized;
  }

  private buildColumns(
    rows: Record<string, unknown>[],
  ) {
    const keys = new Set<string>();

    for (const row of rows) {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
    }

    return Array.from(keys).map(
      (key) => ({
        header: this.humanize(key),
        key,
        width: 22,
      }),
    );
  }

  private applyColumnWidths(
    worksheet: ExcelJS.Worksheet,
  ) {
    for (
      let index = 1;
      index <= worksheet.columnCount;
      index += 1
    ) {
      const column =
        worksheet.getColumn(index);

      let maxLength = 12;

      for (
        let rowIndex = 1;
        rowIndex <= worksheet.rowCount;
        rowIndex += 1
      ) {
        const value =
          worksheet
            .getRow(rowIndex)
            .getCell(index)
            .value;

        if (
          value !== null &&
          value !== undefined
        ) {
          maxLength = Math.max(
            maxLength,
            String(value).length,
          );
        }
      }

      column.width = Math.min(
        Math.max(maxLength + 2, 12),
        45,
      );
    }
  }

  private humanize(value: string) {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, (character) =>
        character.toUpperCase(),
      );
  }

  private columnLetter(
    columnNumber: number,
  ) {
    let dividend = columnNumber;
    let columnName = '';

    while (dividend > 0) {
      const modulo =
        (dividend - 1) % 26;

      columnName =
        String.fromCharCode(
          65 + modulo,
        ) + columnName;

      dividend =
        Math.floor(
          (dividend - modulo) / 26,
        );
    }

    return columnName;
  }
}
