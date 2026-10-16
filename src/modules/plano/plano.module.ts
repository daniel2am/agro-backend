import { Global, Module } from '@nestjs/common';
import { AdminPlanoController, PlanoController } from './plano.controller';
import { PlanoService } from './plano.service';

/** Global: qualquer módulo pode injetar PlanoService para checar limites. */
@Global()
@Module({
  controllers: [PlanoController, AdminPlanoController],
  providers: [PlanoService],
  exports: [PlanoService],
})
export class PlanoModule {}
