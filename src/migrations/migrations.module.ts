import { Module } from '@nestjs/common';

import { MembersModule } from '../members/members.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { MigrationsController } from './migrations.controller';
import { MigrationsService } from './migrations.service';
import { CsvParser } from './parsers/csv.parser';
import { ExcelParser } from './parsers/excel.parser';

@Module({
  imports: [PrismaModule, MembersModule, NotificationsModule],

  controllers: [MigrationsController],

  providers: [MigrationsService, ExcelParser, CsvParser],

  exports: [MigrationsService],
})
export class MigrationsModule {}
