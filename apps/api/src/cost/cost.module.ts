import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CostLedgerService } from './cost-ledger.service';
import { CostLimitService } from './cost-limit.service';
import { CostController, InternalEventsController } from './cost.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CostController, InternalEventsController],
  providers: [CostLedgerService, CostLimitService],
  exports: [CostLedgerService, CostLimitService],
})
export class CostModule { }
