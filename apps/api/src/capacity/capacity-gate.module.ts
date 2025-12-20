import { Module } from '@nestjs/common';
import { CapacityGateService } from './capacity-gate.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CapacityGateService],
  exports: [CapacityGateService],
})
export class CapacityGateModule {}

