import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // opcional, mas recomendado se quiser evitar imports repetitivos
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
