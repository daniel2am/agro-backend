import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { RelatorioService } from './relatorio.service';

@Controller('relatorios')
@UseGuards(JwtAuthGuard)
export class RelatorioController {
  constructor(private readonly relatorios: RelatorioService) {}

  /** PDF da fazenda no período (?inicio=ISO&fim=ISO; sem filtro = todo o histórico). */
  @Get('fazenda/:fazendaId/pdf')
  async pdf(
    @Param('fazendaId', ParseUUIDPipe) fazendaId: string,
    @Query('inicio') inicio: string | undefined,
    @Query('fim') fim: string | undefined,
    @AuthUser() user: UsuarioPayload,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.relatorios.gerarPdf(fazendaId, user.id, inicio, fim);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** Mesmos números em JSON (útil para conferência e para o app, se quiser exibir). */
  @Get('fazenda/:fazendaId')
  dados(
    @Param('fazendaId', ParseUUIDPipe) fazendaId: string,
    @Query('inicio') inicio: string | undefined,
    @Query('fim') fim: string | undefined,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.relatorios.dados(fazendaId, user.id, inicio, fim);
  }
}
