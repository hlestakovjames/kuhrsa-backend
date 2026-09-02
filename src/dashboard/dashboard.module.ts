import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PortalAccessGuard } from '../auth/guards/portal/portal.guard';

@Module({
  controllers: [DashboardController],
  providers: [PortalAccessGuard],
})
export class DashboardModule {}
