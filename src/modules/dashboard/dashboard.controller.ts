// src/modules/dashboard/dashboard.controller.ts
import { Controller, Get, Param, UseGuards, Req, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':fazendaId')
  async getResumo(
    @Param('fazendaId') fazendaId: string,
    @Req() req: ExpressRequest,
  ) {
    const usuarioId = (req.user as any).sub;
    // ⚠️ Ajuste o service para aceitar e validar o usuário:
    // getResumoDaFazenda(fazendaId, usuarioId)
    return this.dashboardService.getResumoDaFazenda(fazendaId, usuarioId);
  }

  @Get(':fazendaId/historico')
  async getHistorico(
    @Param('fazendaId') fazendaId: string,
    @Req() req: ExpressRequest,
  ) {
    const usuarioId = (req.user as any).sub;
    return this.dashboardService.getHistoricoRecentes(fazendaId, usuarioId);
  }

  @Get(':fazendaId/indicadores')
  async getIndicadores(
    @Param('fazendaId') fazendaId: string,
    @Query('tipo') tipo: 'peso' | 'financeiro',
    @Req() req: ExpressRequest,
  ) {
    const usuarioId = (req.user as any).sub;
    return this.dashboardService.getIndicadores(fazendaId, tipo, usuarioId);
  }
}