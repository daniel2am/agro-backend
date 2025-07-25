import { Module } from '@nestjs/common';
import { PesagemService } from './pesagem.service';
import { PesagemController } from './pesagem.controller';

@Module({
  controllers: [PesagemController],
  providers: [PesagemService],
})
export class PesagemModule {}
