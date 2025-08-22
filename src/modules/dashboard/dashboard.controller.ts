import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // ajuste o caminho se necessário
import { DashboardService } from './dashboard.service';
import {
  IndicadoresBodyDto,
  GroupBy,
  TipoIndicador,
} from './dto/indicadores.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/:fazendaId')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('resumo')
  async getResumo(
    @Param('fazendaId') fazendaId: string,
    @Req() req: Request,
  ) {
    const usuarioId = (req.user as any)?.sub as string;
    if (!usuarioId) throw new BadRequestException('Usuário inválido no token');
    return this.service.getResumoDaFazenda(fazendaId, usuarioId);
  }

  @Get('historico')
  async getHistorico(
    @Param('fazendaId') fazendaId: string,
    @Req() req: Request,
  ) {
    const usuarioId = (req.user as any)?.sub as string;
    if (!usuarioId) throw new BadRequestException('Usuário inválido no token');
    return this.service.getHistoricoRecentes(fazendaId, usuarioId);
  }

  @Post('indicadores')
  @ApiBody({ type: IndicadoresBodyDto })
  async getIndicadores(
    @Param('fazendaId') fazendaId: string,
    @Req() req: Request,
    @Body() body: IndicadoresBodyDto,
  ) {
    const usuarioId = (req.user as any)?.sub as string;
    if (!usuarioId) throw new BadRequestException('Usuário inválido no token');

    // defaults & sanity
    const tipo = body.tipo as TipoIndicador;
    const from = new Date(body.from);
    const to = new Date(body.to);
    const groupBy = (body.groupBy ?? GroupBy.month) as GroupBy;

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Parâmetros from/to inválidos (ISO esperado).');
    }
    if (from > to) {
      throw new BadRequestException('Range de datas inválido (from > to).');
    }

    return this.service.getIndicadores(
      fazendaId,
      tipo,
      usuarioId,
      {
        from,
        to,
        groupBy,
        invernadaId: body.invernadaId,
        animalIds: body.animalIds,
      },
    );
  }
}