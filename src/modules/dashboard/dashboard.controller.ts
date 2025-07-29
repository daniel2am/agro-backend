import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':fazendaId')
  async getResumo(@Param('fazendaId') fazendaId: string) {
    return this.dashboardService.getResumoDaFazenda(fazendaId);
  }
}
