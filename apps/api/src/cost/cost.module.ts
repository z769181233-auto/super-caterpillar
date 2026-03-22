import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { AuthModule } from '../auth/auth.module';
import { CostLedgerService } from './cost-ledger.service';
import { CostLimitService } from './cost-limit.service';
import { CostController, InternalEventsController } from './cost.controller';

@Module({
  imports: [PrismaModule, BillingModule, AuthModule],
  controllers: [CostController, InternalEventsController],
  providers: [CostLedgerService, CostLimitService],
  exports: [CostLedgerService, CostLimitService],
})
export class CostModule {}
