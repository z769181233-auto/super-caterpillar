import { Module } from '@nestjs/common';
import { TimelineController } from './timeline.controller';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [JobModule, AuthModule],
    controllers: [TimelineController],
})
export class TimelineModule { }
