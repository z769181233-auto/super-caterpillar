import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BudgetService } from './budget.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, BudgetService],
  exports: [BillingService, BudgetService],
})
export class BillingModule { }
