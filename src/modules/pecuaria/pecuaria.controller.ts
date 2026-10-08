import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { PecuariaService } from './pecuaria.service';

const num = (v: string | undefined, nome: string): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${nome} inválido`);
  return n;
};

@UseGuards(JwtAuthGuard)
@Controller('pecuaria')
export class PecuariaController {
  constructor(private readonly service: PecuariaService) {}

  /** Custo da arroba, ponto de equilíbrio e resultado do período. */
  @Get('resultado')
  resultado(
    @Query('fazendaId') fazendaId: string,
    @Query('inicio') inicio: string | undefined,
    @Query('fim') fim: string | undefined,
    @Query('rendimento') rendimento: string | undefined,
    @Query('rateio') rateio: string | undefined,
    @AuthUser() user: UsuarioPayload,
  ) {
    if (!fazendaId) throw new BadRequestException('Informe fazendaId');
    return this.service.resultado(fazendaId, user.id, {
      inicio,
      fim,
      rendimentoPct: num(rendimento, 'Rendimento'),
      rateioGeraisPct: num(rateio, 'Rateio'),
    });
  }
}
