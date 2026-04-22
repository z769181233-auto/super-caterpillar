import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { LoraTrainingService } from './lora-training.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CharacterController],
  providers: [CharacterService, LoraTrainingService],
  exports: [CharacterService, LoraTrainingService],
})
export class CharacterModule {}
