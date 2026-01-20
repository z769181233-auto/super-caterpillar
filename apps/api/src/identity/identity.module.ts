import { Module } from '@nestjs/common';
import { IdentityConsistencyService } from './identity-consistency.service';
import { IdentityController } from './identity.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

@Module({
    imports: [PrismaModule, ApiSecurityModule],
    controllers: [IdentityController],
    providers: [IdentityConsistencyService],
    exports: [IdentityConsistencyService],
})
export class IdentityModule { }
