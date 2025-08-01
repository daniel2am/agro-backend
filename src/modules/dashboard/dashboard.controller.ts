import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express'; // <- IMPORTANTE

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':fazendaId')
  async getResumo(@Param('fazendaId') fazendaId: string) {
    return this.dashboardService.getResumoDaFazenda(fazendaId);
  }

  @Get(':fazendaId/historico')
  async getHistorico(
    @Param('fazendaId') fazendaId: string,
    @Request() req: ExpressRequest // <- TIPO CORRETO
  ) {
    const usuarioId = (req.user as any).sub; // <- IMPORTANTE: fazer casting para acessar sub
    return this.dashboardService.getHistoricoRecentes(fazendaId, usuarioId);
  }
}
