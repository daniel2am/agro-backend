import { Module } from '@nestjs/common';
import { SanidadeService } from './sanidade.service';
import { SanidadeController } from './sanidade.controller';

@Module({
  controllers: [SanidadeController],
  providers: [SanidadeService],
})
export class SanidadeModule {}
