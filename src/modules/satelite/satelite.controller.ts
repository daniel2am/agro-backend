import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { SateliteService } from './satelite.service';

@UseGuards(JwtAuthGuard)
@Controller('satelite')
export class SateliteController {
  constructor(private readonly service: SateliteService) {}

  /** Situação de cada invernada/lavoura com perímetro: vigor atual, tendência e série curta. */
  @Get('fazenda/:fazendaId')
  resumo(@Param('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.resumo(fazendaId, user.id);
  }

  /** Série completa de uma área. */
  @Get('fazenda/:fazendaId/:tipo/:alvoId/serie')
  serie(@Param('fazendaId') fazendaId: string, @Param('tipo') tipo: string, @Param('alvoId') alvoId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.serie(fazendaId, tipo, alvoId, user.id);
  }

  /** Busca imagens novas no provedor (respeita o intervalo mínimo de 12 h por área). */
  @Post('fazenda/:fazendaId/atualizar')
  atualizar(@Param('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.atualizar(fazendaId, user.id);
  }
}
