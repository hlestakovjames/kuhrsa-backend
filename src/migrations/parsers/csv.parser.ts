import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { MigrationParsedRow } from './excel.parser';

@Injectable()
export class CsvParser {
  parse(buffer: Buffer): MigrationParsedRow[] {
    let records: Record<string, unknown>[];

    try {
      records = parse(buffer.toString('utf-8'), {
        columns: (headers: string[]) =>
          headers.map((header) => this.normalizeHeader(header)),
        skip_empty_lines: true,
        bom: true,
        trim: true,
        relax_column_count: false,
      });
    } catch {
      throw new BadRequestException('The uploaded CSV file could not be read.');
    }

    return records.map((record) => {
      const row: MigrationParsedRow = {};

      for (const [key, value] of Object.entries(record)) {
        row[key] = this.normalizeValue(value);
      }

      return row;
    });
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

  private normalizeValue(value: unknown): string | number | null {
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

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return null;
  }
}
