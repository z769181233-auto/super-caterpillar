import { Module } from '@nestjs/common';
import { OpsModule } from '../ops/ops.module';
import { AudioService } from './audio.service';

@Module({
    imports: [OpsModule],
    providers: [AudioService],
    exports: [AudioService],
})
export class AudioModule { }
