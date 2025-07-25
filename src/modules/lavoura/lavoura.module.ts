import { Module } from '@nestjs/common';
import { LavouraService } from './lavoura.service';
import { LavouraController } from './lavoura.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [LavouraController],
  providers: [LavouraService, PrismaService],
})
export class LavouraModule {}