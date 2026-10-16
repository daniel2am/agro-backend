import { Global, Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';

/** Global: o cadastro de usuário usa aceitarConvitesPendentes(). */
@Global()
@Module({
  controllers: [EquipeController],
  providers: [EquipeService],
  exports: [EquipeService],
})
export class EquipeModule {}
