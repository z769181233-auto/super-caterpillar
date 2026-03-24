import { Module } from '@nestjs/common';
import { PublishedVideoService } from './published-video.service';
import { PublishedVideoController } from './published-video.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublishedVideoController],
  providers: [PublishedVideoService],
  exports: [PublishedVideoService],
})
export class PublishModule {}
