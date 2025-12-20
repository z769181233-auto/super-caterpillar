import { Module } from '@nestjs/common';
import { AutofillController } from './autofill.controller';
import { AutofillService } from './autofill.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectModule } from '../project/project.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [PrismaModule, ProjectModule, OrganizationModule],
  controllers: [AutofillController],
  providers: [AutofillService],
})
export class AutofillModule {}











