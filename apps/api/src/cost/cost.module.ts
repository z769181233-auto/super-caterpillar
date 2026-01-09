import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CostLedgerService } from './cost-ledger.service';
import { CostController, InternalEventsController } from './cost.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CostController, InternalEventsController],
  providers: [CostLedgerService],
  exports: [CostLedgerService],
})
export class CostModule {}
