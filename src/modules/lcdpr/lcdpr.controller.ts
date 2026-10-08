import { Controller, Get, Query, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { LcdprService, lerAnoLcdpr } from './lcdpr.service';

@UseGuards(JwtAuthGuard)
@Controller('lcdpr')
export class LcdprController {
  constructor(private readonly service: LcdprService) {}

  /** O que está pronto, o que falta e o que ficou de fora. */
  @Get('verificacao')
  verificar(@Query('ano') ano: string | undefined, @AuthUser() user: UsuarioPayload) {
    return this.service.verificar(user.id, lerAnoLcdpr(ano));
  }

  /** O arquivo .txt do LCDPR. Com pendência de bloqueio responde 422 e a lista. */
  @Get('arquivo')
  async arquivo(@Query('ano') ano: string | undefined, @AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const saida = await this.service.gerar(user.id, lerAnoLcdpr(ano));
    if (!saida.pronto || !saida.texto) {
      const { texto: _t, ...resto } = saida;
      throw new UnprocessableEntityException({
        message: 'O LCDPR ainda tem pendências que impedem a geração do arquivo.',
        ...resto,
      });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${saida.nomeArquivo}"`);
    res.send(saida.texto);
  }
}
