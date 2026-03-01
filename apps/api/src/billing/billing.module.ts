import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { BillingSettlementService } from './billing-settlement.service';
import { FinancialSettlementService } from './financial-settlement.service';
import { BillingService } from './billing.service';
import { BudgetService } from './budget.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [BillingController],
  providers: [BillingService, BudgetService, BillingSettlementService, FinancialSettlementService],
  exports: [BillingService, BudgetService, BillingSettlementService, FinancialSettlementService],
})
export class BillingModule {}
