
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditInsightController } from './audit-insight.controller';
import { AuditInsightService } from './audit-insight.service';

@Module({
    imports: [PrismaModule],
    controllers: [AuditInsightController],
    providers: [AuditInsightService],
})
export class AuditInsightModule { }
