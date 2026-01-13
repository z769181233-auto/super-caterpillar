import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { CostModule } from '../cost/cost.module';

@Module({
  imports: [CostModule],
  controllers: [InternalController],
})
export class InternalModule { }
