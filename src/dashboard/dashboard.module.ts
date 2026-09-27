import { Module } from '@nestjs/common';

import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],

  providers: [
    DashboardService,
    PortalAccessGuard,
  ],

  exports: [DashboardService],
})
export class DashboardModule {}
