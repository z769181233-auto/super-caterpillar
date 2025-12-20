import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditLogModule, AuditModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}











