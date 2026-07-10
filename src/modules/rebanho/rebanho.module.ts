import { Module } from '@nestjs/common';
import { RebanhoController } from './rebanho.controller';
import { RebanhoService } from './rebanho.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [RebanhoController],
  providers: [RebanhoService, PrismaService],
})
export class RebanhoModule {}
