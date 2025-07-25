import { Module } from '@nestjs/common';
import { ManejoService } from './manejo.service';
import { ManejoController } from './manejo.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ManejoController],
  providers: [ManejoService, PrismaService],
})
export class ManejoModule {}
