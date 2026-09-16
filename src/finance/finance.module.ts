import { Module } from '@nestjs/common';

import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinancialPeriodsController } from './periods/financial-periods.controller';
import { FinancialPeriodsService } from './periods/financial-periods.service';
import { FeeDefinitionsController } from './fees/fee-definitions.controller';
import { FeeDefinitionsService } from './fees/fee-definitions.service';
import { FeeSchedulesController } from './fees/schedules/fee-schedules.controller';
import { FeeSchedulesService } from './fees/schedules/fee-schedules.service';
import { MemberChargesController } from './charges/member-charges.controller';
import { MemberChargesService } from './charges/member-charges.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PaymentAllocationsController } from './allocations/payment-allocations.controller';
import { PaymentAllocationsService } from './allocations/payment-allocations.service';
import { ReceiptsController } from './receipts/receipts.controller';
import { ReceiptsService } from './receipts/receipts.service';
import { PaymentProvidersController } from './providers/payment-providers.controller';
import { PaymentProvidersService } from './providers/payment-providers.service';
import { MpesaController } from './providers/mpesa/mpesa.controller';
import { MpesaPaymentService } from './providers/mpesa/mpesa-payment.service';
import { MpesaService } from './providers/mpesa/mpesa.service';

@Module({
  controllers: [
    FinanceController,
    FinancialPeriodsController,
    FeeDefinitionsController,
    FeeSchedulesController,
    MemberChargesController,
    PaymentsController,
    PaymentAllocationsController,
    ReceiptsController,
    PaymentProvidersController,
    MpesaController,
  ],
  providers: [
    FinanceService,
    FinancialPeriodsService,
    FeeDefinitionsService,
    FeeSchedulesService,
    MemberChargesService,
    PaymentsService,
    PaymentAllocationsService,
    ReceiptsService,
    PaymentProvidersService,
    MpesaService,
    MpesaPaymentService,
  ],
  exports: [
    FinanceService,
    FinancialPeriodsService,
    FeeDefinitionsService,
    FeeSchedulesService,
    MemberChargesService,
    PaymentsService,
    PaymentAllocationsService,
    ReceiptsService,
    PaymentProvidersService,
    MpesaService,
    MpesaPaymentService,
  ],
})
export class FinanceModule {}
