// src/modules/dashboard/dashboard.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GroupBy, IndicadoresFiltro, TipoIndicador } from './dto/indicadores.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /**
   * GET /dashboard/resumo?fazendaId=...
   * Header: Authorization: Bearer <JWT>
   */
  @Get('resumo')
  async resumo(@Query('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    if (!fazendaId) throw new BadRequestException('fazendaId é obrigatório');

    return this.dashboard.getResumoDaFazenda(fazendaId, user.id);
  }

  /**
   * GET /dashboard/historico?fazendaId=...
   */
  @Get('historico')
  async historico(@Query('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    if (!fazendaId) throw new BadRequestException('fazendaId é obrigatório');

    return this.dashboard.getHistoricoRecentes(fazendaId, user.id);
  }

  /**
   * POST /dashboard/indicadores/:tipo?fazendaId=...
   * Body: IndicadoresFiltro
   * :tipo = 'peso' | 'financeiro'
   */
  @Post('indicadores/:tipo')
  async indicadores(
    @Param('tipo') tipoParam: string,
    @Query('fazendaId') fazendaId: string,
    @Body() filtro: IndicadoresFiltro,
    @AuthUser() user: UsuarioPayload,
  ) {
    const usuarioId = user.id;
    if (!fazendaId) throw new BadRequestException('fazendaId é obrigatório');

    // normaliza tipo
    const lower = (tipoParam || '').toLowerCase();
    const tipo: TipoIndicador =
      lower === 'peso' || lower === 'financeiro' ? (lower as TipoIndicador) : null as any;
    if (!tipo) throw new BadRequestException('Tipo inválido (use "peso" ou "financeiro")');

    // compat: se alguém mandar "animal" (legado) no body, tratamos já no service
    if ((filtro as any)?.groupBy === 'animal') {
      (filtro as any).groupBy = GroupBy.month;
    }

    // Transforma datas caso cheguem como string (quando não usar class-transformer global)
    if (typeof (filtro as any).from === 'string') (filtro as any).from = new Date((filtro as any).from);
    if (typeof (filtro as any).to === 'string') (filtro as any).to = new Date((filtro as any).to);

    return this.dashboard.getIndicadores(fazendaId, tipo, usuarioId, filtro);
  }
}