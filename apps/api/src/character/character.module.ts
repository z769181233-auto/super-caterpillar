import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { LoraTrainingService } from './lora-training.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CharacterController],
  providers: [CharacterService, LoraTrainingService],
  exports: [CharacterService, LoraTrainingService],
})
export class CharacterModule {}
