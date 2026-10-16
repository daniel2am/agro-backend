import { Module } from '@nestjs/common';
import { LavouraService } from './lavoura.service';
import { LavouraController } from './lavoura.controller';

@Module({
  controllers: [LavouraController],
  providers: [LavouraService],
})
export class LavouraModule {}