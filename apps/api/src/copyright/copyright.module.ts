import { Module } from '@nestjs/common';
import { CopyrightService } from './copyright.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [CopyrightService],
    exports: [CopyrightService],
})
export class CopyrightModule { }
