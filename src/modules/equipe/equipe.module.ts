import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';

/** Global: o cadastro de usuário usa aceitarConvitesPendentes(). */
@Global()
@Module({
  controllers: [EquipeController],
  providers: [EquipeService, PrismaService],
  exports: [EquipeService],
})
export class EquipeModule {}
