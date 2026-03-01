import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionCache } from './permission.cache';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [PermissionService, PermissionCache],
  exports: [PermissionService],
})
export class PermissionModule {}
