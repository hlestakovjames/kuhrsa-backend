import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface MigrationParsedRow {
  [key: string]: string | number | null;
}

@Injectable()
export class ExcelParser {
  async parse(buffer: Buffer): Promise<MigrationParsedRow[]> {
    const workbook = new ExcelJS.Workbook();

    try {
      type ExcelLoadInput = Parameters<typeof workbook.xlsx.load>[0];

      const input = buffer as unknown as ExcelLoadInput;

      await workbook.xlsx.load(input);
    } catch {
      throw new BadRequestException(
        'The uploaded Excel file could not be read.',
      );
    }

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException(
        'The uploaded Excel file does not contain a worksheet.',
      );
    }

    const headerRow = worksheet.getRow(1);

    const headerValues = Array.from(
      headerRow.values as ExcelJS.CellValue[],
    ).slice(1);

    if (headerValues.length === 0) {
      throw new BadRequestException(
        'The uploaded Excel file does not contain headers.',
      );
    }

    const headers = headerValues.map((value) =>
      this.normalizeHeader(this.cellValueToString(value)),
    );

    if (headers.length === 0 || headers.every((header) => !header)) {
      throw new BadRequestException(
        'The uploaded Excel file does not contain valid headers.',
      );
    }

    const rows: MigrationParsedRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      const values = Array.from(row.values as ExcelJS.CellValue[]).slice(1);

      const isEmpty = values.every(
        (value) => this.normalizeCellValue(value) === null,
      );

      if (isEmpty) {
        continue;
      }

      const parsed: MigrationParsedRow = {};

      headers.forEach((header, index) => {
        if (!header) {
          return;
        }

        parsed[header] = this.normalizeCellValue(values[index]);
      });

      rows.push(parsed);
    }

    return rows;
  }

  private normalizeHeader(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s/-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const aliases: Record<string, string> = {
      registration_admission_number: 'registration_number',
      registration_admission_no: 'registration_number',
      registration_number: 'registration_number',
      admission_number: 'registration_number',

      faculty_school: 'faculty',
      faculty_or_school: 'faculty',
      faculty: 'faculty',

      first_name: 'first_name',
      last_name: 'last_name',

      national_id: 'national_id',
      staff_number: 'staff_number',

      year_of_study: 'year_of_study',
      graduation_year: 'graduation_year',

      programme: 'programme',
      department: 'department',
      position: 'position',

      email: 'email',
      phone: 'phone',
      address: 'address',
      county: 'county',

      category: 'category',
    };

    return aliases[normalized] ?? normalized;
  }

  private normalizeCellValue(
    value: ExcelJS.CellValue | undefined,
  ): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();

      return normalized === '' ? null : normalized;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'object' && value !== null && 'result' in value) {
      const result = value.result;

      if (result === null || result === undefined) {
        return null;
      }

      if (typeof result === 'number') {
        return result;
      }

      if (typeof result === 'string') {
        const normalized = result.trim();

        return normalized === '' ? null : normalized;
      }

      return null;
    }

    return null;
  }

  private cellValueToString(value: ExcelJS.CellValue): string {
    const normalized = this.normalizeCellValue(value);

    if (normalized === null) {
      return '';
    }

    return typeof normalized === 'number' ? normalized.toString() : normalized;
  }
}
